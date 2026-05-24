import Link from 'next/link'
import type { GradeLevel } from '@/types/subject'

interface ScoreScreenProps {
  score: number
  total: number
  grade: GradeLevel
  subjectId: string
  topic: string | null
  onRetry: () => void
}

function getScoreMessage(score: number, total: number, grade: GradeLevel): string {
  if (score === total)
    return 'Full marks. Your understanding of this topic is solid — carry that into the exam.'
  if (score >= total * 0.8)
    return "Really good result. The one you missed is worth a quick look — now that you've seen it, it'll stick better."
  if (score >= total * 0.6)
    return 'Good effort. The ones you got wrong are worth going through carefully. Want me to explain any of them?'
  if (grade === 'SEE Prep')
    return "This topic needs more attention before your exam — and now you know exactly which parts to focus on. That's valuable. Want to go through the correct answers together?"
  return "This topic needs more practice, and that's completely okay. It just means you've found exactly where to focus next. Want me to explain the ones you missed?"
}

function scoreColorClass(score: number, total: number): string {
  const pct = score / total
  if (pct === 1) return 'text-green-600'
  if (pct >= 0.8) return 'text-green-500'
  if (pct >= 0.6) return 'text-amber-500'
  return 'text-red-500'
}

export function ScoreScreen({ score, total, grade, subjectId, topic, onRetry }: ScoreScreenProps) {
  const message = getScoreMessage(score, total, grade)
  const gradeParam = encodeURIComponent(grade)
  const topicParam = topic ? `&topic=${encodeURIComponent(topic)}` : ''
  const tutorHref = `/tutor/${subjectId}?grade=${gradeParam}&confidence=mid${topicParam}`

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center max-w-sm mx-auto">
      <div className="space-y-1">
        <p className="text-sm text-gray-500">Your score</p>
        <p className={`text-6xl font-bold tracking-tight ${scoreColorClass(score, total)}`}>
          {score}/{total}
        </p>
      </div>

      <p className="text-gray-700 text-sm leading-relaxed">{message}</p>

      <div className="w-full space-y-3 pt-2">
        <button
          onClick={onRetry}
          className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
        >
          Try again
        </button>
        <Link
          href={tutorHref}
          className="block w-full py-3 border-2 border-indigo-300 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition-colors"
        >
          Discuss with AI tutor
        </Link>
        <Link
          href={`/subject/${subjectId}`}
          className="block text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
        >
          Back to subject
        </Link>
      </div>
    </div>
  )
}
