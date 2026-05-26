import Link from 'next/link'
import type { GradeLevel } from '@/types/subject'
import { getTheme, getStars } from '@/lib/subjectTheme'

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
    return 'Full marks. Every concept landed — carry that into the exam.'
  if (score >= total * 0.8)
    return "Really solid. The one you missed is worth a quick look — now that you've seen it, it'll stick."
  if (score >= total * 0.6)
    return 'Good effort. The ones you got wrong are worth going through carefully.'
  if (grade === 'SEE Prep')
    return "This topic needs more attention before your exam — now you know exactly which parts to focus on."
  return "This topic needs more practice — and that's completely okay. You've found exactly where to focus next."
}

export function ScoreScreen({ score, total, grade, subjectId, topic, onRetry }: ScoreScreenProps) {
  const theme = getTheme(subjectId)
  const stars = getStars(score, total)
  const pct = Math.round((score / total) * 100)
  const gradeParam = encodeURIComponent(grade)
  const topicParam = topic ? `&topic=${encodeURIComponent(topic)}` : ''
  const message = getScoreMessage(score, total, grade)

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center max-w-sm mx-auto">

      {/* Stars */}
      <div className="flex gap-2">
        {[1, 2, 3].map(s => (
          <svg
            key={s}
            className={`h-9 w-9 transition-all ${s <= stars ? 'text-amber-400 scale-110' : 'text-stone-200'}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>

      {/* Circle score */}
      <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${theme.gradient} flex flex-col items-center justify-center shadow-2xl ${theme.glow} shadow-xl`}>
        <p className="text-4xl font-black text-white">{pct}%</p>
        <p className="text-white/70 text-xs font-medium">{score}/{total} correct</p>
      </div>

      <p className="text-stone-600 text-sm leading-relaxed">{message}</p>

      {/* Actions */}
      <div className="w-full space-y-2.5 pt-1">
        <button
          onClick={onRetry}
          className={`w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r ${theme.gradient} shadow-lg active:scale-[0.98] transition-transform`}
        >
          Try again
        </button>
        <Link
          href={`/memorize/${subjectId}?grade=${gradeParam}${topicParam}`}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border-2 border-stone-200 bg-white text-stone-700 font-semibold text-sm hover:border-stone-300 transition-colors"
        >
          <span>🃏</span> Reinforce with flashcards
        </Link>
        <Link
          href={`/tutor/${subjectId}?grade=${gradeParam}&confidence=mid${topicParam}`}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border-2 border-stone-200 bg-white text-stone-700 font-semibold text-sm hover:border-stone-300 transition-colors"
        >
          <span>💬</span> Discuss with AI tutor
        </Link>
        <Link
          href={`/subject/${subjectId}`}
          className="block text-sm text-stone-400 hover:text-stone-600 transition-colors py-1"
        >
          Back to subject
        </Link>
      </div>
    </div>
  )
}
