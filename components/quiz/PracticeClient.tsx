'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { QuizCard } from './QuizCard'
import { ScoreScreen } from './ScoreScreen'
import { LoadingDots } from '@/components/ui/LoadingDots'
import type { Subject, GradeLevel, LanguagePreference } from '@/types/subject'
import type { QuizQuestion } from '@/types/quiz'

type Phase = 'loading' | 'error' | 'quiz' | 'complete'

interface PracticeClientProps {
  subject: Subject
  subjectId: string
  grade: GradeLevel
  topic: string | null
  lang: LanguagePreference
}

export function PracticeClient({ subject, subjectId, grade, topic, lang }: PracticeClientProps) {
  const [fetchKey, setFetchKey] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [score, setScore] = useState(0)

  useEffect(() => {
    setPhase('loading')
    setCurrentIndex(0)
    setSelectedIndex(null)
    setScore(0)

    let active = true

    fetch('/api/quiz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        grade,
        topic: topic ?? subject.name,
        subjectId,
        lang,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return
        if (!data.questions?.length) throw new Error('empty')
        setQuestions(data.questions)
        setPhase('quiz')
      })
      .catch(() => {
        if (active) setPhase('error')
      })

    return () => {
      active = false
    }
  }, [fetchKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(index: number) {
    if (selectedIndex !== null) return
    setSelectedIndex(index)
    if (index === questions[currentIndex].correct) {
      setScore((s) => s + 1)
    }
  }

  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      setPhase('complete')
    } else {
      setCurrentIndex((i) => i + 1)
      setSelectedIndex(null)
    }
  }

  function retry() {
    setFetchKey((k) => k + 1)
  }

  const gradeLabel = grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <Link
          href={`/subject/${subjectId}`}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 -ml-1 rounded-lg hover:bg-gray-100"
          aria-label="Back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{subject.icon}</span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
              {subject.name} · Practice Quiz
            </p>
            <p className="text-xs text-gray-500">
              {gradeLabel}{topic ? ` · ${topic}` : ''}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6">
        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-24 text-gray-400">
            <LoadingDots className="text-indigo-400" />
            <p className="text-sm">Generating your questions...</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <p className="text-gray-600 text-sm">
              Couldn&apos;t load questions. Please try again.
            </p>
            <button
              onClick={retry}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {phase === 'quiz' && questions.length > 0 && (
          <QuizCard
            question={questions[currentIndex]}
            questionNumber={currentIndex + 1}
            total={questions.length}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            onNext={handleNext}
            isLast={currentIndex === questions.length - 1}
          />
        )}

        {phase === 'complete' && (
          <ScoreScreen
            score={score}
            total={questions.length}
            grade={grade}
            subjectId={subjectId}
            topic={topic}
            onRetry={retry}
          />
        )}
      </main>
    </div>
  )
}
