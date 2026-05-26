'use client'

import type { QuizQuestion } from '@/types/quiz'
import { ProgressBar } from './ProgressBar'
import { OptionButton } from './OptionButton'
import type { OptionState } from './OptionButton'
import { getTheme } from '@/lib/subjectTheme'

interface QuizCardProps {
  question: QuizQuestion
  questionNumber: number
  total: number
  selectedIndex: number | null
  subjectId: string
  subjectIcon: string
  onSelect: (index: number) => void
  onNext: () => void
  isLast: boolean
}

export function QuizCard({
  question,
  questionNumber,
  total,
  selectedIndex,
  subjectId,
  subjectIcon,
  onSelect,
  onNext,
  isLast,
}: QuizCardProps) {
  const theme = getTheme(subjectId)
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
      <ProgressBar current={questionNumber} total={total} subjectId={subjectId} />

      {/* Question card */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Accent strip */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${theme.gradient}`} />

        <div className="p-5 space-y-4">
          {/* Question number badge + text */}
          <div className="flex items-start gap-3">
            <span className={`shrink-0 mt-0.5 w-7 h-7 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white text-xs font-black shadow-sm`}>
              {questionNumber}
            </span>
            <p className="text-base font-semibold text-stone-900 leading-snug pt-0.5">
              {question.question}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2">
            {question.options.map((opt, i) => (
              <OptionButton
                key={i}
                label={opt}
                index={i}
                state={getOptionState(i)}
                subjectId={subjectId}
                onClick={() => onSelect(i)}
              />
            ))}
          </div>

          {/* Explanation */}
          {answered && (
            <div className={[
              'rounded-2xl px-4 py-4 text-sm leading-relaxed border',
              isCorrect
                ? 'bg-green-50 border-green-200 text-green-900'
                : 'bg-amber-50 border-amber-200 text-amber-900',
            ].join(' ')}>
              <div className="flex items-center gap-2 mb-2">
                {isCorrect
                  ? <svg className="h-4 w-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  : <svg className="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                <p className="font-bold text-sm">
                  {isCorrect ? 'Correct!' : 'Not quite — here\'s why:'}
                </p>
              </div>
              <p>{question.explanation}</p>
            </div>
          )}
        </div>
      </div>

      {/* Next button */}
      {answered && (
        <button
          onClick={onNext}
          className={`w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r ${theme.gradient} shadow-lg hover:opacity-90 active:scale-[0.98] transition-all`}
        >
          {isLast ? 'See my score →' : 'Next question →'}
        </button>
      )}
    </div>
  )
}
