'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DEFAULT_YEAR_BS } from '@/lib/constants'
import { ConfidencePicker } from '@/components/subject/ConfidencePicker'
import { LanguagePicker } from '@/components/subject/LanguagePicker'
import { ModeSelector } from '@/components/subject/ModeSelector'
import { TopicPills } from '@/components/subject/TopicPills'
import type { Subject, GradeLevel, ConfidenceLevel, LearningMode, LanguagePreference } from '@/types/subject'

interface SubjectClientProps {
  subject: Subject
  grade: GradeLevel
  topics: string[]
}

const MODE_LABELS: Record<LearningMode, string> = {
  tutor:    'Start tutoring →',
  practice: 'Start quiz →',
  solve:    'Start solving →',
  memorize: 'Start flashcards →',
  write:    'Start writing →',
}


export function SubjectClient({ subject, grade, topics }: SubjectClientProps) {
  // Sensible defaults so the student only *needs* to pick a mode.
  // Confidence and language are pre-selected but easily changed.
  const [confidence, setConfidence] = useState<ConfidenceLevel>('mid')
  const [mode, setMode] = useState<LearningMode | null>(null)
  const [topic, setTopic] = useState<string | null>(null)
  const [lang, setLang] = useState<LanguagePreference>('english')
  const router = useRouter()

  function handleStart() {
    if (!mode) return

    const params = new URLSearchParams()
    params.set('grade', grade)
    params.set('lang', lang)
    if (mode !== 'practice') params.set('confidence', confidence)
    if (topic) params.set('topic', topic)

    router.push(`/${mode}/${subject.id}?${params.toString()}`)
  }

  const gradeLabel = grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`
  const canStart = mode !== null

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-stone-200 bg-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-stone-400 hover:text-stone-700 transition-colors p-1.5 -ml-1 rounded-xl hover:bg-stone-100"
            aria-label="Back to dashboard"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl shrink-0">{subject.icon}</span>
            <div className="min-w-0">
              <p className="font-bold text-stone-900 text-sm leading-tight">{subject.name}</p>
              <p className="text-xs text-stone-400">{gradeLabel}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg w-full mx-auto px-4 py-6 space-y-5">

        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">How are you feeling today?</p>
          <ConfidencePicker value={confidence} onChange={setConfidence} />
        </div>

        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">Language</p>
          <LanguagePicker value={lang} onChange={setLang} />
        </div>

        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">What do you want to do?</p>
          <ModeSelector value={mode} onChange={setMode} />
        </div>

        <div className="pt-1 space-y-3">
          <button
            onClick={handleStart}
            disabled={!canStart}
            className={[
              'w-full py-4 rounded-2xl font-black text-base transition-all',
              canStart
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-md active:scale-[0.98]'
                : 'bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200',
            ].join(' ')}
          >
            {canStart && mode ? MODE_LABELS[mode] : 'Pick a mode above to start'}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/papers/${subject.id}?grade=${grade}`}
              className="flex items-center gap-2.5 p-3 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all group"
            >
              <span className="text-lg">📄</span>
              <div>
                <p className="text-xs font-bold text-stone-700 group-hover:text-stone-900 transition-colors">Past Papers</p>
                <p className="text-xs text-stone-400">NEB by year</p>
              </div>
            </Link>
            <Link
              href={`/mock/${subject.id}?grade=${grade}&yearBs=${DEFAULT_YEAR_BS - 1}`}
              className="flex items-center gap-2.5 p-3 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all group"
            >
              <span className="text-lg">⏱️</span>
              <div>
                <p className="text-xs font-bold text-stone-700 group-hover:text-stone-900 transition-colors">Mock Test</p>
                <p className="text-xs text-stone-400">Exam simulation</p>
              </div>
            </Link>
          </div>
        </div>

        {topics.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-stone-400 font-semibold uppercase tracking-wider">Optional</span>
              <span className="flex-1 h-px bg-stone-200" />
            </div>
            <TopicPills topics={topics} selected={topic} onSelect={setTopic} />
          </div>
        )}
      </main>
    </div>
  )
}
