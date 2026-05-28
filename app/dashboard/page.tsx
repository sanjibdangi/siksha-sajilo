'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SUBJECTS } from '@/types/subject'
import { createClient } from '@/lib/supabase'
import type { GradeLevel } from '@/types/subject'

const GRADES: { value: GradeLevel; label: string; desc: string }[] = [
  { value: '9',        label: 'Class 9',   desc: 'Foundation' },
  { value: '10',       label: 'Class 10',  desc: 'Almost SEE' },
  { value: 'SEE Prep', label: 'SEE Prep',  desc: 'Exam mode' },
]

const GRADE_KEY = 'siksha_grade'

const SUBJECT_ACCENTS: Record<string, string> = {
  mathematics: 'hover:border-blue-300 hover:shadow-blue-50',
  science:     'hover:border-green-300 hover:shadow-green-50',
  english:     'hover:border-purple-300 hover:shadow-purple-50',
  nepali:      'hover:border-red-300 hover:shadow-red-50',
  social:      'hover:border-orange-300 hover:shadow-orange-50',
  hpe:         'hover:border-lime-300 hover:shadow-lime-50',
  optmath:     'hover:border-cyan-300 hover:shadow-cyan-50',
  computer:    'hover:border-slate-300 hover:shadow-slate-50',
  account:     'hover:border-amber-300 hover:shadow-amber-50',
  economics:   'hover:border-emerald-300 hover:shadow-emerald-50',
}

const SUBJECT_ICON_BG: Record<string, string> = {
  mathematics: 'bg-blue-50',
  science:     'bg-green-50',
  english:     'bg-purple-50',
  nepali:      'bg-red-50',
  social:      'bg-orange-50',
  hpe:         'bg-lime-50',
  optmath:     'bg-cyan-50',
  computer:    'bg-slate-50',
  account:     'bg-amber-50',
  economics:   'bg-emerald-50',
}

export default function DashboardPage() {
  const [grade, setGrade] = useState<GradeLevel>('10')
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem(GRADE_KEY) as GradeLevel | null
    if (saved) setGrade(saved)
  }, [])

  function handleGradeChange(g: GradeLevel) {
    setGrade(g)
    localStorage.setItem(GRADE_KEY, g)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const gradeLabel = grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-stone-200 px-6 py-4 bg-white">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="font-black text-base tracking-tight text-stone-900">
            Siksha<span className="text-green-600">Sajilo</span>
          </span>
          <button onClick={handleSignOut} className="text-sm text-stone-400 hover:text-stone-700 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-black text-stone-900">What are you studying today?</h1>
            <p className="text-stone-500 text-sm mt-1">Select your grade, then pick a subject.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {GRADES.map((g) => (
              <button
                key={g.value}
                onClick={() => handleGradeChange(g.value)}
                className={[
                  'px-4 py-2 rounded-xl text-sm font-bold transition-all border',
                  grade === g.value
                    ? 'bg-green-600 text-white border-green-600 shadow-sm'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:text-stone-900',
                ].join(' ')}
              >
                {g.label}
                <span className={`ml-2 text-xs font-normal ${grade === g.value ? 'text-green-100' : 'text-stone-400'}`}>
                  {g.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider">
            {gradeLabel} · Pick a subject
          </p>
          <Link
            href="/dashboard/progress"
            className="text-xs text-stone-400 hover:text-green-600 font-semibold transition-colors flex items-center gap-1"
          >
            📊 My progress
          </Link>
        </div>
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SUBJECTS.map((subject) => {
              const accent = SUBJECT_ACCENTS[subject.id] ?? 'hover:border-green-300'
              const iconBg = SUBJECT_ICON_BG[subject.id] ?? 'bg-stone-50'
              return (
                <Link
                  key={subject.id}
                  href={`/subject/${subject.id}?grade=${encodeURIComponent(grade)}`}
                  className={`group bg-white rounded-2xl border border-stone-200 p-5 transition-all text-center space-y-3 shadow-sm hover:shadow-md ${accent}`}
                >
                  <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center mx-auto`}>
                    <span className="text-2xl">{subject.icon}</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-stone-900 leading-tight">{subject.name}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{subject.nameNepali}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
