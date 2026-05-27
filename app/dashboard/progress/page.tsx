'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SUBJECTS } from '@/types/subject'

interface ProgressRow {
  id: string
  subject_id: string
  topic: string | null
  mode: string
  score: number | null
  total: number | null
  duration_s: number | null
  session_at: string
}

const MODE_LABEL: Record<string, string> = {
  tutor: 'AI Tutor',
  practice: 'Practice Quiz',
  solve: 'Solve',
  memorize: 'Flashcards',
  write: 'Writing',
}

const MODE_COLOR: Record<string, string> = {
  tutor: 'bg-green-100 text-green-700',
  practice: 'bg-amber-100 text-amber-700',
  solve: 'bg-blue-100 text-blue-700',
  memorize: 'bg-violet-100 text-violet-700',
  write: 'bg-emerald-100 text-emerald-700',
}

function subjectIcon(id: string) {
  return SUBJECTS.find(s => s.id === id)?.icon ?? '📚'
}

function subjectName(id: string) {
  return SUBJECTS.find(s => s.id === id)?.name ?? id
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function scoreLabel(row: ProgressRow) {
  if (row.score == null || row.total == null) return null
  if (row.mode === 'memorize') return `${row.score}/${row.total} mastered`
  return `${row.score}/${row.total}`
}

export default function ProgressPage() {
  const [rows, setRows] = useState<ProgressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/progress')
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to load progress'); setLoading(false); return }
      setRows(json.progress ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Aggregate stats
  const totalSessions = rows.length
  const subjectCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.subject_id] = (acc[r.subject_id] ?? 0) + 1
    return acc
  }, {})
  const topSubject = Object.entries(subjectCounts).sort(([, a], [, b]) => b - a)[0]

  const practiceRows = rows.filter(r => r.mode === 'practice' && r.score != null && r.total != null)
  const avgScore = practiceRows.length
    ? Math.round(practiceRows.reduce((sum, r) => sum + (r.score! / r.total!) * 100, 0) / practiceRows.length)
    : null

  const modeCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.mode] = (acc[r.mode] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-stone-200 bg-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-stone-400 hover:text-stone-700 transition-colors p-1.5 -ml-1 rounded-xl hover:bg-stone-100"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="font-bold text-stone-900 text-sm">My Progress</p>
            <p className="text-xs text-stone-400">All your study sessions</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Summary stats */}
        {!loading && rows.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center shadow-sm">
              <p className="text-3xl font-black text-stone-900">{totalSessions}</p>
              <p className="text-xs text-stone-400 mt-1">Sessions</p>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center shadow-sm">
              <p className="text-3xl font-black text-green-600">{avgScore != null ? `${avgScore}%` : '—'}</p>
              <p className="text-xs text-stone-400 mt-1">Quiz avg</p>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 p-4 text-center shadow-sm">
              <p className="text-3xl font-black text-stone-900">
                {topSubject ? subjectIcon(topSubject[0]) : '—'}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                {topSubject ? subjectName(topSubject[0]) : 'No sessions yet'}
              </p>
            </div>
          </div>
        )}

        {/* Mode breakdown */}
        {!loading && Object.keys(modeCounts).length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-stone-700">Sessions by mode</p>
            {Object.entries(modeCounts).sort(([, a], [, b]) => b - a).map(([mode, count]) => (
              <div key={mode} className="flex items-center gap-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${MODE_COLOR[mode] ?? 'bg-stone-100 text-stone-600'}`}>
                  {MODE_LABEL[mode] ?? mode}
                </span>
                <div className="flex-1 bg-stone-100 rounded-full h-2">
                  <div
                    className="bg-stone-400 h-2 rounded-full transition-all"
                    style={{ width: `${(count / totalSessions) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-stone-500 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recent activity */}
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Recent sessions</p>

          {loading && (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-stone-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
          )}

          {!loading && rows.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <p className="text-4xl">📊</p>
              <p className="text-stone-600 font-medium">No sessions recorded yet</p>
              <p className="text-stone-400 text-sm">Start studying and your progress will appear here.</p>
              <Link
                href="/dashboard"
                className="inline-block mt-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
              >
                Start studying
              </Link>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="space-y-2">
              {rows.map(row => {
                const score = scoreLabel(row)
                return (
                  <div
                    key={row.id}
                    className="bg-white rounded-2xl border border-stone-200 px-4 py-3 flex items-center gap-3 shadow-sm"
                  >
                    <span className="text-xl shrink-0">{subjectIcon(row.subject_id)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-stone-900">{subjectName(row.subject_id)}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${MODE_COLOR[row.mode] ?? 'bg-stone-100 text-stone-600'}`}>
                          {MODE_LABEL[row.mode] ?? row.mode}
                        </span>
                      </div>
                      {row.topic && (
                        <p className="text-xs text-stone-400 truncate mt-0.5">{row.topic}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {score && <p className="text-sm font-bold text-stone-700">{score}</p>}
                      <p className="text-xs text-stone-400">{formatDate(row.session_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
