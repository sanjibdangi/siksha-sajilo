'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

const ADMIN_SECRET_KEY = 'siksha_admin_secret'
const BATCH_SIZE = 5

const SUBJECTS = [
  { id: 'mathematics', name: 'Mathematics' },
  { id: 'science',     name: 'Science' },
  { id: 'english',     name: 'English' },
  { id: 'nepali',      name: 'Nepali' },
  { id: 'social',      name: 'Social Studies' },
  { id: 'hpe',         name: 'HPE' },
  { id: 'optmath',     name: 'Optional Mathematics' },
  { id: 'computer',    name: 'Computer Science' },
  { id: 'account',     name: 'Account' },
  { id: 'economics',   name: 'Economics' },
]
const GRADES = ['9', '10', 'SEE Prep']

interface TopicRow {
  id: string
  unitNo: number
  unitTitle: string
  chapterNo: number
  chapterTitle: string
  topic: string
  objectives: string[]
  marksWeight: number
}

interface GenerationResult {
  topic: string
  status: 'done' | 'error'
  error?: string
}

export default function AiKnowledgePage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)

  const [grade, setGrade] = useState('10')
  const [subjectId, setSubjectId] = useState('mathematics')
  const [yearBs, setYearBs] = useState('2083')

  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [done, setDone] = useState(0)
  const [pending, setPending] = useState<TopicRow[]>([])
  const [results, setResults] = useState<GenerationResult[]>([])
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const stopRef = useRef(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_SECRET_KEY)
    if (!stored) { setChecking(false); return }
    fetch('/api/admin/usage-stats', { headers: { 'x-admin-secret': stored } })
      .then(r => {
        if (r.ok) { setSecret(stored); setAuthed(true) }
        else sessionStorage.removeItem(ADMIN_SECRET_KEY)
      })
      .catch(() => sessionStorage.removeItem(ADMIN_SECRET_KEY))
      .finally(() => setChecking(false))
  }, [])

  const adminHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'x-admin-secret': secret,
  }), [secret])

  const handleLogin = async () => {
    const res = await fetch('/api/admin/usage-stats', { headers: { 'x-admin-secret': secret } })
    if (!res.ok) { alert('Invalid admin secret.'); return }
    sessionStorage.setItem(ADMIN_SECRET_KEY, secret)
    setAuthed(true)
  }

  const loadTopics = useCallback(async () => {
    setLoading(true)
    setResults([])
    setFinished(false)
    try {
      const res = await fetch(
        `/api/admin/ai-knowledge?grade=${encodeURIComponent(grade)}&subjectId=${subjectId}&yearBs=${yearBs}`,
        { headers: adminHeaders() }
      )
      const data = await res.json()
      setTotal(data.total ?? 0)
      setDone(data.done ?? 0)
      setPending(data.pending ?? [])
    } finally {
      setLoading(false)
    }
  }, [grade, subjectId, yearBs, adminHeaders])

  const runGeneration = async () => {
    if (!pending.length) return
    setRunning(true)
    stopRef.current = false
    setFinished(false)

    let remaining = [...pending]

    while (remaining.length > 0 && !stopRef.current) {
      const batch = remaining.slice(0, BATCH_SIZE)
      remaining = remaining.slice(BATCH_SIZE)

      try {
        const res = await fetch('/api/admin/ai-knowledge', {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({
            topicIds: batch.map((t) => t.id),
            grade,
            subjectId,
            yearBs: parseInt(yearBs),
          }),
        })
        const data = await res.json()
        const batchResults: GenerationResult[] = data.results ?? []
        setResults((prev) => [...prev, ...batchResults])
        const successCount = batchResults.filter((r) => r.status === 'done').length
        setDone((prev) => prev + successCount)
        setPending((prev) => prev.slice(batch.length))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Request failed'
        setResults((prev) => [...prev, ...batch.map((t) => ({ topic: t.topic, status: 'error' as const, error: msg }))])
        setPending((prev) => prev.slice(batch.length))
      }
    }

    setRunning(false)
    setFinished(!stopRef.current)
  }

  const handleStop = () => {
    stopRef.current = true
    setRunning(false)
  }

  if (checking) return <div className="min-h-screen bg-stone-50" />

  if (!authed) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 w-full max-w-sm space-y-4">
          <h1 className="text-lg font-bold text-stone-900">Admin Access</h1>
          <input
            type="password"
            placeholder="Admin secret"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500"
          />
          <button onClick={handleLogin} className="w-full bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700">
            Sign in
          </button>
          <button onClick={() => router.push('/admin')} className="w-full text-stone-500 text-sm hover:text-stone-700">
            Back to admin
          </button>
        </div>
      </div>
    )
  }

  const successCount = results.filter((r) => r.status === 'done').length
  const errorCount = results.filter((r) => r.status === 'error').length
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="min-h-screen bg-stone-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">AI Knowledge Generator</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Uses Claude to write curriculum-aligned explanations for every syllabus topic and stores them in RAG
          </p>
        </div>
        <button onClick={() => router.push('/admin')} className="text-sm text-stone-500 hover:text-stone-700 border border-stone-200 rounded-xl px-4 py-2">
          Back to admin
        </button>
      </div>

      {/* Selector */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-stone-900">Select Curriculum</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Grade</label>
            <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500">
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Subject</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500">
              {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Year BS</label>
            <input value={yearBs} onChange={e => setYearBs(e.target.value)} className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>

        <button
          onClick={loadTopics}
          disabled={loading || running}
          className="bg-stone-800 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-stone-900 disabled:opacity-50"
        >
          {loading ? 'Loading topics...' : 'Load Topics'}
        </button>
      </div>

      {/* Status */}
      {total > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-900">
              {SUBJECTS.find(s => s.id === subjectId)?.name} — {grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`}
            </h2>
            <span className="text-sm text-stone-500">{done} / {total} topics done ({progressPct}%)</span>
          </div>

          <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3 bg-green-50 text-center">
              <div className="text-2xl font-bold text-green-700">{done}</div>
              <div className="text-xs text-green-600 mt-0.5">Generated</div>
            </div>
            <div className="rounded-xl p-3 bg-amber-50 text-center">
              <div className="text-2xl font-bold text-amber-700">{pending.length}</div>
              <div className="text-xs text-amber-600 mt-0.5">Pending</div>
            </div>
            <div className="rounded-xl p-3 bg-stone-50 text-center">
              <div className="text-2xl font-bold text-stone-600">{total}</div>
              <div className="text-xs text-stone-500 mt-0.5">Total topics</div>
            </div>
          </div>

          {finished && pending.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 font-medium">
              All {done} topics generated. This subject is fully loaded into RAG.
            </div>
          )}

          <div className="flex gap-2">
            {!running && pending.length > 0 && (
              <button
                onClick={runGeneration}
                className="bg-green-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-green-700"
              >
                {done === 0 ? `Generate all ${pending.length} topics` : `Continue (${pending.length} remaining)`}
              </button>
            )}
            {running && (
              <button onClick={handleStop} className="bg-amber-500 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-amber-600">
                Pause
              </button>
            )}
            {!running && done > 0 && (
              <button onClick={loadTopics} className="border border-stone-200 text-stone-600 rounded-xl px-4 py-2 text-sm hover:bg-stone-50">
                Refresh status
              </button>
            )}
          </div>

          <p className="text-xs text-stone-400">
            Each topic is explained by Claude Haiku (fast, cheap). A full subject takes ~2-3 minutes.
            Cost is approximately $0.002 per topic.
          </p>
        </div>
      )}

      {/* Live results */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-800">This session</h3>
            <span className="text-xs text-stone-400">
              {successCount} done · {errorCount} errors
            </span>
          </div>
          <div className="divide-y divide-stone-50 max-h-80 overflow-y-auto">
            {[...results].reverse().map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'done' ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className="text-xs text-stone-700 flex-1 truncate">{r.topic}</span>
                {r.error && <span className="text-xs text-red-500 truncate max-w-48">{r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending topics preview */}
      {!running && pending.length > 0 && results.length === 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100">
            <h3 className="text-sm font-semibold text-stone-800">Topics to generate ({pending.length})</h3>
          </div>
          <div className="divide-y divide-stone-50 max-h-64 overflow-y-auto">
            {pending.map((t) => (
              <div key={t.id} className="flex items-start gap-3 px-5 py-2.5">
                <span className="w-2 h-2 rounded-full shrink-0 bg-stone-300 mt-1.5" />
                <div className="min-w-0">
                  <p className="text-xs text-stone-700 font-medium">{t.topic}</p>
                  <p className="text-xs text-stone-400">Ch.{t.chapterNo}: {t.chapterTitle} · {t.marksWeight} marks</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
