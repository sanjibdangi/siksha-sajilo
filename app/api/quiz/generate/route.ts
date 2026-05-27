import { anthropic } from '@/lib/anthropic'
import { getSyllabusContext } from '@/lib/rag'
import { buildPracticePrompt } from '@/lib/prompts/practice'
import { createServerClient } from '@/lib/supabase'
import { getCurrentYearBs } from '@/lib/yearConfig'
import type { GradeLevel, Subject, LanguagePreference } from '@/types/subject'
import type { QuizQuestion } from '@/types/quiz'

export const maxDuration = 60

// How many questions to keep in the pool per topic before regenerating.
const POOL_MIN = 10
// How many fresh questions to generate when the pool runs low.
const POOL_BATCH = 20
// Maximum age of cached questions before refreshing (7 days).
const CACHE_TTL_DAYS = 7

async function getPoolQuestions(
  subjectId: string, grade: number, topic: string, yearBs: number
): Promise<QuizQuestion[]> {
  const supabase = createServerClient()
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86400000).toISOString()

  const { data } = await supabase
    .from('quiz_cache')
    .select('id, questions')
    .eq('subject_id', subjectId)
    .eq('grade', grade)
    .eq('topic', topic)
    .eq('year_bs', yearBs)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!data?.length) return []
  return data.flatMap(row => row.questions as QuizQuestion[])
}

async function generateAndCacheQuestions(
  subject: Subject, grade: GradeLevel, topic: string, subjectId: string,
  yearBs: number, syllabusContext: string, lang: LanguagePreference
): Promise<QuizQuestion[]> {
  const system = buildPracticePrompt(subject, grade, topic, syllabusContext, lang)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const systemBlocks: any = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system: systemBlocks,
    messages: [{ role: 'user', content: `Generate ${POOL_BATCH} MCQ questions now. Return a JSON array of ${POOL_BATCH} objects.` }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  let questions: QuizQuestion[] = []
  try {
    questions = JSON.parse(raw)
  } catch {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) {
      try { questions = JSON.parse(match[0]) } catch { /* empty */ }
    }
  }

  if (questions.length > 0) {
    const gradeNum = grade === 'SEE Prep' ? 10 : parseInt(grade)
    // Store in batches of 5 so each row matches QuizQuestion[5] shape
    const supabase = createServerClient()
    const batches: QuizQuestion[][] = []
    for (let i = 0; i < questions.length; i += 5) batches.push(questions.slice(i, i + 5))
    await supabase.from('quiz_cache').insert(
      batches.map(batch => ({
        subject_id: subjectId,
        grade: gradeNum,
        topic,
        year_bs: yearBs,
        questions: batch,
      }))
    )
  }

  return questions
}

function pickFive(pool: QuizQuestion[]): QuizQuestion[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 5)
}

export async function POST(req: Request) {
  const { subject, grade, topic, subjectId, lang } = await req.json()
  const yearBs = await getCurrentYearBs()
  const gradeNum = (grade as GradeLevel) === 'SEE Prep' ? 10 : parseInt(grade)

  // Check pool first — if we have enough cached questions, serve immediately
  const pool = await getPoolQuestions(subjectId, gradeNum, topic, yearBs)

  if (pool.length >= 5) {
    // Serve from cache, then trigger background refill if pool is getting small
    if (pool.length < POOL_MIN) {
      // Fire-and-forget: refill in background without blocking the response
      const syllabusContext = await Promise.race([
        getSyllabusContext(topic as string, grade as GradeLevel, subjectId as string),
        new Promise<string>(resolve => setTimeout(() => resolve(''), 700)),
      ])
      generateAndCacheQuestions(
        subject as Subject, grade as GradeLevel, topic, subjectId,
        yearBs, syllabusContext, (lang as LanguagePreference) ?? 'english'
      ).catch(() => {})
    }
    return Response.json({ questions: pickFive(pool), cached: true })
  }

  // Cache empty or stale — generate a fresh batch
  const syllabusContext = await Promise.race([
    getSyllabusContext(topic as string, grade as GradeLevel, subjectId as string),
    new Promise<string>(resolve => setTimeout(() => resolve(''), 700)),
  ])

  const questions = await generateAndCacheQuestions(
    subject as Subject, grade as GradeLevel, topic, subjectId,
    yearBs, syllabusContext, (lang as LanguagePreference) ?? 'english'
  )

  return Response.json({ questions: questions.length >= 5 ? pickFive(questions) : questions })
}
