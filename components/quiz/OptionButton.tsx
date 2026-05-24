'use client'

export type OptionState = 'idle' | 'correct' | 'incorrect' | 'reveal' | 'disabled'

interface OptionButtonProps {
  label: string
  state: OptionState
  onClick: () => void
}

const stateClasses: Record<OptionState, string> = {
  idle:     'border-gray-200 bg-white text-gray-800 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer',
  correct:  'border-green-500 bg-green-50 text-green-800 cursor-default',
  incorrect:'border-red-400 bg-red-50 text-red-800 cursor-default',
  reveal:   'border-green-400 bg-white text-green-800 cursor-default',
  disabled: 'border-gray-100 bg-gray-50 text-gray-400 cursor-default',
}

const icons: Partial<Record<OptionState, { symbol: string; color: string }>> = {
  correct:  { symbol: '✓', color: 'text-green-600' },
  incorrect:{ symbol: '✗', color: 'text-red-500' },
  reveal:   { symbol: '✓', color: 'text-green-500' },
}

export function OptionButton({ label, state, onClick }: OptionButtonProps) {
  const icon = icons[state]
  return (
    <button
      onClick={state === 'idle' ? onClick : undefined}
      disabled={state !== 'idle'}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left text-sm leading-snug transition-all ${stateClasses[state]}`}
    >
      <span className="flex-1">{label}</span>
      {icon && (
        <span className={`shrink-0 font-bold text-base ${icon.color}`}>{icon.symbol}</span>
      )}
    </button>
  )
}
