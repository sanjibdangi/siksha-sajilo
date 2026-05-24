import { anthropic } from '@/lib/anthropic'
import { getSyllabusContext } from '@/lib/rag'
import { buildPracticePrompt } from '@/lib/prompts/practice'
import type { GradeLevel, Subject, LanguagePreference } from '@/types/subject'
import type { QuizQuestion } from '@/types/quiz'

export async function POST(req: Request) {
  const { subject, grade, topic, subjectId, lang } = await req.json()

  const syllabusContext = await getSyllabusContext(
    topic as string,
    grade as GradeLevel,
    subjectId as string
  )

  const system = buildPracticePrompt(
    subject as Subject,
    grade as GradeLevel,
    topic as string,
    syllabusContext,
    (lang as LanguagePreference) ?? 'english'
  )

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: 'Generate the 5 MCQ questions now.' }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

  let questions: QuizQuestion[] = []
  try {
    questions = JSON.parse(raw)
  } catch {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        questions = JSON.parse(match[0])
      } catch {
        // return empty — caller will handle
      }
    }
  }

  return Response.json({ questions })
}
