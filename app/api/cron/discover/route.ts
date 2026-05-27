import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { MONITORED_SOURCES } from '@/lib/discovery/sources'

const anthropic = new Anthropic()

const MAX_PROCESS_PER_RUN = 6
const FETCH_TIMEOUT_MS = 10000

function extractJson(raw: string): string {
  // Strip markdown code fences that Haiku sometimes adds
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  // Find first { or [ and last } or ]
  const start = raw.search(/[{[]/)
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'))
  if (start !== -1 && end !== -1) return raw.slice(start, end + 1)
  return raw
}

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return authHeader === `Bearer ${cronSecret}`
}

interface PageData {
  text: string
  links: Array<{ href: string; text: string }>
}

// Fetch a page and return both visible text AND all anchor links with absolute hrefs
async function fetchPage(url: string): Promise<PageData> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SikshaSajiloBot/1.0)' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const origin = new URL(url).origin

    // Extract all <a href="...">text</a> before stripping HTML
    const links: Array<{ href: string; text: string }> = []
    const anchorRe = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
    let match
    while ((match = anchorRe.exec(html)) !== null) {
      const rawHref = match[1].trim()
      const linkText = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      if (!linkText || linkText.length < 3) continue
      // Skip obvious nav/ui links
      if (/^(Home|About|Contact|Login|Register|Search|Menu|Tag|Category|Archive|Privacy|Terms)$/i.test(linkText)) continue
      try {
        const absolute = rawHref.startsWith('http') ? rawHref : new URL(rawHref, origin).href
        links.push({ href: absolute, text: linkText.slice(0, 120) })
      } catch { /* skip malformed */ }
    }

    // Visible page text for context
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ').trim()
      .slice(0, 3000)

    return { text, links: links.slice(0, 200) } // cap links at 200
  } finally {
    clearTimeout(timer)
  }
}

interface DiscoveredLink {
  href: string
  title: string
  contentType: string
  grade: string | null
  subject: string | null
  examYear: string | null
  relevanceScore: number
  sourceName: string
}

// Ask Claude to identify which links are relevant Nepal curriculum content
async function classifyLinks(
  pageUrl: string,
  pageData: PageData,
  sourceName: string
): Promise<DiscoveredLink[]> {
  if (!pageData.links.length) return []

  // Format links as a numbered list for Claude
  const linkList = pageData.links
    .map((l, i) => `${i + 1}. [${l.text}] → ${l.href}`)
    .join('\n')

  const prompt = `You are filtering links from a Nepal education website for curriculum relevance.

Source: ${sourceName} (${pageUrl})
Page context: ${pageData.text.slice(0, 500)}

Links found on page:
${linkList}

For each link that is relevant to Nepal Class 9, Class 10, or SEE exam curriculum, return:
- index: the number from the list above
- href: exact URL from the list
- title: the link text
- contentType: "past_paper" | "model_question" | "notes" | "textbook" | "marking_scheme" | "article"
- grade: "9" | "10" | "SEE Prep" | null
- subject: "mathematics" | "science" | "english" | "nepali" | "social" | "optmath" | null
- examYear: BS year string like "2079" or null
- relevanceScore: 6-10 only (6=relevant, 10=perfect match like an official SEE past paper)

ONLY include links with relevanceScore >= 6.
SKIP: navigation, author pages, tag/category/archive pages, social media links, advertisements.
INCLUDE: question papers, model questions, study notes, subject guides, exam solutions.

Return ONLY valid JSON, no markdown:
{"links": [...]}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: '{"links":[' },
      ],
    })
    const raw = '{"links":[' + ((response.content[0] as { type: string; text: string }).text?.trim() ?? '')
    const parsed = JSON.parse(extractJson(raw)) as { links: Array<{ href: string; title: string; contentType: string; grade: string | null; subject: string | null; examYear: string | null; relevanceScore: number }> }
    return (parsed.links ?? [])
      .filter(l => l.relevanceScore >= 6 && l.href)
      .map(l => ({ ...l, sourceName }))
  } catch {
    return []
  }
}

// Fetch content at a link and assess its quality
async function fetchAndAssess(
  contentUrl: string,
  title: string,
  contentType: string
): Promise<{ text: string; qualityScore: number; qualityNotes: string; grade: string | null; subject: string | null; yearBs: number | null } | null> {
  let rawText = ''

  try {
    if (contentUrl.toLowerCase().match(/\.pdf(\?|$)/)) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        const res = await fetch(contentUrl, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SikshaSajiloBot/1.0)' } })
        if (!res.ok) return null
        const buffer = Buffer.from(await res.arrayBuffer())
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
        const data = await pdfParse(buffer)
        rawText = data.text?.replace(/\s+/g, ' ').trim() ?? ''
      } finally {
        clearTimeout(timer)
      }
    } else {
      const pageData = await fetchPage(contentUrl)
      rawText = pageData.text
    }
  } catch {
    return null
  }

  if (!rawText || rawText.length < 150) return null

  const assessPrompt = `Evaluate this Nepal educational content for curriculum relevance.

URL: ${contentUrl}
Title: ${title}
Type: ${contentType}
Content (first 2000 chars): ${rawText.slice(0, 2000)}

Return ONLY valid JSON:
{
  "qualityScore": <1-10; 9-10=official exam paper with real questions, 7-8=good notes/solutions, 6=basic relevant article, below 6=not useful>,
  "qualityNotes": "<one sentence: what this contains and why this score>",
  "grade": <"9"|"10"|"SEE Prep"|null>,
  "subject": <"mathematics"|"science"|"english"|"nepali"|"social"|"optmath"|null>,
  "yearBs": <integer e.g. 2079 or null>,
  "isRelevant": <true if qualityScore >= 6 and is Nepal Class 9/10/SEE content>
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [
        { role: 'user', content: assessPrompt },
        { role: 'assistant', content: '{' },
      ],
    })
    const raw = '{' + ((response.content[0] as { type: string; text: string }).text?.trim() ?? '')
    const assessment = JSON.parse(extractJson(raw)) as { qualityScore: number; qualityNotes: string; grade: string | null; subject: string | null; yearBs: number | null; isRelevant: boolean }
    if (!assessment.isRelevant) return null
    return { text: rawText, qualityScore: assessment.qualityScore, qualityNotes: assessment.qualityNotes, grade: assessment.grade, subject: assessment.subject, yearBs: assessment.yearBs }
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()
  const runStart = Date.now()
  let sourcesChecked = 0
  let newFound = 0
  let errors = 0

  // Load all already-seen URLs to avoid re-processing
  const { data: seenRows } = await supabase.from('auto_discovery_queue').select('source_url')
  const seenUrls = new Set((seenRows ?? []).map((r) => r.source_url))
  const { data: ksRows } = await supabase.from('knowledge_sources').select('source_url').not('source_url', 'is', null)
  for (const r of ksRows ?? []) if (r.source_url) seenUrls.add(r.source_url)

  const toProcess: DiscoveredLink[] = []

  // Phase 1: crawl monitored sources, extract candidate links
  for (const source of MONITORED_SOURCES) {
    if (Date.now() - runStart > 28000) break
    try {
      const pageData = await fetchPage(source.url)
      const links = await classifyLinks(source.url, pageData, source.name)
      sourcesChecked++
      for (const link of links) {
        if (!seenUrls.has(link.href)) {
          toProcess.push(link)
          seenUrls.add(link.href) // dedupe within this run
        }
      }
    } catch {
      errors++
    }
  }

  // Phase 2: fetch content for up to MAX_PROCESS_PER_RUN new candidates
  const batch = toProcess.slice(0, MAX_PROCESS_PER_RUN)

  for (const item of batch) {
    if (Date.now() - runStart > 52000) break
    try {
      const assessment = await fetchAndAssess(item.href, item.title, item.contentType)
      if (!assessment) continue

      const insertPayload = {
        source_url: item.href,
        source_site: item.sourceName,
        detected_title: item.title,
        detected_grade: assessment.grade ?? item.grade,
        detected_subject: assessment.subject ?? item.subject,
        detected_year_bs: assessment.yearBs ?? (item.examYear ? parseInt(item.examYear) : null),
        content_type: item.contentType,
        raw_content: assessment.text,
        word_count: assessment.text.split(/\s+/).length,
        quality_score: assessment.qualityScore,
        quality_notes: assessment.qualityNotes,
        status: 'pending',
      }

      const { error: insertErr } = await supabase
        .from('auto_discovery_queue')
        .upsert(insertPayload, { onConflict: 'source_url', ignoreDuplicates: true })

      if (!insertErr) newFound++
    } catch {
      errors++
    }
  }

  const summary = `Checked ${sourcesChecked} sources, found ${newFound} new items${toProcess.length > batch.length ? `, ${toProcess.length - batch.length} deferred` : ''}`
  await supabase.from('discovery_runs').insert({ sources_checked: sourcesChecked, new_found: newFound, errors, summary })

  return NextResponse.json({ ok: true, sourcesChecked, newFound, deferred: Math.max(0, toProcess.length - batch.length), errors, summary, durationMs: Date.now() - runStart })
}
