'use client'

import type { LearningMode } from '@/types/subject'

interface ModeSelectorProps {
  value: LearningMode | null
  onChange: (mode: LearningMode) => void
}

const MODES = [
  {
    mode: 'tutor' as LearningMode,
    icon: '💬',
    title: 'AI Tutor',
    desc: 'Ask anything. Step-by-step explanations, no judgment.',
    selected: 'border-green-500 bg-green-50',
    titleSelected: 'text-green-700',
    idle: 'border-stone-200 bg-white hover:border-stone-300',
  },
  {
    mode: 'practice' as LearningMode,
    icon: '📝',
    title: 'Practice Quiz',
    desc: '5 questions, grounded to your CDC syllabus.',
    selected: 'border-amber-400 bg-amber-50',
    titleSelected: 'text-amber-700',
    idle: 'border-stone-200 bg-white hover:border-stone-300',
  },
  {
    mode: 'solve' as LearningMode,
    icon: '🔍',
    title: 'Solve My Problem',
    desc: 'Paste any question — I teach through every step.',
    selected: 'border-blue-400 bg-blue-50',
    titleSelected: 'text-blue-700',
    idle: 'border-stone-200 bg-white hover:border-stone-300',
  },
  {
    mode: 'memorize' as LearningMode,
    icon: '🃏',
    title: 'Flashcards',
    desc: 'Flip through 10 cards. Lock key concepts into memory.',
    selected: 'border-violet-400 bg-violet-50',
    titleSelected: 'text-violet-700',
    idle: 'border-stone-200 bg-white hover:border-stone-300',
  },
  {
    mode: 'write' as LearningMode,
    icon: '✍️',
    title: 'Writing Assistant',
    desc: 'Essays, letters, paragraphs — I teach structure and style.',
    selected: 'border-emerald-400 bg-emerald-50',
    titleSelected: 'text-emerald-700',
    idle: 'border-stone-200 bg-white hover:border-stone-300',
  },
] as const

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      {MODES.map((m) => {
        const isSelected = value === m.mode
        return (
          <button
            key={m.mode}
            onClick={() => onChange(m.mode)}
            className={[
              'flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all shadow-sm',
              isSelected ? m.selected : m.idle,
            ].join(' ')}
          >
            <span className="text-2xl shrink-0" role="img" aria-label={m.title}>{m.icon}</span>
            <div className="min-w-0 flex-1">
              <p className={`font-bold text-sm transition-colors ${isSelected ? m.titleSelected : 'text-stone-800'}`}>
                {m.title}
              </p>
              <p className="text-xs text-stone-500 leading-snug mt-0.5">{m.desc}</p>
            </div>
            {isSelected && (
              <span className={`shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${m.mode === 'memorize' ? 'bg-violet-600' : m.mode === 'write' ? 'bg-emerald-600' : 'bg-green-600'}`}>
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
