import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { embed } from '@/lib/embeddings'
import Anthropic from '@anthropic-ai/sdk'

function isAdmin(req: Request) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET
}

const anthropic = new Anthropic()

const SUBJECT_NAMES: Record<string, string> = {
  mathematics: 'Mathematics',
  science: 'Science',
  english: 'English',
  nepali: 'Nepali',
  social: 'Social Studies',
  optmath: 'Optional Mathematics',
}

function buildGenerationPrompt(
  grade: string,
  subjectName: string,
  unitNo: number,
  unitTitle: string,
  chapterNo: number,
  chapterTitle: string,
  topic: string,
  objectives: string[],
  marksWeight: number
): string {
  const gradeLabel = grade === 'SEE Prep' ? 'SEE Preparation' : `Class ${grade}`
  return `You are writing educational reference content for a Nepal CDC curriculum AI tutor.

Grade: ${gradeLabel}
Subject: ${subjectName}
Unit ${unitNo}: ${unitTitle}
Chapter ${chapterNo}: ${chapterTitle}
Topic: ${topic}
Marks in exam: ${marksWeight}
Learning objectives: ${objectives?.join('; ') || 'Not specified'}

Write a comprehensive educational explanation for this topic. Structure your response as:

CONCEPT
Explain the core concept clearly in 2-3 sentences. Start from first principles — what is this and why does it exist?

KEY POINTS
List 4-6 specific, testable facts, rules, or formulas a student must know. Be precise. Include actual formulas with variable definitions where relevant.

WORKED EXAMPLE
One concrete, step-by-step worked example relevant to Nepal (use NPR amounts, local distances, familiar situations). Show every step.

COMMON MISTAKES
The 2 most frequent errors students make on this exact topic in the SEE exam. Be specific — not "be careful" but exactly what goes wrong and why.

SEE EXAM NOTES
How this topic appears in the SEE exam: typical question format, marks it carries, and what the marking scheme rewards.

Keep the total length around 400-600 words. Write in clear, simple English. No unnecessary padding.`
}

// GET — returns pending topics for a grade/subject/year (not yet generated)
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const grade = url.searchParams.get('grade')
  const subjectId = url.searchParams.get('subjectId')
  const yearBs = parseInt(url.searchParams.get('yearBs') || '2083')

  if (!grade || !subjectId) {
    return NextResponse.json({ error: 'grade and subjectId required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const gradeNum = grade === 'SEE Prep' ? 10 : parseInt(grade)

  // All active syllabus topics
  const { data: topics, error } = await supabase
    .from('syllabus')
    .select('id, unit_no, unit_title, chapter_no, chapter_title, topic, learning_objectives, marks_weight')
    .eq('grade', gradeNum)
    .eq('subject_id', subjectId)
    .eq('year_bs', yearBs)
    .eq('status', 'active')
    .order('unit_no')
    .order('chapter_no')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Which topics already have AI-generated knowledge sources?
  const { data: existing } = await supabase
    .from('knowledge_sources')
    .select('title')
    .eq('grade', grade)
    .eq('subject_id', subjectId)
    .eq('year_bs', yearBs)
    .eq('source_type', 'ai_generated')
    .eq('status', 'active')

  const existingTitles = new Set((existing ?? []).map((e) => e.title))
  const pending = (topics ?? []).filter((t) => !existingTitles.has(t.topic))
  const done = (topics ?? []).length - pending.length

  return NextResponse.json({
    total: (topics ?? []).length,
    done,
    pending: pending.map((t) => ({
      id: t.id,
      unitNo: t.unit_no,
      unitTitle: t.unit_title,
      chapterNo: t.chapter_no,
      chapterTitle: t.chapter_title,
      topic: t.topic,
      objectives: t.learning_objectives,
      marksWeight: t.marks_weight,
    })),
  })
}

// POST — generate knowledge for a batch of topic IDs
// Body: { topicIds: string[], grade, subjectId, yearBs }
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topicIds, grade, subjectId, yearBs } = await req.json()
  if (!topicIds?.length || !grade || !subjectId || !yearBs) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServerClient()
  const gradeNum = grade === 'SEE Prep' ? 10 : parseInt(grade)
  const subjectName = SUBJECT_NAMES[subjectId] ?? subjectId

  const { data: topics } = await supabase
    .from('syllabus')
    .select('id, unit_no, unit_title, chapter_no, chapter_title, topic, learning_objectives, marks_weight')
    .in('id', topicIds)
    .eq('grade', gradeNum)
    .eq('subject_id', subjectId)
    .eq('year_bs', yearBs)

  if (!topics?.length) return NextResponse.json({ processed: 0, results: [] })

  const results: Array<{ topic: string; status: 'done' | 'error'; error?: string }> = []

  for (const t of topics) {
    try {
      const prompt = buildGenerationPrompt(
        grade,
        subjectName,
        t.unit_no,
        t.unit_title,
        t.chapter_no,
        t.chapter_title,
        t.topic,
        t.learning_objectives ?? [],
        t.marks_weight ?? 0
      )

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      })

      const rawContent = (message.content[0] as { type: string; text: string }).text?.trim()
      if (!rawContent) throw new Error('Empty response from Claude')

      let embedding: number[] | null = null
      try {
        embedding = await embed(rawContent.slice(0, 2000))
      } catch {
        // Non-fatal
      }

      const { error: insertErr } = await supabase.from('knowledge_sources').insert({
        source_type: 'ai_generated',
        title: t.topic,
        grade,
        subject_id: subjectId,
        year_bs: yearBs,
        topic_tags: [t.topic, t.chapter_title, t.unit_title].filter(Boolean),
        raw_content: rawContent,
        word_count: rawContent.split(/\s+/).length,
        status: 'active',
        embedding,
      })

      if (insertErr) throw new Error(insertErr.message)
      results.push({ topic: t.topic, status: 'done' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ topic: t.topic, status: 'error', error: msg })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
