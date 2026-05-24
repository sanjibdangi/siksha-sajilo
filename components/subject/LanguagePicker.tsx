'use client'

import type { LanguagePreference } from '@/types/subject'

interface LanguagePickerProps {
  value: LanguagePreference | null
  onChange: (lang: LanguagePreference) => void
}

const OPTIONS = [
  {
    lang: 'english' as LanguagePreference,
    emoji: '🇬🇧',
    label: 'English',
    desc: 'Explain in English',
    selected: 'border-sky-400 bg-sky-50 text-sky-800',
    idle:     'border-stone-200 bg-white text-stone-600 hover:border-sky-300 hover:bg-sky-50/50',
  },
  {
    lang: 'nepali' as LanguagePreference,
    emoji: '🇳🇵',
    label: 'नेपाली',
    desc: 'नेपालीमा बुझाउनुस्',
    selected: 'border-red-400 bg-red-50 text-red-800',
    idle:     'border-stone-200 bg-white text-stone-600 hover:border-red-300 hover:bg-red-50/50',
  },
  {
    lang: 'mix' as LanguagePreference,
    emoji: '🔀',
    label: 'Mix',
    desc: 'Nepali + English',
    selected: 'border-violet-400 bg-violet-50 text-violet-800',
    idle:     'border-stone-200 bg-white text-stone-600 hover:border-violet-300 hover:bg-violet-50/50',
  },
] as const

export function LanguagePicker({ value, onChange }: LanguagePickerProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {OPTIONS.map((opt) => {
        const isSelected = value === opt.lang
        return (
          <button
            key={opt.lang}
            onClick={() => onChange(opt.lang)}
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
