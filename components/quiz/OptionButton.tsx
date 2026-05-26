'use client'

import { getTheme } from '@/lib/subjectTheme'

export type OptionState = 'idle' | 'correct' | 'incorrect' | 'reveal' | 'disabled'

interface OptionButtonProps {
  label: string
  index: number
  state: OptionState
  subjectId: string
  onClick: () => void
}

const LETTERS = ['A', 'B', 'C', 'D']

export function OptionButton({ label, index, state, subjectId, onClick }: OptionButtonProps) {
  const theme = getTheme(subjectId)
  const letter = LETTERS[index] ?? String(index + 1)

  const containerClass = {
    idle:      `border-stone-200 bg-white hover:bg-stone-50 ${theme.hoverBorder} cursor-pointer active:scale-[0.99]`,
    correct:   'border-green-400 bg-green-50 cursor-default',
    incorrect: 'border-red-300 bg-red-50 cursor-default',
    reveal:    'border-green-300 bg-white cursor-default',
    disabled:  'border-stone-100 bg-stone-50 cursor-default opacity-50',
  }[state]

  const letterClass = {
    idle:      `bg-stone-100 text-stone-500 ${theme.hoverBorder}`,
    correct:   'bg-green-500 text-white',
    incorrect: 'bg-red-400 text-white',
    reveal:    'bg-green-100 text-green-700',
    disabled:  'bg-stone-100 text-stone-300',
  }[state]

  const textClass = {
    idle:      'text-stone-800',
    correct:   'text-green-800 font-semibold',
    incorrect: 'text-red-800',
    reveal:    'text-green-700 font-semibold',
    disabled:  'text-stone-400',
  }[state]

  const icon = state === 'correct' || state === 'reveal'
    ? <svg className="h-4 w-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
    : state === 'incorrect'
    ? <svg className="h-4 w-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
    : null

  return (
    <button
      onClick={state === 'idle' ? onClick : undefined}
      disabled={state !== 'idle'}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all ${containerClass}`}
    >
      <span className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black transition-colors ${letterClass}`}>
        {letter}
      </span>
      <span className={`flex-1 text-sm leading-snug ${textClass}`}>{label}</span>
      {icon}
    </button>
  )
}
