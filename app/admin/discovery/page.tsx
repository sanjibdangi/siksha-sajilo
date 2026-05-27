'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const ADMIN_SECRET_KEY = 'siksha_admin_secret'

const STATUS_TABS = [
  { key: 'pending', label: 'Pending review', color: 'text-amber-700' },
  { key: 'ingested', label: 'Ingested', color: 'text-green-700' },
  { key: 'rejected', label: 'Rejected', color: 'text-stone-500' },
]

const CONTENT_TYPE_LABELS: Record<string, string> = {
  past_paper: 'Past Paper',
  model_question: 'Model Question',
  notes: 'Notes',
  textbook: 'Textbook',
  marking_scheme: 'Marking Scheme',
  article: 'Article',
}

const SUBJECT_LABELS: Record<string, string> = {
  mathematics: 'Math',
  science: 'Science',
  english: 'English',
  nepali: 'Nepali',
  social: 'Social',
  optmath: 'Opt. Math',
}

interface QueueItem {
  id: string
  source_url: string
  source_site: string
  detected_title: string
  detected_grade: string | null
  detected_subject: string | null
  detected_year_bs: number | null
  content_type: string
  word_count: number
  quality_score: number
  quality_notes: string
  status: string
  discovered_at: string
}

interface DiscoveryRun {
  ran_at: string
  sources_checked: number
  new_found: number
  errors: number
  summary: string
}

interface StatusCounts {
  pending?: number
  ingested?: number
  rejected?: number
}

export default function DiscoveryPage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)

  const [activeTab, setActiveTab] = useState('pending')
  const [items, setItems] = useState<QueueItem[]>([])
  const [runs, setRuns] = useState<DiscoveryRun[]>([])
  const [counts, setCounts] = useState<StatusCounts>({})
  const [loading, setLoading] = useState(false)

  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerResult, setTriggerResult] = useState<string | null>(null)

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

  const loadQueue = useCallback(async (tab: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/discovery?status=${tab}`, { headers: adminHeaders() })
      const data = await res.json()
      setItems(data.items ?? [])
      setRuns(data.recentRuns ?? [])
      setCounts(data.counts ?? {})
    } finally {
      setLoading(false)
    }
  }, [adminHeaders])

  useEffect(() => {
    if (authed) loadQueue(activeTab)
  }, [authed, activeTab, loadQueue])

  const handleLogin = async () => {
    const res = await fetch('/api/admin/usage-stats', { headers: { 'x-admin-secret': secret } })
    if (!res.ok) { alert('Invalid admin secret.'); return }
    sessionStorage.setItem(ADMIN_SECRET_KEY, secret)
    setAuthed(true)
  }

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id + action)
    try {
      await fetch('/api/admin/discovery', {
        method: 'PATCH',
        headers: adminHeaders(),
        body: JSON.stringify({ id, action }),
      })
      setItems((prev) => prev.filter((i) => i.id !== id))
      setCounts((prev) => ({
        ...prev,
        pending: Math.max(0, (prev.pending ?? 0) - 1),
        ...(action === 'approve' ? { ingested: (prev.ingested ?? 0) + 1 } : { rejected: (prev.rejected ?? 0) + 1 }),
      }))
    } finally {
      setActionLoading(null)
    }
  }

  const handleTrigger = async () => {
    setTriggerLoading(true)
    setTriggerResult(null)
    try {
      const res = await fetch('/api/admin/discovery', {
        method: 'POST',
        headers: adminHeaders(),
      })
      const data = await res.json()
      setTriggerResult(data.summary ?? `Found ${data.newFound} new items`)
      await loadQueue(activeTab)
    } catch (err) {
      setTriggerResult(err instanceof Error ? err.message : 'Failed')
    } finally {
      setTriggerLoading(false)
    }
  }

  const handleApproveAll = async () => {
    const pending = items.filter(i => i.status === 'pending' && i.quality_score >= 7)
    for (const item of pending) {
      await handleAction(item.id, 'approve')
    }
  }

  if (checking) return <div className="min-h-screen bg-stone-50" />

  if (!authed) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 w-full max-w-sm space-y-4">
          <h1 className="text-lg font-bold text-stone-900">Admin Access</h1>
          <input type="password" placeholder="Admin secret" value={secret}
            onChange={e => setSecret(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500" />
          <button onClick={handleLogin} className="w-full bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700">Sign in</button>
          <button onClick={() => router.push('/admin')} className="w-full text-stone-500 text-sm hover:text-stone-700">Back to admin</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Auto-Discovery</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Weekly crawler finds new Nepal education content automatically — review and approve to add to RAG
          </p>
        </div>
        <button onClick={() => router.push('/admin')} className="text-sm text-stone-500 hover:text-stone-700 border border-stone-200 rounded-xl px-4 py-2 shrink-0">
          Back to admin
        </button>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <h2 className="font-semibold text-stone-900 mb-3">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs text-stone-600">
          {[
            { step: '1', label: 'Weekly cron', desc: 'Every Monday 3 AM, crawler visits 6 Nepal education sites' },
            { step: '2', label: 'Claude scans', desc: 'Claude reads each page and identifies new curriculum content links' },
            { step: '3', label: 'Fetch & assess', desc: 'Downloads content, scores relevance 1-10, extracts grade/subject/year' },
            { step: '4', label: 'Review queue', desc: 'New items appear here — you see title, source, quality score, content preview' },
            { step: '5', label: 'One-click ingest', desc: 'Approve → instantly embedded and added to RAG. Reject → never shown again' },
          ].map(s => (
            <div key={s.step} className="flex gap-2 p-3 bg-stone-50 rounded-xl">
              <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{s.step}</span>
              <div>
                <p className="font-semibold text-stone-700">{s.label}</p>
                <p className="text-stone-500 mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent runs + manual trigger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-900">Discovery runs</h2>
            <button onClick={handleTrigger} disabled={triggerLoading}
              className="text-sm bg-stone-800 text-white rounded-xl px-4 py-2 hover:bg-stone-900 disabled:opacity-50">
              {triggerLoading ? 'Running...' : 'Run now'}
            </button>
          </div>
          {triggerResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
              {triggerResult}
            </div>
          )}
          {runs.length === 0 && <p className="text-sm text-stone-400">No runs yet — click &quot;Run now&quot; to start the first discovery crawl.</p>}
          {runs.map((r, i) => (
            <div key={i} className="p-3 rounded-xl bg-stone-50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-500">{new Date(r.ran_at).toLocaleString()}</span>
                <span className="text-xs font-medium text-green-700">+{r.new_found} new</span>
              </div>
              <p className="text-xs text-stone-600">{r.summary}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-stone-900">Queue summary</h2>
          <div className="grid grid-cols-3 gap-3">
            {STATUS_TABS.map(tab => (
              <div key={tab.key} className="rounded-xl bg-stone-50 p-3 text-center">
                <div className={`text-2xl font-bold ${tab.color}`}>{counts[tab.key as keyof StatusCounts] ?? 0}</div>
                <div className="text-xs text-stone-500 mt-0.5">{tab.label}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-stone-400 pt-1 border-t border-stone-100">
            Items with quality score ≥ 7 are safe to bulk approve.
            Items scored 6 are borderline — review content before approving.
            Items below 6 are not queued at all.
          </div>
        </div>
      </div>

      {/* Queue tabs */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-stone-100">
          {STATUS_TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={[
                'px-5 py-3 text-sm font-medium transition-colors',
                activeTab === tab.key ? 'border-b-2 border-green-600 text-green-700' : 'text-stone-500 hover:text-stone-700',
              ].join(' ')}>
              {tab.label}
              <span className="ml-1.5 text-xs bg-stone-100 text-stone-500 rounded-full px-1.5 py-0.5">
                {counts[tab.key as keyof StatusCounts] ?? 0}
              </span>
            </button>
          ))}
          {activeTab === 'pending' && items.filter(i => i.quality_score >= 7).length > 1 && (
            <button onClick={handleApproveAll}
              className="ml-auto mr-4 my-2 text-xs bg-green-600 text-white rounded-lg px-3 py-1.5 hover:bg-green-700">
              Approve all high-quality ({items.filter(i => i.quality_score >= 7).length})
            </button>
          )}
        </div>

        {loading && <div className="p-8 text-center text-sm text-stone-400">Loading...</div>}

        {!loading && items.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-stone-500 text-sm">
              {activeTab === 'pending'
                ? 'No pending items. Run the discovery crawler to find new content.'
                : `No ${activeTab} items yet.`}
            </p>
          </div>
        )}

        <div className="divide-y divide-stone-50">
          {items.map((item) => (
            <div key={item.id} className="p-4 hover:bg-stone-50 transition-colors">
              <div className="flex items-start gap-4">
                {/* Quality score */}
                <div className={[
                  'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0',
                  item.quality_score >= 8 ? 'bg-green-100 text-green-700' :
                  item.quality_score >= 6 ? 'bg-amber-100 text-amber-700' :
                  'bg-stone-100 text-stone-500',
                ].join(' ')}>
                  {item.quality_score}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <a href={item.source_url} target="_blank" rel="noreferrer"
                        className="text-sm font-semibold text-stone-800 hover:text-green-700 truncate block">
                        {item.detected_title || item.source_url} ↗
                      </a>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-stone-400">{item.source_site}</span>
                        {item.detected_grade && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            {item.detected_grade === 'SEE Prep' ? 'SEE' : `Class ${item.detected_grade}`}
                          </span>
                        )}
                        {item.detected_subject && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                            {SUBJECT_LABELS[item.detected_subject] ?? item.detected_subject}
                          </span>
                        )}
                        {item.detected_year_bs && (
                          <span className="text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full">
                            {item.detected_year_bs} BS
                          </span>
                        )}
                        <span className="text-xs text-stone-400">
                          {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
                        </span>
                        <span className="text-xs text-stone-400">{item.word_count?.toLocaleString()} words</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {activeTab === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleAction(item.id, 'approve')}
                          disabled={actionLoading === item.id + 'approve'}
                          className="text-xs bg-green-600 text-white rounded-lg px-3 py-1.5 hover:bg-green-700 disabled:opacity-50">
                          {actionLoading === item.id + 'approve' ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleAction(item.id, 'reject')}
                          disabled={actionLoading === item.id + 'reject'}
                          className="text-xs border border-stone-200 text-stone-600 rounded-lg px-3 py-1.5 hover:bg-stone-50 disabled:opacity-50">
                          {actionLoading === item.id + 'reject' ? '...' : 'Reject'}
                        </button>
                      </div>
                    )}
                  </div>

                  {item.quality_notes && (
                    <p className="text-xs text-stone-500 mt-1.5 italic">{item.quality_notes}</p>
                  )}

                  <p className="text-xs text-stone-400 mt-1">
                    Discovered {new Date(item.discovered_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
