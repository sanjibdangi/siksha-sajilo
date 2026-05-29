'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SUBJECTS } from '@/types/subject'
import type { GradeLevel } from '@/types/subject'

interface ScheduleDay {
  day: string
  subject_id: string
  topic: string
  mode: string
  duration_min: number
}

interface StudyPlanData {
  weekly_schedule: ScheduleDay[]
  reasoning: string
}

export interface StudyPlan {
  id: string
  user_id: string
  exam_date: string
  plan: StudyPlanData
  generated_at: string
  is_active: boolean
}

interface Props {
  plan: StudyPlan | null
  grade: GradeLevel
  onPlanGenerated: (plan: StudyPlan) => void
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const MODE_LABELS: Record<string, string> = {
  tutor: 'AI Tutor',
  practice: 'Practice Quiz',
  solve: 'Solve Problems',
  memorize: 'Flashcards',
  write: 'Writing',
}

export function StudyPlanWidget({ plan, grade, onPlanGenerated }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [examDate, setExamDate] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const todayName = DAYS[new Date().getDay()]
  const todayFocus = plan?.plan.weekly_schedule.find(d => d.day === todayName)
  const subject = todayFocus ? SUBJECTS.find(s => s.id === todayFocus.subject_id) : null

  async function handleGenerate() {
    if (!examDate) { setError('Please pick a date.'); return }
    setError('')
    setGenerating(true)
    try {
      const res = await fetch('/api/study-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_date: examDate, grade }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Something went wrong.'); return }
      onPlanGenerated(json.plan)
      setShowModal(false)
    } catch {
      setError('Network error — try again.')
    } finally {
      setGenerating(false)
    }
  }

  // No plan yet → setup CTA
  if (!plan) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="w-full text-left bg-white border border-dashed border-stone-300 rounded-2xl px-5 py-4 hover:border-green-400 hover:bg-green-50/30 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-stone-900 group-hover:text-green-700">
                📅 Get your personalised study plan
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                Set your SEE exam date — we&apos;ll build a daily schedule around it.
              </p>
            </div>
            <span className="text-stone-400 group-hover:text-green-600 text-lg">→</span>
          </div>
        </button>

        {showModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
              <div>
                <h3 className="font-black text-stone-900">When is your SEE exam?</h3>
                <p className="text-xs text-stone-400 mt-1">
                  SEE is usually in April–May (Baisakh-Jestha). Enter the Gregorian (AD) date.
                </p>
              </div>
              <input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-stone-500 border border-stone-200 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {generating ? 'Building plan…' : 'Generate my plan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // Has plan → show today's focus
  return (
    <>
      <div className="bg-white border border-stone-200 rounded-2xl px-5 py-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
            Today&apos;s focus · {todayName}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="text-xs text-stone-400 hover:text-green-600 transition-colors"
          >
            Regenerate
          </button>
        </div>

        {todayFocus && subject ? (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-stone-900">
                {subject.icon} {subject.name}
              </p>
              <p className="text-xs text-stone-500">{todayFocus.topic}</p>
              <p className="text-xs text-stone-400">
                {MODE_LABELS[todayFocus.mode] ?? todayFocus.mode} · ~{todayFocus.duration_min} min
              </p>
            </div>
            <Link
              href={`/subject/${todayFocus.subject_id}?grade=${encodeURIComponent(grade)}`}
              className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-colors shrink-0 ml-4"
            >
              Start →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-stone-400">No session scheduled for today — enjoy the rest!</p>
        )}

        {plan.plan.reasoning && (
          <p className="text-xs text-stone-400 pt-1 border-t border-stone-100">
            {plan.plan.reasoning}
          </p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <div>
              <h3 className="font-black text-stone-900">Update your study plan</h3>
              <p className="text-xs text-stone-400 mt-1">
                Pick your SEE exam date and we&apos;ll regenerate your schedule.
              </p>
            </div>
            <input
              type="date"
              value={examDate || plan.exam_date}
              onChange={e => setExamDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-stone-500 border border-stone-200 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {generating ? 'Building plan…' : 'Regenerate plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
