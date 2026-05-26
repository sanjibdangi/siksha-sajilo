import { getTheme } from '@/lib/subjectTheme'

interface ProgressBarProps {
  current: number
  total: number
  subjectId: string
}

export function ProgressBar({ current, total, subjectId }: ProgressBarProps) {
  const theme = getTheme(subjectId)
  const pct = Math.round((current / total) * 100)

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${theme.bar} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-bold text-stone-500 tabular-nums shrink-0">
        {current}<span className="text-stone-300">/{total}</span>
      </span>
    </div>
  )
}
