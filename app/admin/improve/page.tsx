'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const ADMIN_SECRET_KEY = 'siksha_admin_secret'

const SUBJECT_NAMES: Record<string, string> = {
  mathematics: 'Mathematics', science: 'Science', english: 'English',
  nepali: 'Nepali', social: 'Social Studies', hpe: 'HPE',
  optmath: 'Optional Maths', computer: 'Computer', account: 'Account', economics: 'Economics',
}
const SUBJECT_ICONS: Record<string, string> = {
  mathematics: '📐', science: '🔬', english: '📖',
  nepali: '🇳🇵', social: '🌏', hpe: '🏃',
  optmath: '∑', computer: '💻', account: '📊', economics: '📈',
}

interface Improvement {
  id: string
  year_bs: number
  subject_id: string
  grade: string
  topic: string
  diagnosis: string
  teaching_note: string
  failure_count: number
  satisfaction_pct: number
  status: string
  created_at: string
}

function StatusPill({ status }: { status: string }) {
  if (status === 'approved') return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Approved</span>
  if (status === 'rejected') return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Rejected</span>
  return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 animate-pulse">Pending review</span>
}

export default function ImprovePage() {
  const adminSecret = typeof window !== 'undefined' ? sessionStorage.getItem(ADMIN_SECRET_KEY) : null

  const [improvements, setImprovements] = useState<Improvement[]>([])
  const [yearBs, setYearBs]             = useState<number | null>(null)
  const [loading, setLoading]           = useState(true)
  const [analyzing, setAnalyzing]       = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<string | null>(null)
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [acting, setActing]             = useState<string | null>(null)

  // Year rollover state
  const [showYearUpdate, setShowYearUpdate] = useState(false)
  const [newYear, setNewYear]               = useState('')
  const [yearUpdating, setYearUpdating]     = useState(false)
  const [yearMsg, setYearMsg]               = useState('')

  useEffect(() => { if (adminSecret) load() }, [adminSecret]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    try {
      const [impRes, yearRes] = await Promise.all([
        fetch('/api/sources/analyze', { headers: { 'x-admin-secret': adminSecret! } }),
        fetch('/api/admin/year', { headers: { 'x-admin-secret': adminSecret! } }),
      ])
      const impData = await impRes.json()
      const yearData = await yearRes.json()
      setImprovements(impData.improvements ?? [])
      setYearBs(yearData.current_year_bs ?? null)
    } finally {
      setLoading(false)
    }
  }

  async function runAnalysis() {
    setAnalyzing(true)
    setAnalyzeResult(null)
    try {
      const res = await fetch('/api/sources/analyze', {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret! },
      })
      const data = await res.json()
      if (data.error) { setAnalyzeResult(`Error: ${data.error}`); return }
      if (data.analyzed === 0) { setAnalyzeResult(data.message ?? 'No gaps found.'); return }
      setAnalyzeResult(`Generated ${data.analyzed} improvement${data.analyzed !== 1 ? 's' : ''} for review.`)
      await load()
    } finally {
      setAnalyzing(false)
    }
  }

  async function act(id: string, action: 'approve' | 'reject') {
    setActing(id)
    try {
      await fetch('/api/sources/analyze', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret! },
        body: JSON.stringify({ id, action }),
      })
      setImprovements(prev => prev.map(i => i.id === id ? { ...i, status: action === 'approve' ? 'approved' : 'rejected' } : i))
    } finally {
      setActing(null)
    }
  }

  async function updateYear() {
    const y = parseInt(newYear)
    if (!y || y < 2080 || y > 2120) { setYearMsg('Enter a valid BS year (e.g. 2083)'); return }
    setYearUpdating(true)
    setYearMsg('')
    try {
      const res = await fetch('/api/admin/year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret! },
        body: JSON.stringify({ year_bs: y }),
      })
      const data = await res.json()
      if (data.ok) {
        setYearBs(y)
        setYearMsg(data.message)
        setShowYearUpdate(false)
        setNewYear('')
      } else {
        setYearMsg(data.error ?? 'Update failed')
      }
    } finally {
      setYearUpdating(false)
    }
  }

  if (!adminSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-600">Session expired.</p>
          <Link href="/admin" className="text-indigo-600 hover:underline text-sm">Back to admin login</Link>
        </div>
      </div>
    )
  }

  const pending  = improvements.filter(i => i.status === 'pending')
  const approved = improvements.filter(i => i.status === 'approved')
  const rejected = improvements.filter(i => i.status === 'rejected')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
            <span className="text-gray-300">|</span>
            <span className="font-bold text-indigo-600">AI Self-Improvement</span>
          </div>

          {/* Active year badge */}
          {yearBs && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
                📅 {yearBs}–{yearBs + 1} BS
              </span>
              <button
                onClick={() => setShowYearUpdate(v => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Change year
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Year rollover panel */}
        {showYearUpdate && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
            <div>
              <p className="font-bold text-amber-900">Roll over to new academic year</p>
              <p className="text-xs text-amber-700 mt-1">
                This updates the active syllabus year across all students, RAG retrieval, feedback collection, and AI analysis.
                Make sure the new year&apos;s CDC syllabus is already ingested before switching.
              </p>
            </div>
            <div className="flex gap-3">
              <input
                type="number"
                value={newYear}
                onChange={e => setNewYear(e.target.value)}
                placeholder={`New year (e.g. ${(yearBs ?? 2082) + 1})`}
                className="flex-1 px-4 py-2.5 border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={updateYear}
                disabled={yearUpdating}
                className="px-5 py-2.5 bg-amber-600 text-white rounded-xl font-semibold text-sm hover:bg-amber-700 transition-colors disabled:opacity-60"
              >
                {yearUpdating ? 'Updating...' : `Switch to ${newYear || '???'}-${newYear ? parseInt(newYear) + 1 : '???'} BS`}
              </button>
            </div>
            {yearMsg && <p className="text-sm text-amber-800 font-medium">{yearMsg}</p>}
          </div>
        )}

        {/* Page intro */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">AI Self-Improvement Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            The system analyzes topics where students are confused and generates targeted teaching content.
            You review and approve before anything goes live.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">How the learning loop works</p>
          <div className="flex items-start gap-0 overflow-x-auto pb-1">
            {[
              { icon: '👎', label: 'Student clicks\n"Still confused"' },
              { icon: '→', label: '' },
              { icon: '📊', label: 'System detects\nlow satisfaction' },
              { icon: '→', label: '' },
              { icon: '🤖', label: 'Claude analyzes\nthe failure' },
              { icon: '→', label: '' },
              { icon: '📝', label: 'Generates better\nteaching content' },
              { icon: '→', label: '' },
              { icon: '✅', label: 'You approve\nit here' },
              { icon: '→', label: '' },
              { icon: '🚀', label: 'Goes live in\nknowledge base' },
            ].map((step, i) => (
              step.label === '' ? (
                <span key={i} className="text-gray-300 text-lg px-1 mt-3 shrink-0">→</span>
              ) : (
                <div key={i} className="flex flex-col items-center gap-1 px-2 shrink-0 min-w-[72px]">
                  <span className="text-xl">{step.icon}</span>
                  <p className="text-xs text-gray-500 text-center whitespace-pre-line leading-tight">{step.label}</p>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Trigger analysis */}
        <div className="flex items-center gap-4">
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className={[
              'flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-sm',
              analyzing
                ? 'bg-indigo-400 text-white cursor-wait'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99]',
            ].join(' ')}
          >
            {analyzing ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Analyzing gaps...
              </>
            ) : (
              <>🧠 Run gap analysis now</>
            )}
          </button>
          <p className="text-xs text-gray-400">
            Analyzes topics with 3+ failures and below 70% satisfaction for {yearBs}–{(yearBs ?? 2082) + 1} BS
          </p>
        </div>

        {analyzeResult && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${analyzeResult.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {analyzeResult.startsWith('Error') ? '⚠️' : '✓'} {analyzeResult}
          </div>
        )}

        {/* Pending */}
        {!loading && pending.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-gray-900">Pending Review</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{pending.length}</span>
            </div>
            {pending.map(item => (
              <ImprovementCard
                key={item.id}
                item={item}
                expanded={expanded === item.id}
                acting={acting === item.id}
                onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
                onApprove={() => act(item.id, 'approve')}
                onReject={() => act(item.id, 'reject')}
              />
            ))}
          </section>
        )}

        {/* Approved */}
        {!loading && approved.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-gray-900">Approved & Live</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">{approved.length}</span>
            </div>
            {approved.map(item => (
              <ImprovementCard
                key={item.id}
                item={item}
                expanded={expanded === item.id}
                acting={false}
                onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
              />
            ))}
          </section>
        )}

        {/* Rejected */}
        {!loading && rejected.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-gray-900">Rejected</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">{rejected.length}</span>
            </div>
            {rejected.map(item => (
              <ImprovementCard
                key={item.id}
                item={item}
                expanded={expanded === item.id}
                acting={false}
                onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
              />
            ))}
          </section>
        )}

        {/* Empty state */}
        {!loading && improvements.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
            <p className="text-3xl">🤖</p>
            <p className="font-semibold text-gray-700">No improvements generated yet</p>
            <p className="text-sm text-gray-400 max-w-sm mx-auto">
              Click &quot;Run gap analysis now&quot; to scan for topics where students are consistently
              confused. The AI will generate teaching content to fill those gaps.
            </p>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse space-y-3">
                <div className="flex gap-3"><div className="h-4 bg-gray-200 rounded w-24" /><div className="h-4 bg-gray-200 rounded w-32" /></div>
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ImprovementCard({
  item,
  expanded,
  acting,
  onToggle,
  onApprove,
  onReject,
}: {
  item: Improvement
  expanded: boolean
  acting: boolean
  onToggle: () => void
  onApprove?: () => void
  onReject?: () => void
}) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${item.status === 'pending' ? 'border-amber-200' : item.status === 'approved' ? 'border-green-200' : 'border-gray-200'}`}>
      {/* Header */}
      <button onClick={onToggle} className="w-full flex items-start gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors">
        <span className="text-2xl shrink-0 mt-0.5">{SUBJECT_ICONS[item.subject_id] ?? '📚'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900">{item.topic}</p>
            <StatusPill status={item.status} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {SUBJECT_NAMES[item.subject_id] ?? item.subject_id} · {item.grade === 'SEE Prep' ? 'SEE Prep' : `Class ${item.grade}`} · {item.year_bs}–{item.year_bs + 1} BS
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {item.failure_count} confused students · {item.satisfaction_pct}% satisfaction when analyzed
          </p>
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          {/* Diagnosis */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Claude&apos;s Diagnosis</p>
            <p className="text-sm text-gray-700 leading-relaxed bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              {item.diagnosis}
            </p>
          </div>

          {/* Teaching note */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Generated Teaching Note</p>
            <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 max-h-64 overflow-y-auto whitespace-pre-wrap">
              {item.teaching_note}
            </div>
          </div>

          {/* Actions for pending items */}
          {item.status === 'pending' && onApprove && onReject && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={onApprove}
                disabled={acting}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-60 active:scale-[0.99]"
              >
                {acting ? 'Saving...' : '✓ Approve & add to knowledge base'}
              </button>
              <button
                onClick={onReject}
                disabled={acting}
                className="px-5 py-3 rounded-xl border-2 border-red-200 text-red-600 font-semibold text-sm hover:border-red-400 hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          )}

          {item.status === 'approved' && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              This teaching note is live in the knowledge base. Future students asking about this topic will benefit from it.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
