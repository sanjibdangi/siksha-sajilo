'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Subject, GradeLevel } from '@/types/subject'
import type { PastPaperQuestion, PaperSection } from '@/types/quiz'

interface PastPapersClientProps {
  subject: Subject
  subjectId: string
  grade: GradeLevel
}

const YEARS = [2082, 2081, 2080]

const SECTION_LABELS: Record<PaperSection, string> = {
  mcq:   'Multiple Choice',
  short: 'Short Answer',
  long:  'Long Answer',
}

const SECTION_COLORS: Record<PaperSection, string> = {
  mcq:   'bg-blue-100 text-blue-700',
  short: 'bg-amber-100 text-amber-700',
  long:  'bg-purple-100 text-purple-700',
}

export function PastPapersClient({ subject, subjectId, grade }: PastPapersClientProps) {
  const [yearBs, setYearBs] = useState(YEARS[0])
  const [questions, setQuestions] = useState<PastPaperQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const gradeNum = grade === 'SEE Prep' ? 10 : parseInt(grade)
  const gradeLabel = grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`

  useEffect(() => {
    setLoading(true)
    setError(false)
    setExpandedId(null)
    fetch(`/api/papers?subjectId=${subjectId}&grade=${gradeNum}&yearBs=${yearBs}`)
      .then(r => {
        if (!r.ok) throw new Error(`API ${r.status}`)
        return r.json()
      })
      .then(data => {
        setQuestions(data.questions ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [yearBs, subjectId, gradeNum])

  const sections: PaperSection[] = ['mcq', 'short', 'long']
  const bySection = (s: PaperSection) => questions.filter(q => q.section === s)
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link
          href={`/subject/${subjectId}`}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 -ml-1 rounded-lg hover:bg-gray-100"
          aria-label="Back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{subject.name} · Past Papers</p>
          <p className="text-xs text-gray-500">{gradeLabel}</p>
        </div>
        {!loading && questions.length > 0 && (
          <Link
            href={`/mock/${subjectId}?grade=${grade}&yearBs=${yearBs}`}
            className="shrink-0 bg-indigo-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Take mock test
          </Link>
        )}
      </header>

      <main className="max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Year selector */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">Select year</p>
          <div className="flex gap-2">
            {YEARS.map(y => (
              <button
                key={y}
                onClick={() => setYearBs(y)}
                className={[
                  'px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all',
                  yearBs === y
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                ].join(' ')}
              >
                {y} BS
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="py-20 text-center text-sm text-gray-400">Loading questions...</div>
        )}

        {error && (
          <div className="py-20 text-center space-y-2">
            <p className="text-sm text-gray-600 font-medium">Database table not found</p>
            <p className="text-xs text-gray-400">
              Run migration 006_past_papers.sql in Supabase SQL Editor, then seed with the pipeline script.
            </p>
          </div>
        )}

        {!loading && !error && questions.length === 0 && (
          <div className="py-20 text-center space-y-3">
            <p className="text-gray-500 text-sm">No past paper available for {yearBs} BS yet.</p>
            <p className="text-xs text-gray-400">Try another year or run the seeder to generate questions.</p>
          </div>
        )}

        {!loading && questions.length > 0 && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{questions.length}</span> questions
              </p>
              <p className="text-sm text-gray-600">
                Total: <span className="font-semibold text-gray-900">{totalMarks} marks</span>
              </p>
              <p className="text-sm text-gray-600">
                Duration: <span className="font-semibold text-gray-900">3 hours</span>
              </p>
            </div>

            {sections.map(section => {
              const qs = bySection(section)
              if (!qs.length) return null
              return (
                <div key={section} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SECTION_COLORS[section]}`}>
                      {SECTION_LABELS[section]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {qs.length} questions · {qs.reduce((s, q) => s + q.marks, 0)} marks
                    </span>
                  </div>

                  <div className="space-y-2">
                    {qs.map(q => (
                      <div
                        key={q.id}
                        className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                          className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                        >
                          <span className="shrink-0 text-xs font-bold text-gray-400 w-6 pt-0.5">
                            {q.question_no}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 leading-relaxed">{q.question}</p>
                            {q.section === 'mcq' && q.options && (
                              <div className="mt-2 space-y-1">
                                {q.options.map((opt, i) => (
                                  <p key={i} className="text-xs text-gray-500">{opt}</p>
                                ))}
                              </div>
                            )}
                            {q.topic && (
                              <p className="mt-1.5 text-xs text-gray-400">{q.topic}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-gray-400 font-medium">{q.marks}m</span>
                        </button>

                        {expandedId === q.id && (
                          <div className="border-t border-gray-100 px-4 py-3 bg-indigo-50/50">
                            <p className="text-xs font-semibold text-indigo-700 mb-1.5">Solution</p>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {q.solution}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </main>
    </div>
  )
}
