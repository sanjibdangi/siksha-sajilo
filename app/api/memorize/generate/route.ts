import { anthropic } from '@/lib/anthropic'
import { getSyllabusContext } from '@/lib/rag'
import { buildMemorizePrompt } from '@/lib/prompts/memorize'
import { createServerClient } from '@/lib/supabase'
import { getCurrentYearBs } from '@/lib/yearConfig'
import type { GradeLevel, Subject, LanguagePreference } from '@/types/subject'
import type { Flashcard } from '@/types/flashcard'

export const maxDuration = 60

// Flashcard sets refresh every 3 days — students get consistent cards across sessions.
const CACHE_TTL_DAYS = 3

async function getCachedCards(
  subjectId: string, grade: number, topic: string, yearBs: number
): Promise<Flashcard[] | null> {
  const supabase = createServerClient()
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86400000).toISOString()

  const { data } = await supabase
    .from('flashcard_cache')
    .select('cards')
    .eq('subject_id', subjectId)
    .eq('grade', grade)
    .eq('topic', topic)
    .eq('year_bs', yearBs)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data ? (data.cards as Flashcard[]) : null
}

export async function POST(req: Request) {
  const { subject, grade, topic, subjectId, lang } = await req.json()
  const yearBs = await getCurrentYearBs()
  const gradeNum = (grade as GradeLevel) === 'SEE Prep' ? 10 : parseInt(grade)

  // Serve from cache if available
  const cached = await getCachedCards(subjectId, gradeNum, topic, yearBs)
  if (cached) {
    return Response.json({ cards: cached, cached: true })
  }

  // Generate fresh set on Haiku
  const syllabusContext = await Promise.race([
    getSyllabusContext(topic as string, grade as GradeLevel, subjectId as string),
    new Promise<string>(resolve => setTimeout(() => resolve(''), 700)),
  ])

  const system = buildMemorizePrompt(
    subject as Subject,
    grade as GradeLevel,
    topic as string,
    syllabusContext,
    (lang as LanguagePreference) ?? 'english'
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const systemBlocks: any = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: systemBlocks,
    messages: [{ role: 'user', content: 'Generate the 10 flashcards now.' }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  let cards: Flashcard[] = []
  try {
    cards = JSON.parse(raw)
  } catch {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) {
      try { cards = JSON.parse(match[0]) } catch { /* return empty */ }
    }
  }

  // Store in cache for future requests
  if (cards.length > 0) {
    const supabase = createServerClient()
    await supabase.from('flashcard_cache').insert({
      subject_id: subjectId,
      grade: gradeNum,
      topic,
      year_bs: yearBs,
      cards,
    })
  }

  return Response.json({ cards })
}
