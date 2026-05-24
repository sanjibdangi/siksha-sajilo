'use client'

import type { ConfidenceLevel } from '@/types/subject'

interface ConfidencePickerProps {
  value: ConfidenceLevel | null
  onChange: (level: ConfidenceLevel) => void
}

const OPTIONS = [
  {
    level: 'low' as ConfidenceLevel,
    emoji: '😟',
    label: 'Not confident',
    desc: 'Start from scratch',
    selected: 'border-amber-400 bg-amber-50 text-amber-800',
    idle:     'border-stone-200 bg-white text-stone-600 hover:border-amber-300 hover:bg-amber-50/50',
  },
  {
    level: 'mid' as ConfidenceLevel,
    emoji: '🙂',
    label: 'Getting there',
    desc: 'Need some clarity',
    selected: 'border-blue-400 bg-blue-50 text-blue-800',
    idle:     'border-stone-200 bg-white text-stone-600 hover:border-blue-300 hover:bg-blue-50/50',
  },
  {
    level: 'high' as ConfidenceLevel,
    emoji: '😊',
    label: 'Confident',
    desc: 'Want more depth',
    selected: 'border-green-500 bg-green-50 text-green-800',
    idle:     'border-stone-200 bg-white text-stone-600 hover:border-green-300 hover:bg-green-50/50',
  },
] as const

export function ConfidencePicker({ value, onChange }: ConfidencePickerProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {OPTIONS.map((opt) => {
        const isSelected = value === opt.level
        return (
          <button
            key={opt.level}
            onClick={() => onChange(opt.level)}
            className={[
              'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-center transition-all shadow-sm',
              isSelected ? opt.selected : opt.idle,
            ].join(' ')}
          >
            <span className="text-2xl" role="img" aria-label={opt.label}>{opt.emoji}</span>
            <span className="text-sm font-bold leading-tight">{opt.label}</span>
            <span className="text-xs opacity-60 leading-tight">{opt.desc}</span>
          </button>
        )
      })}
    </div>
  )
}
