'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import type { Subject, GradeLevel } from '@/types/subject'
import type { PastPaperQuestion, PaperSection } from '@/types/quiz'
import { recordProgress } from '@/lib/recordProgress'

interface MockTestClientProps {
  subject: Subject
  subjectId: string
  grade: GradeLevel
  yearBs: number
}

type Phase = 'loading' | 'error' | 'ready' | 'active' | 'submitted'

const DURATION_SECONDS = 3 * 60 * 60  // 3 hours

const SECTION_LABELS: Record<PaperSection, string> = {
  mcq:   'Multiple Choice (1 mark each)',
  short: 'Short Answer',
  long:  'Long Answer',
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function MockTestClient({ subject, subjectId, grade, yearBs }: MockTestClientProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<PastPaperQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, number | null>>({})
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS)
  const [timeTaken, setTimeTaken] = useState(0)
  const [expandedSolution, setExpandedSolution] = useState<string | null>(null)
  const [aiFeedback, setAiFeedback] = useState<Record<string, string>>({})
  const [loadingFeedback, setLoadingFeedback] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const gradeNum = grade === 'SEE Prep' ? 10 : parseInt(grade)
  const gradeLabel = grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`

  useEffect(() => {
    fetch(`/api/papers?subjectId=${subjectId}&grade=${gradeNum}&yearBs=${yearBs}`)
      .then(r => r.json())
      .then(data => {
        if (!data.questions?.length) { setPhase('error'); return }
        setQuestions(data.questions)
        const initial: Record<string, number | null> = {}
        for (const q of data.questions) initial[q.id] = null
        setAnswers(initial)
        setPhase('ready')
      })
      .catch(() => setPhase('error'))
  }, [subjectId, gradeNum, yearBs])

  const handleSubmit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeTaken(DURATION_SECONDS - timeLeft)
    const mqqs = questions.filter(q => q.section === 'mcq')
    const finalScore = mqqs.reduce((sum, q) => answers[q.id] !== null && answers[q.id] === q.correct ? sum + q.marks : sum, 0)
    const finalTotal = mqqs.reduce((sum, q) => sum + q.marks, 0)
    recordProgress({ subjectId, mode: 'practice', score: finalScore, total: finalTotal })
    setPhase('submitted')
  }, [timeLeft, questions, answers, subjectId])

  function startExam() {
    setPhase('active')
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  async function fetchFeedback(q: PastPaperQuestion) {
    if (aiFeedback[q.id] || loadingFeedback) return
    setLoadingFeedback(q.id)
    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `This was in the ${yearBs} BS Grade ${gradeNum} ${subject.name} exam (${q.marks} marks):\n\n${q.question}${q.options ? '\n' + q.options.join('\n') : ''}\n\nThe student answered: ${q.section === 'mcq' && answers[q.id] !== null ? q.options?.[answers[q.id]!] ?? 'No answer' : 'No answer (written question)'}\n\nThe correct solution is:\n${q.solution}\n\nIn 3-4 sentences: explain why the correct answer is right, what this question was really testing, and one thing to remember for the next exam. Be warm and encouraging.`
          }],
          subject,
          grade,
          confidence: 'mid',
          lang: 'english',
        }),
      })
      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setAiFeedback(prev => ({ ...prev, [q.id]: text }))
      }
    } catch {
      setAiFeedback(prev => ({ ...prev, [q.id]: 'Could not load feedback.' }))
    } finally {
      setLoadingFeedback(null)
    }
  }

  const sections: PaperSection[] = ['mcq', 'short', 'long']
  const bySection = (s: PaperSection) => questions.filter(q => q.section === s)

  // Scoring: auto-grade MCQ only
  const mcqQuestions = bySection('mcq')
  const mcqScore = mcqQuestions.reduce((sum, q) => {
    if (answers[q.id] !== null && answers[q.id] === q.correct) return sum + q.marks
    return sum
  }, 0)
  const mcqTotal = mcqQuestions.reduce((sum, q) => sum + q.marks, 0)
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)
  const answeredCount = Object.values(answers).filter(v => v !== null).length
  const mcqCount = mcqQuestions.length

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading exam...</div>
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-600 text-sm">No past paper found for {yearBs} BS.</p>
          <Link href={`/papers/${subjectId}?grade=${grade}`} className="text-indigo-600 text-sm underline">
            Back to past papers
          </Link>
        </div>
      </div>
    )
  }

  // ── READY: briefing screen ───────────────────────────────────────────────────
  if (phase === 'ready') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <Link href={`/papers/${subjectId}?grade=${grade}`} className="text-gray-400 hover:text-gray-600 p-1 -ml-1 rounded-lg hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{subject.name} · Mock Test</p>
            <p className="text-xs text-gray-500">{yearBs} BS · {gradeLabel}</p>
          </div>
        </header>
        <main className="flex-1 max-w-lg w-full mx-auto px-4 py-10 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-5xl">📝</p>
            <h1 className="text-xl font-bold text-gray-900">Ready for the mock test?</h1>
            <p className="text-sm text-gray-500">This simulates the real NEB exam experience.</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {[
              ['Questions', `${questions.length} total`],
              ['Total marks', `${totalMarks}`],
              ['Duration', '3 hours (timer will count down)'],
              ['MCQ', `${mcqCount} questions — auto-graded`],
              ['Written', `${questions.length - mcqCount} questions — review solutions after`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            Once you start, the timer runs. You can submit at any time. No answers are saved if you leave.
          </div>
          <button
            onClick={startExam}
            className="w-full bg-indigo-600 text-white font-semibold py-4 rounded-xl hover:bg-indigo-700 transition-colors text-sm"
          >
            Start exam
          </button>
        </main>
      </div>
    )
  }

  // ── ACTIVE: exam in progress ─────────────────────────────────────────────────
  if (phase === 'active') {
    const urgent = timeLeft < 600  // under 10 minutes
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Sticky timer header */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{subject.name}</p>
            <p className="text-xs text-gray-500">{answeredCount} of {mcqCount} MCQ answered</p>
          </div>
          <div className={`font-mono text-lg font-bold ${urgent ? 'text-red-600' : 'text-indigo-600'}`}>
            {formatTime(timeLeft)}
          </div>
          <button
            onClick={handleSubmit}
            className="bg-indigo-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Submit
          </button>
        </header>

        <main className="max-w-2xl w-full mx-auto px-4 py-6 space-y-8">
          {sections.map(section => {
            const qs = bySection(section)
            if (!qs.length) return null
            return (
              <div key={section} className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">
                  {SECTION_LABELS[section]}
                </h2>
                {qs.map(q => (
                  <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-gray-400 shrink-0 pt-0.5">{q.question_no}.</span>
                      <p className="text-sm text-gray-800 leading-relaxed flex-1">{q.question}</p>
                      <span className="shrink-0 text-xs text-gray-400">{q.marks}m</span>
                    </div>
                    {section === 'mcq' && q.options && (
                      <div className="space-y-2 pl-5">
                        {q.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => setAnswers(prev => ({ ...prev, [q.id]: i }))}
                            className={[
                              'w-full text-left text-sm px-3 py-2 rounded-lg border transition-all',
                              answers[q.id] === i
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-800 font-medium'
                                : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                            ].join(' ')}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                    {section !== 'mcq' && (
                      <p className="pl-5 text-xs text-gray-400 italic">Write your answer on paper. Review the solution after submission.</p>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
          <button
            onClick={handleSubmit}
            className="w-full bg-indigo-600 text-white font-semibold py-4 rounded-xl hover:bg-indigo-700 transition-colors text-sm"
          >
            Submit exam
          </button>
          <div ref={bottomRef} />
        </main>
      </div>
    )
  }

  // ── SUBMITTED: results + solutions ───────────────────────────────────────────
  const pct = Math.round((mcqScore / mcqTotal) * 100)
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href={`/papers/${subjectId}?grade=${grade}`} className="text-gray-400 hover:text-gray-600 p-1 -ml-1 rounded-lg hover:bg-gray-100">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <p className="font-semibold text-gray-900 text-sm">Results · {yearBs} BS</p>
          <p className="text-xs text-gray-500">{subject.name} · {gradeLabel}</p>
        </div>
      </header>

      <main className="max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Score card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center space-y-2">
          <p className="text-5xl font-bold text-indigo-600">{mcqScore}/{mcqTotal}</p>
          <p className="text-sm text-gray-500">MCQ marks · {pct}%</p>
          <p className="text-xs text-gray-400">Time taken: {formatTime(timeTaken)}</p>
          <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-100">
            {pct >= 80
              ? "Strong MCQ performance. Review the written sections below to see what a full answer looks like."
              : pct >= 60
              ? "Decent result. The ones you missed are worth looking at carefully — expand each question to see why."
              : "This shows you exactly where to focus. Go through each question below and read the solution — that's where the real learning happens."}
          </p>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Written questions ({totalMarks - mcqTotal} marks) need a teacher or yourself to check. Expand any question to see the model solution and get AI feedback.
        </p>

        {/* All questions with solutions */}
        {sections.map(section => {
          const qs = bySection(section)
          if (!qs.length) return null
          return (
            <div key={section} className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-700">{SECTION_LABELS[section]}</h2>
              {qs.map(q => {
                const isCorrect = section === 'mcq' && answers[q.id] === q.correct
                const isWrong   = section === 'mcq' && answers[q.id] !== null && answers[q.id] !== q.correct
                const skipped   = section === 'mcq' && answers[q.id] === null
                return (
                  <div key={q.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedSolution(expandedSolution === q.id ? null : q.id)}
                      className="w-full text-left px-4 py-3 flex items-start gap-2 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-xs font-bold text-gray-400 shrink-0 pt-0.5 w-5">{q.question_no}.</span>
                      <p className="text-sm text-gray-800 flex-1 leading-relaxed">{q.question}</p>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="text-xs text-gray-400">{q.marks}m</span>
                        {isCorrect && <span className="text-xs font-semibold text-green-600">Correct</span>}
                        {isWrong   && <span className="text-xs font-semibold text-red-500">Wrong</span>}
                        {skipped   && <span className="text-xs text-gray-400">Skipped</span>}
                      </div>
                    </button>

                    {expandedSolution === q.id && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100">
                        {/* MCQ: show what they chose vs correct */}
                        {section === 'mcq' && q.options && (
                          <div className="px-4 py-3 space-y-1.5">
                            {q.options.map((opt, i) => {
                              const isAns = answers[q.id] === i
                              const isCorr = q.correct === i
                              return (
                                <div
                                  key={i}
                                  className={[
                                    'text-sm px-3 py-1.5 rounded-lg',
                                    isCorr ? 'bg-green-50 text-green-800 font-medium' : '',
                                    isAns && !isCorr ? 'bg-red-50 text-red-700 line-through' : '',
                                    !isAns && !isCorr ? 'text-gray-500' : '',
                                  ].join(' ')}
                                >
                                  {opt} {isCorr ? '✓' : ''}{isAns && !isCorr ? ' (your answer)' : ''}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Solution */}
                        <div className="px-4 py-3 bg-indigo-50/40">
                          <p className="text-xs font-semibold text-indigo-700 mb-1.5">Model solution</p>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{q.solution}</p>
                        </div>

                        {/* AI feedback */}
                        <div className="px-4 py-3">
                          {!aiFeedback[q.id] ? (
                            <button
                              onClick={() => fetchFeedback(q)}
                              disabled={!!loadingFeedback}
                              className="text-xs text-indigo-600 font-medium hover:text-indigo-800 disabled:opacity-50 transition-colors"
                            >
                              {loadingFeedback === q.id ? 'Getting feedback...' : 'Get AI feedback on this question'}
                            </button>
                          ) : (
                            <div className="prose prose-sm max-w-none text-gray-700 prose-p:my-1">
                              <ReactMarkdown>{aiFeedback[q.id]}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </main>
    </div>
  )
}
