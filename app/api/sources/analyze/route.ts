import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { anthropic } from '@/lib/anthropic'
import { getCurrentYearBs } from '@/lib/yearConfig'

const SUBJECT_NAMES: Record<string, string> = {
  mathematics: 'Mathematics',
  science: 'Science',
  english: 'English',
  nepali: 'Nepali',
  social: 'Social Studies',
  optmath: 'Optional Mathematics',
}

function buildAnalysisPrompt(
  subjectName: string,
  grade: string,
  topic: string,
  yearBs: number,
  failureCount: number,
  satisfactionPct: number
): string {
  const gradeLabel = grade === 'SEE Prep' ? 'SEE Preparation' : `Class ${grade}`
  const nextYear = yearBs + 1

  return `You are an expert pedagogy analyst for Nepal's SEE (School Leaving Examination) system, academic year ${yearBs}-${nextYear} BS.

An AI tutoring system for Nepali students has been flagging a persistent knowledge gap:

SUBJECT: ${subjectName}
GRADE: ${gradeLabel}
TOPIC: ${topic}
ACADEMIC YEAR: ${yearBs}-${nextYear} BS
FAILURE SIGNAL: ${failureCount} students clicked "Still confused" on this topic
CURRENT SATISFACTION: ${satisfactionPct}%

Your job is to diagnose why and generate targeted teaching content to fix it.

━━ PART 1: DIAGNOSIS (2-3 sentences) ━━
What are the most likely reasons Nepali ${gradeLabel} students consistently struggle with "${topic}"?
Consider: foundational gaps from earlier classes, how this topic is typically taught in Nepal,
common textbook shortcomings, language barriers (English terms for Nepali speakers),
and cultural context gaps.

━━ PART 2: TEACHING NOTE (350-450 words) ━━
Write a comprehensive teaching note for "${topic}" at ${gradeLabel} level that will be added
to the AI tutor's knowledge base. This note will be used as context when the AI answers
student questions about this topic.

Requirements for the teaching note:
- Start from the absolute fundamentals — assume only what a Nepali student at this grade would know
- Use Nepal-specific examples: NPR amounts, dal-bhat, bazaar prices, rice fields, local rivers,
  Kathmandu/Pokhara geography, familiar Nepali situations
- Address the exact confusion patterns identified in your diagnosis
- Include the 2-3 most important things to remember about this topic
- Include the single most common exam mistake that costs marks in SEE
- Include one memory trick or shortcut where applicable
- Written in warm, plain language — like a patient Nepali teacher, not a textbook
- Must align with the ${yearBs}-${nextYear} BS CDC Nepal curriculum scope for ${gradeLabel}

━━ OUTPUT FORMAT ━━
Return valid JSON only — no markdown fences, no other text:
{
  "diagnosis": "...",
  "teaching_note": "..."
}`
}

// POST — run analysis on all under-performing topics for the current year
export async function POST(req: Request) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const yearBs = await getCurrentYearBs()

  // Get aggregated feedback for current year
  const { data: feedbackRows, error: fbErr } = await supabase
    .from('feedback')
    .select('subject_id, grade, topic, rating')
    .eq('year_bs', yearBs)

  if (fbErr) return NextResponse.json({ error: fbErr.message }, { status: 500 })

  // Aggregate by subject + grade + topic
  const map = new Map<string, { subject_id: string; grade: string; topic: string; total: number; positive: number }>()
  for (const row of feedbackRows ?? []) {
    const key = `${row.subject_id}||${row.grade}||${row.topic ?? 'General'}`
    if (!map.has(key)) map.set(key, { subject_id: row.subject_id, grade: row.grade, topic: row.topic ?? 'General', total: 0, positive: 0 })
    const e = map.get(key)!
    e.total++
    if (row.rating === 1) e.positive++
  }

  // Only analyze topics that need it: 5+ failures AND satisfaction below 70%
  const targets = Array.from(map.values())
    .map(e => ({ ...e, satisfaction: Math.round((e.positive / e.total) * 100), failures: e.total - e.positive }))
    .filter(e => e.failures >= 3 && e.satisfaction < 70)

  if (targets.length === 0) {
    return NextResponse.json({ message: 'No topics need analysis right now.', analyzed: 0 })
  }

  // Check which topics already have a pending improvement (skip duplicates)
  const { data: existing } = await supabase
    .from('pending_improvements')
    .select('subject_id, grade, topic')
    .eq('year_bs', yearBs)
    .eq('status', 'pending')

  const existingKeys = new Set((existing ?? []).map(e => `${e.subject_id}||${e.grade}||${e.topic}`))
  const toAnalyze = targets.filter(t => !existingKeys.has(`${t.subject_id}||${t.grade}||${t.topic}`))

  if (toAnalyze.length === 0) {
    return NextResponse.json({ message: 'All failing topics already have pending improvements.', analyzed: 0 })
  }

  const results: { topic: string; status: string }[] = []

  for (const target of toAnalyze) {
    try {
      const subjectName = SUBJECT_NAMES[target.subject_id] ?? target.subject_id
      const prompt = buildAnalysisPrompt(subjectName, target.grade, target.topic, yearBs, target.failures, target.satisfaction)

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = (response.content[0] as { type: string; text: string }).text.trim()
      const parsed = JSON.parse(raw) as { diagnosis: string; teaching_note: string }

      await supabase.from('pending_improvements').insert({
        year_bs: yearBs,
        subject_id: target.subject_id,
        grade: target.grade,
        topic: target.topic,
        diagnosis: parsed.diagnosis,
        teaching_note: parsed.teaching_note,
        failure_count: target.failures,
        satisfaction_pct: target.satisfaction,
        status: 'pending',
      })

      results.push({ topic: target.topic, status: 'generated' })
    } catch (err) {
      results.push({ topic: target.topic, status: `error: ${err instanceof Error ? err.message : 'unknown'}` })
    }
  }

  return NextResponse.json({ analyzed: results.length, results, year_bs: yearBs })
}

// GET — list pending improvements for admin review
export async function GET(req: Request) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const yearBs = await getCurrentYearBs()

  const { data, error } = await supabase
    .from('pending_improvements')
    .select('*')
    .eq('year_bs', yearBs)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ improvements: data ?? [], year_bs: yearBs })
}

// PATCH — approve or reject a pending improvement
export async function PATCH(req: Request) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, action } = await req.json() as { id: string; action: 'approve' | 'reject' }
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Fetch the improvement
  const { data: item, error: fetchErr } = await supabase
    .from('pending_improvements')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (action === 'approve') {
    // Save the teaching note as an active knowledge source
    await supabase.from('knowledge_sources').insert({
      source_type: 'ai_generated',
      title: `AI Teaching Note: ${item.topic} (${item.grade === 'SEE Prep' ? 'SEE Prep' : `Class ${item.grade}`})`,
      grade: item.grade,
      subject_id: item.subject_id,
      topic_tags: [item.topic],
      year_bs: item.year_bs,
      raw_content: item.teaching_note,
      word_count: item.teaching_note.split(/\s+/).length,
      status: 'active',
    })
  }

  // Update improvement status
  await supabase
    .from('pending_improvements')
    .update({ status: action === 'approve' ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true, action })
}
