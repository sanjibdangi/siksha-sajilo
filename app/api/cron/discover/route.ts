import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { embed } from '@/lib/embeddings'
import Anthropic from '@anthropic-ai/sdk'
import { MONITORED_SOURCES } from '@/lib/discovery/sources'

const anthropic = new Anthropic()

// Max items to fully process per cron run (keeps execution under 55s)
const MAX_PROCESS_PER_RUN = 6
// Max age of page fetch (ms) before we consider it stale
const FETCH_TIMEOUT_MS = 8000

// Vercel calls cron endpoints — authenticate via CRON_SECRET
function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // no secret configured — allow (dev only)
  return authHeader === `Bearer ${cronSecret}`
}

// Fetch a URL and return its text, stripping most HTML noise
async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SikshaSajiloBot/1.0 (educational research)' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    // Strip script/style/nav blocks and collapse whitespace
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ')
      .trim()
    return stripped.slice(0, 8000) // cap at 8k chars for Claude
  } finally {
    clearTimeout(timer)
  }
}

// Ask Claude to extract relevant educational content links from a page
async function extractLinks(
  pageUrl: string,
  pageText: string,
  sourceName: string
): Promise<Array<{
  href: string
  title: string
  contentType: string
  grade: string | null
  subject: string | null
  examYear: string | null
  relevanceScore: number
}>> {
  const prompt = `You are analysing a Nepal education website page for new curriculum content.

Source site: ${sourceName}
Page URL: ${pageUrl}

Page content (truncated):
${pageText}

Find ALL links to educational content relevant to Nepal Class 9, Class 10, or SEE exam.

For each relevant link return:
- href: full absolute URL (if relative, prepend ${new URL(pageUrl).origin})
- title: the link text / article title / heading
- contentType: "past_paper" | "model_question" | "notes" | "textbook" | "marking_scheme" | "article"
- grade: "9" | "10" | "SEE Prep" | null
- subject: one of mathematics|science|english|nepali|social|optmath or null
- examYear: the BS year string if visible e.g. "2079" or null
- relevanceScore: 1-10 (10 = definitely Nepal SEE curriculum content, 1 = tangentially related)

Only include links with relevanceScore >= 6.
Ignore: navigation links, author pages, tag pages, admin links, login pages.

Return ONLY valid JSON, no markdown:
{"links": [...]}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (response.content[0] as { type: string; text: string }).text?.trim()
    const parsed = JSON.parse(raw) as { links: typeof extractLinks extends (...args: never[]) => Promise<infer R> ? R : never }
    return (parsed.links ?? []).filter((l) => l.relevanceScore >= 6)
  } catch {
    return []
  }
}

// Fetch the actual content at a discovered link and assess its quality
async function fetchAndAssess(
  contentUrl: string,
  title: string,
  contentType: string
): Promise<{ text: string; qualityScore: number; qualityNotes: string; grade: string | null; subject: string | null; yearBs: number | null } | null> {
  let rawText = ''

  try {
    if (contentUrl.toLowerCase().endsWith('.pdf')) {
      // Download PDF and parse
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        const res = await fetch(contentUrl, { signal: controller.signal })
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
      rawText = await fetchPageText(contentUrl)
    }
  } catch {
    return null
  }

  if (!rawText || rawText.length < 100) return null

  // Ask Claude to assess quality and extract metadata
  const assessPrompt = `You are evaluating Nepal educational content for quality and relevance.

URL: ${contentUrl}
Title: ${title}
Content type: ${contentType}

Content (first 3000 chars):
${rawText.slice(0, 3000)}

Assess this content and return JSON only, no markdown:
{
  "qualityScore": <1-10, where 10=excellent Nepal SEE curriculum content with specific questions/explanations>,
  "qualityNotes": "<one sentence: what this content contains and why this score>",
  "grade": <"9" | "10" | "SEE Prep" | null>,
  "subject": <"mathematics" | "science" | "english" | "nepali" | "social" | "optmath" | null>,
  "yearBs": <int e.g. 2079 or null>,
  "isRelevant": <true if qualityScore >= 6 and is Nepal Class 9/10/SEE content>
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: assessPrompt }],
    })
    const raw = (response.content[0] as { type: string; text: string }).text?.trim()
    const assessment = JSON.parse(raw) as {
      qualityScore: number
      qualityNotes: string
      grade: string | null
      subject: string | null
      yearBs: number | null
      isRelevant: boolean
    }

    if (!assessment.isRelevant) return null

    return {
      text: rawText,
      qualityScore: assessment.qualityScore,
      qualityNotes: assessment.qualityNotes,
      grade: assessment.grade,
      subject: assessment.subject,
      yearBs: assessment.yearBs,
    }
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

  // Collect all already-seen URLs to avoid re-queuing
  const { data: seenRows } = await supabase
    .from('auto_discovery_queue')
    .select('source_url')
  const seenUrls = new Set((seenRows ?? []).map((r) => r.source_url))

  // Also check knowledge_sources for already-ingested URLs
  const { data: ksRows } = await supabase
    .from('knowledge_sources')
    .select('source_url')
    .not('source_url', 'is', null)
  for (const r of ksRows ?? []) {
    if (r.source_url) seenUrls.add(r.source_url)
  }

  const toProcess: Array<{
    href: string
    title: string
    contentType: string
    grade: string | null
    subject: string | null
    examYear: string | null
    sourceName: string
  }> = []

  // Phase 1: crawl all monitored sources and collect new links
  for (const source of MONITORED_SOURCES) {
    if (Date.now() - runStart > 30000) break // 30s budget for discovery phase
    try {
      const pageText = await fetchPageText(source.url)
      const links = await extractLinks(source.url, pageText, source.name)
      sourcesChecked++

      for (const link of links) {
        if (!seenUrls.has(link.href)) {
          toProcess.push({ ...link, sourceName: source.name })
          seenUrls.add(link.href) // prevent duplicates within this run
        }
      }
    } catch {
      errors++
    }
  }

  // Phase 2: fetch + assess up to MAX_PROCESS_PER_RUN new items
  const batch = toProcess.slice(0, MAX_PROCESS_PER_RUN)

  for (const item of batch) {
    if (Date.now() - runStart > 52000) break // leave 8s buffer
    try {
      const assessment = await fetchAndAssess(item.href, item.title, item.contentType)
      if (!assessment) continue

      let embedding: number[] | null = null
      try {
        embedding = await embed(assessment.text.slice(0, 2000))
      } catch {
        // Non-fatal
      }

      const { error: insertErr } = await supabase
        .from('auto_discovery_queue')
        .insert({
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
        })

      if (!insertErr) {
        // If embedding is available, update immediately
        if (embedding) {
          const { data: inserted } = await supabase
            .from('auto_discovery_queue')
            .select('id')
            .eq('source_url', item.href)
            .single()
          if (inserted) {
            await supabase
              .from('auto_discovery_queue')
              .update({ raw_content: assessment.text }) // store the full content
              .eq('id', inserted.id)
          }
        }
        newFound++
      }
    } catch {
      errors++
    }
  }

  // Log the run
  const summary = `Checked ${sourcesChecked} sources, found ${newFound} new items, ${toProcess.length - batch.length} deferred to next run`
  await supabase.from('discovery_runs').insert({
    sources_checked: sourcesChecked,
    new_found: newFound,
    errors,
    summary,
  })

  return NextResponse.json({
    ok: true,
    sourcesChecked,
    newFound,
    deferred: Math.max(0, toProcess.length - batch.length),
    errors,
    summary,
    durationMs: Date.now() - runStart,
  })
}
