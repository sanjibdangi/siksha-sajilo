import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SUBJECTS } from '@/types/subject'
import type { GradeLevel, ConfidenceLevel, LanguagePreference } from '@/types/subject'
import { ChatInterface } from '@/components/tutor/ChatInterface'

function buildWelcomeMessage(
  grade: GradeLevel,
  subjectName: string,
  topic: string | null
): string {
  if (grade === '9') {
    return topic
      ? `Namaste! Let's understand ${topic} together.\n\nThere's no pressure here — just tell me what's confusing you and we'll work through it step by step. No question is too basic.`
      : `Namaste! I'm here to help you with ${subjectName} (Class 9).\n\nAsk me anything — something confusing from class, a topic you want to understand better, or even just where to begin. We go at your pace.`
  }

  if (grade === '10') {
    return topic
      ? `Namaste! Let's work through ${topic} together.\n\nTell me where you're getting stuck, or what part doesn't quite make sense yet. We'll build your understanding step by step.`
      : `Namaste! I'm your ${subjectName} tutor for Class 10.\n\nAsk me anything — concepts you're unsure about, problems you can't solve, or topics to strengthen before the exam. No judgment, ever.`
  }

  // SEE Prep
  return topic
    ? `Namaste! SEE preparation can feel like a lot — and that feeling is completely normal. Let's focus on ${topic} together, calmly.\n\nTell me what's unclear and we'll go through it step by step.`
    : `Namaste! Preparing for SEE can feel overwhelming — and that's completely normal. You're not alone in that feeling.\n\nI'm here to help you actually understand ${subjectName}, not just memorize it. Ask me anything. We take it one step at a time, together.`
}

interface PageProps {
  params: { subjectId: string }
  searchParams: { grade?: string; confidence?: string; topic?: string; lang?: string }
}

export default function TutorPage({ params, searchParams }: PageProps) {
  const subject = SUBJECTS.find((s) => s.id === params.subjectId)
  if (!subject) notFound()

  const grade = (searchParams.grade ?? '10') as GradeLevel
  const confidence = (searchParams.confidence ?? 'mid') as ConfidenceLevel
  const topic = searchParams.topic ?? null
  const lang = (searchParams.lang ?? 'english') as LanguagePreference

  const welcomeMessage = buildWelcomeMessage(grade, subject.name, topic)

  const gradeLabel = grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`

  return (
    <div className="h-screen flex flex-col bg-[#faf9f7]">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white px-4 py-3 flex items-center gap-3 shrink-0">
        <Link
          href={`/subject/${params.subjectId}`}
          className="text-stone-400 hover:text-stone-700 transition-colors p-1.5 -ml-1 rounded-xl hover:bg-stone-100"
          aria-label="Back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl shrink-0">{subject.icon}</span>
          <div className="min-w-0">
            <p className="font-bold text-stone-900 text-sm leading-tight truncate">{subject.name}</p>
            <p className="text-xs text-stone-400">
              {gradeLabel}{topic ? ` · ${topic}` : ''}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-stone-400">AI Tutor</span>
        </div>
      </header>

      {/* Chat */}
      <main className="flex-1 overflow-hidden w-full max-w-3xl mx-auto">
        <ChatInterface
          subject={subject}
          subjectId={params.subjectId}
          grade={grade}
          confidence={confidence}
          topic={topic}
          lang={lang}
          welcomeMessage={welcomeMessage}
        />
      </main>
    </div>
  )
}
