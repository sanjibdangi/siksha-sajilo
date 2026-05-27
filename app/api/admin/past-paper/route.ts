import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { embed } from '@/lib/embeddings'
import Anthropic from '@anthropic-ai/sdk'
import type { DocumentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages'

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

const EXTRACTION_PROMPT = `You are parsing a Nepal NEB/SEE exam paper or model question paper.

Extract EVERY question from this document. For each question include:
- section: the section label (e.g. "A", "B", "C", "Section A", or null)
- questionNo: the question number (integer or string like "1", "2a")
- questionText: the full, exact question text verbatim from the paper
- marks: marks allocated (integer, e.g. 4)
- questionType: one of "mcq", "short_answer", "long_answer", "very_short"
- topic: the mathematics/science/english topic this question tests (your best inference)
- modelAnswer: if an answer key or solution is present in the document, extract it verbatim. If not present, write null.

Rules:
- Extract ALL questions, including sub-parts (a, b, c)
- Keep the exact original phrasing — do not paraphrase
- For MCQs, include all four options in questionText
- If marks are not stated per question but the section states total marks, divide evenly
- Return ONLY valid JSON, no markdown fences, no other text

Output schema:
{
  "paperTitle": "SEE 2079 Mathematics",
  "totalQuestions": 25,
  "questions": [
    {
      "section": "A",
      "questionNo": "1",
      "questionText": "...",
      "marks": 1,
      "questionType": "mcq",
      "topic": "Algebra",
      "modelAnswer": null
    }
  ]
}`

// GET — list past papers already ingested
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('knowledge_sources')
    .select('id, title, grade, subject_id, year_bs, word_count, created_at')
    .eq('source_type', 'past_paper')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by title prefix to count papers vs individual questions
  const papers: Record<string, { title: string; grade: string; subject_id: string; year_bs: number; questionCount: number; createdAt: string }> = {}
  for (const row of data ?? []) {
    // title format: "SEE 2079 Mathematics — Q1a"
    const paperKey = row.title?.split(' — ')[0] ?? row.title
    if (!papers[paperKey]) {
      papers[paperKey] = {
        title: paperKey,
        grade: row.grade,
        subject_id: row.subject_id,
        year_bs: row.year_bs,
        questionCount: 0,
        createdAt: row.created_at,
      }
    }
    papers[paperKey].questionCount++
  }

  return NextResponse.json({ papers: Object.values(papers) })
}

// POST — parse and ingest a past paper PDF
// multipart/form-data: file (PDF), grade, subjectId, yearBs, examYear, examType
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const grade = form.get('grade') as string
  const subjectId = form.get('subjectId') as string
  const yearBs = parseInt(form.get('yearBs') as string)
  const examYear = form.get('examYear') as string   // e.g. "2079 BS"
  const examType = form.get('examType') as string   // e.g. "SEE" | "model" | "pre-board"

  if (!file || !grade || !subjectId || !yearBs || !examYear) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
  }

  const subjectName = SUBJECT_NAMES[subjectId] ?? subjectId
  const paperLabel = `${examType ?? 'SEE'} ${examYear} ${subjectName}`

  // Convert file to base64 for Claude's document API
  const buffer = Buffer.from(await file.arrayBuffer())
  const base64Pdf = buffer.toString('base64')

  // Send PDF directly to Claude for structured extraction
  let parsed: {
    paperTitle: string
    totalQuestions: number
    questions: Array<{
      section: string | null
      questionNo: string
      questionText: string
      marks: number
      questionType: string
      topic: string
      modelAnswer: string | null
    }>
  }

  try {
    const docBlock: DocumentBlockParam = {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64Pdf,
      },
    }
    const textBlock: TextBlockParam = {
      type: 'text',
      text: EXTRACTION_PROMPT,
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [docBlock, textBlock],
        },
      ],
    })

    const raw = (response.content[0] as { type: string; text: string }).text?.trim()
    if (!raw) throw new Error('Empty response from Claude')
    parsed = JSON.parse(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'PDF parsing failed'
    return NextResponse.json({ error: `Could not extract questions: ${msg}` }, { status: 500 })
  }

  if (!parsed.questions?.length) {
    return NextResponse.json({ error: 'No questions found in this PDF' }, { status: 422 })
  }

  // Store each question as a knowledge_source entry
  const supabase = createServerClient()
  let savedCount = 0
  let errorCount = 0

  for (const q of parsed.questions) {
    try {
      const questionLabel = q.section
        ? `${q.section} Q${q.questionNo}`
        : `Q${q.questionNo}`

      const title = `${paperLabel} — ${questionLabel}`

      // Build rich raw_content that gives the tutor full context when retrieved
      const lines: string[] = [
        `[${examType ?? 'SEE'} Exam ${examYear} — ${subjectName} — ${questionLabel} — ${q.marks} mark${q.marks !== 1 ? 's' : ''} — ${formatQType(q.questionType)}]`,
        '',
        `Question: ${q.questionText}`,
      ]

      if (q.modelAnswer) {
        lines.push('', `Model Answer: ${q.modelAnswer}`)
      }

      lines.push('', `Topic: ${q.topic}`)
      lines.push(`Exam year: ${examYear}`)
      lines.push(`Marks: ${q.marks}`)

      const rawContent = lines.join('\n')

      let embedding: number[] | null = null
      try {
        embedding = await embed(rawContent.slice(0, 2000))
      } catch {
        // Non-fatal
      }

      const { error: insertErr } = await supabase.from('knowledge_sources').insert({
        source_type: 'past_paper',
        title,
        grade,
        subject_id: subjectId,
        year_bs: yearBs,
        topic_tags: [q.topic, subjectName, examYear, examType ?? 'SEE'].filter(Boolean),
        raw_content: rawContent,
        word_count: rawContent.split(/\s+/).length,
        status: 'active',
        embedding,
      })

      if (insertErr) throw new Error(insertErr.message)
      savedCount++
    } catch {
      errorCount++
    }
  }

  return NextResponse.json({
    ok: true,
    paperLabel,
    extracted: parsed.questions.length,
    saved: savedCount,
    errors: errorCount,
  })
}

function formatQType(type: string): string {
  const map: Record<string, string> = {
    mcq: 'MCQ',
    short_answer: 'Short Answer',
    long_answer: 'Long Answer',
    very_short: 'Very Short Answer',
  }
  return map[type] ?? type
}
