'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const ADMIN_SECRET_KEY = 'siksha_admin_secret'

const SUBJECT_NAMES: Record<string, string> = {
  mathematics: 'Mathematics',
  science: 'Science',
  english: 'English',
  nepali: 'Nepali',
  social: 'Social Studies',
  hpe: 'HPE',
  optmath: 'Optional Maths',
  computer: 'Computer',
  account: 'Account',
  economics: 'Economics',
}

const SUBJECT_ICONS: Record<string, string> = {
  mathematics: '📐',
  science: '🔬',
  english: '📖',
  nepali: '🇳🇵',
  social: '🌏',
  hpe: '🏃',
  optmath: '∑',
  computer: '💻',
  account: '📊',
  economics: '📈',
}

interface Insight {
  subject_id: string
  grade: string
  topic: string
  total: number
  positive: number
  recent: number
  satisfaction: number
}

interface Summary {
  totalRatings: number
  overallSatisfaction: number | null
  ratingsThisWeek: number
  lowRatedTopics: number
}

function SatisfactionBar({ pct }: { pct: number }) {
  const color = pct < 50 ? 'bg-red-400' : pct < 70 ? 'bg-amber-400' : pct < 85 ? 'bg-blue-400' : 'bg-green-400'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[60px]">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-8 text-right tabular-nums">{pct}%</span>
    </div>
  )
}

export default function InsightsPage() {
  const [adminSecret, setAdminSecret] = useState<string | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [gradeFilter, setGradeFilter] = useState('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'satisfaction' | 'total' | 'recent'>('satisfaction')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<string | null>(null)

  useEffect(() => {
    const s = sessionStorage.getItem(ADMIN_SECRET_KEY)
    if (s) setAdminSecret(s)
  }, [])

  useEffect(() => {
    if (!adminSecret) return
    setLoading(true)
    fetch('/api/feedback', { headers: { 'x-admin-secret': adminSecret } })
      .then(r => r.json())
      .then(data => {
        setInsights(data.insights ?? [])
        setSummary(data.summary ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [adminSecret])

  async function runAnalysis() {
    if (!adminSecret || analyzing) return
    setAnalyzing(true)
    setAnalyzeResult(null)
    try {
      const res = await fetch('/api/sources/analyze', {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
      })
      const data = await res.json()
      if (data.analyzed === 0) {
        setAnalyzeResult(data.message ?? 'No topics need analysis right now.')
      } else {
        setAnalyzeResult(`Generated ${data.analyzed} teaching note${data.analyzed !== 1 ? 's' : ''}. Review them in AI Self-Improvement.`)
      }
    } catch {
      setAnalyzeResult('Analysis failed. Check the console.')
    } finally {
      setAnalyzing(false)
    }
  }

  if (!adminSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-gray-600">Session expired.</p>
          <Link href="/admin" className="text-indigo-600 hover:underline text-sm">
            Back to admin login
          </Link>
        </div>
      </div>
    )
  }

  const filtered = insights
    .filter(i => gradeFilter === 'all' || i.grade === gradeFilter)
    .filter(i => subjectFilter === 'all' || i.subject_id === subjectFilter)
    .sort((a, b) => {
      if (sortBy === 'satisfaction') return a.satisfaction - b.satisfaction
      if (sortBy === 'total') return b.total - a.total
      return b.recent - a.recent
    })

  const criticalCount = filtered.filter(i => i.satisfaction < 50).length
  const needsWorkCount = filtered.filter(i => i.satisfaction >= 50 && i.satisfaction < 70).length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Admin
            </Link>
            <span className="text-gray-300">|</span>
            <span className="font-bold text-indigo-600">Knowledge Insights</span>
          </div>
          <p className="text-xs text-gray-400 hidden sm:block">
            Where students need better sources
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Page title */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Knowledge Gap Analysis</h1>
            <p className="text-sm text-gray-500 mt-1">
              Topics where students clicked &quot;Still confused&quot; — sorted by lowest satisfaction first.
              Add better sources to the topics at the top.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {analyzing ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing…
                </>
              ) : (
                <>🧠 Analyze gaps</>
              )}
            </button>
            {analyzeResult && (
              <p className="text-xs text-gray-500 max-w-xs text-right">{analyzeResult}</p>
            )}
            {analyzeResult && analyzeResult.includes('teaching note') && (
              <Link href="/admin/improve" className="text-xs text-purple-600 hover:underline">
                Review in AI Self-Improvement →
              </Link>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: 'Total ratings',
              value: loading ? null : (summary?.totalRatings ?? 0),
              sub: 'all time',
              color: 'text-gray-900',
            },
            {
              label: 'Overall satisfaction',
              value: loading ? null : (summary?.overallSatisfaction != null ? `${summary.overallSatisfaction}%` : '—'),
              sub: 'yes / total',
              color: summary?.overallSatisfaction != null && summary.overallSatisfaction >= 70 ? 'text-green-700' : 'text-red-600',
            },
            {
              label: 'Ratings this week',
              value: loading ? null : (summary?.ratingsThisWeek ?? 0),
              sub: 'last 7 days',
              color: 'text-indigo-700',
            },
            {
              label: 'Topics below 60%',
              value: loading ? null : (summary?.lowRatedTopics ?? 0),
              sub: 'need attention',
              color: (summary?.lowRatedTopics ?? 0) > 0 ? 'text-red-600' : 'text-green-700',
            },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className={`text-2xl font-black ${card.color}`}>
                {loading
                  ? <span className="animate-pulse bg-gray-200 rounded h-7 w-12 inline-block" />
                  : card.value}
              </p>
              <p className="text-xs font-semibold text-gray-600 mt-1">{card.label}</p>
              <p className="text-xs text-gray-400">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Alert banner for critical topics */}
        {!loading && criticalCount > 0 && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <span className="text-red-500 text-xl shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-bold text-red-800">
                {criticalCount} topic{criticalCount !== 1 ? 's' : ''} below 50% satisfaction
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                These topics urgently need better YouTube sources or supplementary material.
                Students are consistently not understanding the AI&apos;s explanations here.
              </p>
            </div>
          </div>
        )}

        {!loading && needsWorkCount > 0 && criticalCount === 0 && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="text-amber-500 text-xl shrink-0">💡</span>
            <div>
              <p className="text-sm font-bold text-amber-800">
                {needsWorkCount} topic{needsWorkCount !== 1 ? 's' : ''} between 50–70% satisfaction
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Adding YouTube sources for these topics will improve student understanding significantly.
              </p>
            </div>
          </div>
        )}

        {/* Filters + sort */}
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All grades</option>
            <option value="9">Class 9</option>
            <option value="10">Class 10</option>
            <option value="SEE Prep">SEE Prep</option>
          </select>

          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All subjects</option>
            {Object.entries(SUBJECT_NAMES).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400">Sort by:</span>
            {(['satisfaction', 'total', 'recent'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  sortBy === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300',
                ].join(' ')}
              >
                {s === 'satisfaction' ? 'Lowest first' : s === 'total' ? 'Most rated' : 'Recent'}
              </button>
            ))}
          </div>
        </div>

        {/* Main table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="h-4 bg-gray-200 rounded w-16" />
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded flex-1" />
                  <div className="h-4 bg-gray-200 rounded w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
            <p className="text-3xl">📊</p>
            <p className="font-semibold text-gray-700">No feedback data yet</p>
            <p className="text-sm text-gray-400 max-w-sm mx-auto">
              Students will see &quot;Did this help?&quot; after every AI response in the tutor and solve modes.
              Come back here after a few days of student activity to see which topics need better sources.
            </p>
            <p className="text-xs text-gray-300 mt-2">Topics need at least 5 ratings to appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Table header */}
            <div className="grid grid-cols-[80px_140px_1fr_90px_200px_120px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Grade</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Topic</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ratings</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Satisfaction</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</span>
            </div>

            {/* Rows */}
            {filtered.map((item, idx) => (
              <div
                key={idx}
                className={[
                  'grid grid-cols-[80px_140px_1fr_90px_200px_120px] gap-4 px-5 py-4 items-center',
                  'border-b border-gray-50 hover:bg-gray-50/50 transition-colors',
                  item.satisfaction < 50 ? 'bg-red-50/30' : item.satisfaction < 70 ? 'bg-amber-50/20' : '',
                ].join(' ')}
              >
                {/* Grade */}
                <span className="text-sm font-semibold text-gray-700">
                  {item.grade === 'SEE Prep' ? 'SEE' : `Class ${item.grade}`}
                </span>

                {/* Subject */}
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{SUBJECT_ICONS[item.subject_id] ?? '📚'}</span>
                  <span className="text-sm text-gray-700 font-medium">
                    {SUBJECT_NAMES[item.subject_id] ?? item.subject_id}
                  </span>
                </div>

                {/* Topic */}
                <div>
                  <span className="text-sm text-gray-800 font-medium leading-snug">{item.topic}</span>
                  {item.recent > 0 && (
                    <span className="ml-2 text-xs text-indigo-500 font-medium">+{item.recent} this week</span>
                  )}
                </div>

                {/* Ratings count */}
                <span className="text-sm text-gray-500 tabular-nums">{item.total}</span>

                {/* Satisfaction bar */}
                <SatisfactionBar pct={item.satisfaction} />

                {/* Action */}
                <div>
                  {item.satisfaction < 70 ? (
                    <Link
                      href={`/admin/sources?grade=${encodeURIComponent(item.grade)}&subject=${item.subject_id}&topic=${encodeURIComponent(item.topic)}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add source
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Looks good
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Footer note */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Showing {filtered.length} topic{filtered.length !== 1 ? 's' : ''} with 5+ ratings.
                &quot;Add source&quot; links to the YouTube knowledge base — coming soon.
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400 inline-block" />
              Below 50% — Add sources urgently
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
              50–70% — Needs improvement
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />
              70–85% — Good
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
              Above 85% — Strong
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
