'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

const ADMIN_SECRET_KEY = 'siksha_admin_secret'
const SUBJECTS = ['mathematics', 'science', 'english', 'nepali', 'social', 'optmath']
const GRADES = ['9', '10', 'SEE Prep']

interface VideoRow {
  id: string
  video_id: string
  video_title: string
  video_url: string
  status: 'pending' | 'done' | 'skipped' | 'error'
  error_msg: string | null
}

interface JobStats {
  done: number
  skipped: number
  errors: number
  pending: number
  total: number
}

interface Job {
  id: string
  channel_url: string
  channel_handle: string | null
  grade: string
  subject_id: string
  year_bs: number
  total_videos: number
  status: string
  error_msg: string | null
  created_at: string
}

export default function ChannelIngestPage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)

  // New job form
  const [channelUrl, setChannelUrl] = useState('https://www.youtube.com/@GurukulNepal999/videos')
  const [channelHandle, setChannelHandle] = useState('GurukulNepal999')
  const [grade, setGrade] = useState('10')
  const [subjectId, setSubjectId] = useState('mathematics')
  const [yearBs, setYearBs] = useState('2083')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Job list
  const [jobs, setJobs] = useState<Job[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)

  // Selected job
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [jobStats, setJobStats] = useState<JobStats | null>(null)
  const [jobVideos, setJobVideos] = useState<VideoRow[]>([])
  const [processing, setProcessing] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const autoProcessRef = useRef(false)

  // Auth check on load
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

  const adminHeaders = useCallback(
    () => ({ 'Content-Type': 'application/json', 'x-admin-secret': secret }),
    [secret]
  )

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true)
    try {
      const res = await fetch('/api/admin/channel-ingest', { headers: adminHeaders() })
      const data = await res.json()
      setJobs(data.jobs ?? [])
    } finally {
      setLoadingJobs(false)
    }
  }, [adminHeaders])

  const loadJobDetail = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/admin/channel-ingest/${jobId}`, { headers: adminHeaders() })
    const data = await res.json()
    setJobStats(data.stats)
    setJobVideos(data.videos ?? [])
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...data.job } : j))
  }, [adminHeaders])

  useEffect(() => {
    if (authed) loadJobs()
  }, [authed, loadJobs])

  const handleLogin = async () => {
    const res = await fetch('/api/admin/usage-stats', { headers: { 'x-admin-secret': secret } })
    if (!res.ok) { alert('Invalid admin secret.'); return }
    sessionStorage.setItem(ADMIN_SECRET_KEY, secret)
    setAuthed(true)
    loadJobs()
  }

  const handleCreate = async () => {
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/channel-ingest', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ channelUrl, channelHandle, grade, subjectId, yearBs: parseInt(yearBs) }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error || 'Failed to create job'); return }
      await loadJobs()
      setSelectedJobId(data.jobId)
      await loadJobDetail(data.jobId)
    } finally {
      setCreating(false)
    }
  }

  const processBatch = useCallback(async (jobId: string): Promise<boolean> => {
    const res = await fetch(`/api/admin/channel-ingest/${jobId}`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ action: 'process' }),
    })
    const data = await res.json()
    await loadJobDetail(jobId)
    if (data.rateLimited) { setRateLimited(true); return false }
    return (data.remaining ?? 0) > 0
  }, [adminHeaders, loadJobDetail])

  const handleStartProcessing = async () => {
    if (!selectedJobId) return
    setProcessing(true)
    setRateLimited(false)
    autoProcessRef.current = true

    while (autoProcessRef.current) {
      const hasMore = await processBatch(selectedJobId)
      if (!hasMore || rateLimited) break
    }
    setProcessing(false)
  }

  const handleStopProcessing = () => {
    autoProcessRef.current = false
    setProcessing(false)
  }

  const handleReset = async () => {
    if (!selectedJobId) return
    await fetch(`/api/admin/channel-ingest/${selectedJobId}`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ action: 'reset' }),
    })
    setRateLimited(false)
    await loadJobDetail(selectedJobId)
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

  const selectedJob = jobs.find(j => j.id === selectedJobId)

  return (
    <div className="min-h-screen bg-stone-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">YouTube Channel Ingest</h1>
          <p className="text-sm text-stone-500 mt-0.5">Extract transcripts from YouTube channels for RAG</p>
        </div>
        <button onClick={() => router.push('/admin')} className="text-sm text-stone-500 hover:text-stone-700 border border-stone-200 rounded-xl px-4 py-2">
          Back to admin
        </button>
      </div>

      {/* Create job form */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-stone-900">New Channel Scan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-stone-600 mb-1 block">Channel URL</label>
            <input
              value={channelUrl}
              onChange={e => setChannelUrl(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
              placeholder="https://www.youtube.com/@ChannelName/videos"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Channel Handle (optional)</label>
            <input
              value={channelHandle}
              onChange={e => setChannelHandle(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
              placeholder="GurukulNepal999"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Year BS</label>
            <input
              value={yearBs}
              onChange={e => setYearBs(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
              placeholder="2083"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Grade</label>
            <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500">
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Subject</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500">
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {createError && <p className="text-sm text-red-600">{createError}</p>}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-green-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {creating ? 'Scanning channel...' : 'Scan Channel'}
        </button>
        <p className="text-xs text-stone-400">This fetches the full video list from the channel. Transcript extraction happens in the next step.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Job list */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-900 text-sm">Jobs</h2>
            <button onClick={loadJobs} className="text-xs text-stone-400 hover:text-stone-600">Refresh</button>
          </div>
          {loadingJobs && <p className="text-xs text-stone-400">Loading...</p>}
          {jobs.length === 0 && !loadingJobs && <p className="text-xs text-stone-400">No jobs yet.</p>}
          {jobs.map(job => (
            <button
              key={job.id}
              onClick={() => { setSelectedJobId(job.id); loadJobDetail(job.id) }}
              className={[
                'w-full text-left rounded-xl p-3 border transition-colors',
                selectedJobId === job.id ? 'border-green-500 bg-green-50' : 'border-stone-100 hover:border-stone-200',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-stone-800 truncate">{job.channel_handle || job.channel_url}</p>
                <StatusBadge status={job.status} />
              </div>
              <p className="text-xs text-stone-400 mt-0.5">{job.subject_id} · {job.grade} · {job.year_bs}</p>
              <p className="text-xs text-stone-400">{job.total_videos} videos</p>
            </button>
          ))}
        </div>

        {/* Job detail */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedJob ? (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 text-center text-stone-400 text-sm">
              Select a job to view details
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-stone-900">{selectedJob.channel_handle || 'Channel'}</h2>
                    <p className="text-xs text-stone-400 mt-0.5">{selectedJob.channel_url}</p>
                  </div>
                  <StatusBadge status={selectedJob.status} />
                </div>

                {jobStats && (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Done', value: jobStats.done, color: 'text-green-700 bg-green-50' },
                      { label: 'Pending', value: jobStats.pending, color: 'text-amber-700 bg-amber-50' },
                      { label: 'Skipped', value: jobStats.skipped, color: 'text-stone-500 bg-stone-50' },
                      { label: 'Errors', value: jobStats.errors, color: 'text-red-700 bg-red-50' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
                        <div className="text-xl font-bold">{s.value}</div>
                        <div className="text-xs mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {jobStats && jobStats.total > 0 && (
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${((jobStats.done + jobStats.skipped) / jobStats.total) * 100}%` }}
                    />
                  </div>
                )}

                {rateLimited && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                    YouTube rate limit hit. Wait a few minutes then click Resume.
                  </div>
                )}

                {selectedJob.error_msg && !rateLimited && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                    {selectedJob.error_msg}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {(selectedJob.status === 'paused' || selectedJob.status === 'completed') && !processing && (
                    <button
                      onClick={handleStartProcessing}
                      disabled={jobStats?.pending === 0}
                      className="bg-green-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-40"
                    >
                      {selectedJob.status === 'completed' ? 'All done' : 'Start / Resume'}
                    </button>
                  )}
                  {processing && (
                    <button onClick={handleStopProcessing} className="bg-amber-500 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-amber-600">
                      Pause
                    </button>
                  )}
                  {jobStats && jobStats.errors > 0 && (
                    <button onClick={handleReset} className="border border-stone-200 text-stone-600 rounded-xl px-4 py-2 text-sm hover:bg-stone-50">
                      Retry errors ({jobStats.errors})
                    </button>
                  )}
                  <button onClick={() => loadJobDetail(selectedJobId!)} className="border border-stone-200 text-stone-500 rounded-xl px-4 py-2 text-sm hover:bg-stone-50">
                    Refresh
                  </button>
                </div>
              </div>

              {/* Video list */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100">
                  <h3 className="text-sm font-semibold text-stone-800">Videos ({jobVideos.length})</h3>
                </div>
                <div className="divide-y divide-stone-50 max-h-96 overflow-y-auto">
                  {jobVideos.map(v => (
                    <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                      <VideoStatusDot status={v.status} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-stone-700 truncate">{v.video_title || v.video_id}</p>
                        {v.error_msg && <p className="text-xs text-red-500 truncate">{v.error_msg}</p>}
                      </div>
                      <a href={v.video_url} target="_blank" rel="noreferrer" className="text-xs text-stone-400 hover:text-green-600 shrink-0">
                        ↗
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-stone-100 text-stone-500',
    running: 'bg-blue-100 text-blue-700',
    paused: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${map[status] ?? 'bg-stone-100 text-stone-500'}`}>
      {status}
    </span>
  )
}

function VideoStatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-stone-300',
    done: 'bg-green-500',
    skipped: 'bg-stone-400',
    error: 'bg-red-500',
  }
  return <span className={`w-2 h-2 rounded-full shrink-0 ${map[status] ?? 'bg-stone-300'}`} />
}
