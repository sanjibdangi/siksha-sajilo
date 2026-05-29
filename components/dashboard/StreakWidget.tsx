'use client'

interface StreakData {
  current_streak: number
  longest_streak: number
  studied_today: boolean
}

interface Props {
  data: StreakData | null
  examDate: string | null
}

function daysUntil(dateStr: string): number {
  const exam = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  exam.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((exam.getTime() - today.getTime()) / 86400000))
}

export function StreakWidget({ data, examDate }: Props) {
  if (!data) return null

  const { current_streak, studied_today } = data
  const daysLeft = examDate ? daysUntil(examDate) : null

  const streakLabel =
    current_streak > 0 ? `${current_streak}-day streak` : 'No streak yet'

  const subLabel = studied_today
    ? 'Studied today'
    : current_streak > 0
      ? 'Study today to keep it going'
      : 'Start studying to build your streak'

  const icon = current_streak >= 3 ? '🔥' : current_streak > 0 ? '⚡' : '💪'

  return (
    <div className="flex items-center justify-between bg-white border border-stone-200 rounded-2xl px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm font-bold text-stone-900">{streakLabel}</p>
          <p className="text-xs text-stone-400 mt-0.5">{subLabel}</p>
        </div>
      </div>
      {daysLeft !== null && (
        <div className="text-right shrink-0 ml-4">
          <p className="text-xl font-black text-stone-900">{daysLeft}</p>
          <p className="text-xs text-stone-400">days to SEE</p>
        </div>
      )}
    </div>
  )
}
