'use client'

import type { QuizQuestion } from '@/types/quiz'
import { ProgressBar } from './ProgressBar'
import { OptionButton } from './OptionButton'
import type { OptionState } from './OptionButton'

interface QuizCardProps {
  question: QuizQuestion
  questionNumber: number
  total: number
  selectedIndex: number | null
  onSelect: (index: number) => void
  onNext: () => void
  isLast: boolean
}

export function QuizCard({
  question,
  questionNumber,
  total,
  selectedIndex,
  onSelect,
  onNext,
  isLast,
}: QuizCardProps) {
  const answered = selectedIndex !== null
  const isCorrect = answered && selectedIndex === question.correct

  function getOptionState(index: number): OptionState {
    if (!answered) return 'idle'
    if (index === question.correct) return selectedIndex === index ? 'correct' : 'reveal'
    if (index === selectedIndex) return 'incorrect'
    return 'disabled'
  }

  return (
    <div className="space-y-5">
      <ProgressBar current={questionNumber} total={total} />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <p className="text-base font-medium text-gray-900 leading-snug">
          {question.question}
        </p>

        <div className="space-y-2.5">
          {question.options.map((opt, i) => (
            <OptionButton
              key={i}
              label={opt}
              state={getOptionState(i)}
              onClick={() => onSelect(i)}
            />
          ))}
        </div>

        {answered && (
          <div
            className={[
              'rounded-xl p-4 text-sm leading-relaxed border',
              isCorrect
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-amber-50 border-amber-200 text-amber-800',
            ].join(' ')}
          >
            <p className="font-semibold mb-1">
              {isCorrect ? 'That\'s right.' : 'Not quite.'}
            </p>
            <p>{question.explanation}</p>
          </div>
        )}
      </div>

      {answered && (
        <button
          onClick={onNext}
          className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
        >
          {isLast ? 'See my score' : 'Next question →'}
        </button>
      )}
    </div>
  )
}
