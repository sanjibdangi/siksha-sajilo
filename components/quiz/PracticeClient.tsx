'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { QuizCard } from './QuizCard'
import { ScoreScreen } from './ScoreScreen'
import type { Subject, GradeLevel, LanguagePreference } from '@/types/subject'
import type { QuizQuestion } from '@/types/quiz'
import { getTheme } from '@/lib/subjectTheme'

type Phase = 'loading' | 'error' | 'quiz' | 'complete'

interface PracticeClientProps {
  subject: Subject
  subjectId: string
  grade: GradeLevel
  topic: string | null
  lang: LanguagePreference
}

export function PracticeClient({ subject, subjectId, grade, topic, lang }: PracticeClientProps) {
  const theme = getTheme(subjectId)
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
      body: JSON.stringify({ subject, grade, topic: topic ?? subject.name, subjectId, lang }),
    })
      .then(r => r.json())
      .then(data => {
        if (!active) return
        if (!data.questions?.length) throw new Error('empty')
        setQuestions(data.questions)
        setPhase('quiz')
      })
      .catch(() => { if (active) setPhase('error') })

    return () => { active = false }
  }, [fetchKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(index: number) {
    if (selectedIndex !== null) return
    setSelectedIndex(index)
    if (index === questions[currentIndex].correct) setScore(s => s + 1)
  }

  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      setPhase('complete')
    } else {
      setCurrentIndex(i => i + 1)
      setSelectedIndex(null)
    }
  }

  function retry() { setFetchKey(k => k + 1) }

  const gradeLabel = grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f4f2]">
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <Link
          href={`/subject/${subjectId}`}
          className="text-stone-400 hover:text-stone-600 transition-colors p-1.5 -ml-1 rounded-xl hover:bg-stone-100"
          aria-label="Back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="text-xl shrink-0">{subject.icon}</span>
          <div className="min-w-0">
            <p className="font-bold text-stone-900 text-sm leading-tight">{subject.name} · Practice Quiz</p>
            <p className="text-xs text-stone-400">{gradeLabel}{topic ? ` · ${topic}` : ''}</p>
          </div>
        </div>
        {phase === 'quiz' && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${theme.pill}`}>
            {score} pts
          </span>
        )}
      </header>

      {/* Subject-coloured top stripe */}
      <div className={`h-1 bg-gradient-to-r ${theme.gradient}`} />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6">

        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-6 py-24">
            <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-xl ${theme.glow} shadow-lg`}>
              <span className="text-4xl">{subject.icon}</span>
            </div>
            <div className="text-center space-y-1.5">
              <p className="font-bold text-stone-800">Generating your questions</p>
              <p className="text-sm text-stone-400">Pulling CDC-grounded questions for {topic ?? subject.name}...</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full ${theme.bar} animate-bounce`}
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <p className="text-4xl">⚠️</p>
            <p className="text-stone-600 font-medium">Couldn&apos;t load questions</p>
            <button
              onClick={retry}
              className={`px-6 py-3 bg-gradient-to-r ${theme.gradient} text-white font-semibold rounded-2xl shadow-md active:scale-95 transition-transform`}
            >
              Try again
            </button>
          </div>
        )}

        {phase === 'quiz' && questions.length > 0 && (
          <QuizCard
            question={questions[currentIndex]}
            questionNumber={currentIndex + 1}
            total={questions.length}
            selectedIndex={selectedIndex}
            subjectId={subjectId}
            subjectIcon={subject.icon}
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
            subjectIcon={subject.icon}
            topic={topic}
            onRetry={retry}
          />
        )}
      </main>
    </div>
  )
}
