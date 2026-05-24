'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase'
import { SUBJECTS } from '@/types/subject'

const ADMIN_SECRET_KEY = 'siksha_admin_secret'

type Status = 'active' | 'draft' | 'archived' | 'all'

interface SyllabusRow {
  id: string
  year_bs: number
  grade: number
  subject_id: string
  unit_no: number | null
  unit_title: string | null
  chapter_no: number | null
  chapter_title: string | null
  topic: string
  marks_weight: number | null
  status: string
  created_at: string
}

interface IngestForm {
  grade: string
  subjectId: string
  yearBs: string
  pdfUrl: string
}

const GRADE_OPTIONS = [
  { value: '9', label: 'Class 9' },
  { value: '10', label: 'Class 10' },
]

export default function SyllabusAdminPage() {
  const [adminSecret, setAdminSecret] = useState<string | null>(null)
  const [rows, setRows] = useState<SyllabusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<Status>('active')
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [filterSubject, setFilterSubject] = useState<string>('all')
  const [ingestForm, setIngestForm] = useState<IngestForm>({ grade: '10', subjectId: 'mathematics', yearBs: '2083', pdfUrl: '' })
  const [ingestLoading, setIngestLoading] = useState(false)
  const [ingestResult, setIngestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_SECRET_KEY)
    if (!stored) {
      router.replace('/admin')
      return
    }
    setAdminSecret(stored)
  }, [router])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      let query = supabase
        .from('syllabus')
        .select('id, year_bs, grade, subject_id, unit_no, unit_title, chapter_no, chapter_title, topic, marks_weight, status, created_at')
        .order('year_bs', { ascending: false })
        .order('grade')
        .order('subject_id')
        .order('unit_no', { ascending: true, nullsFirst: false })

      if (filterStatus !== 'all') query = query.eq('status', filterStatus)
      if (filterGrade !== 'all') query = query.eq('grade', parseInt(filterGrade))
      if (filterSubject !== 'all') query = query.eq('subject_id', filterSubject)

      const { data, error } = await query.limit(200)
      if (error) throw error
      setRows(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterGrade, filterSubject])

  useEffect(() => {
    if (adminSecret) loadRows()
  }, [adminSecret, loadRows])

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault()
    if (!adminSecret) return
    setIngestLoading(true)
    setIngestResult(null)
    try {
      const res = await fetch('/api/syllabus/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          grade: parseInt(ingestForm.grade),
          subjectId: ingestForm.subjectId,
          yearBs: parseInt(ingestForm.yearBs),
          pdfUrl: ingestForm.pdfUrl || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setIngestResult({ ok: true, message: data.jobId ? `Job started: ${data.jobId}` : (data.message ?? 'Ingestion triggered.') })
        loadRows()
      } else {
        setIngestResult({ ok: false, message: data.error ?? 'Failed to trigger ingestion.' })
      }
    } catch {
      setIngestResult({ ok: false, message: 'Network error — pipeline may not be running.' })
    } finally {
      setIngestLoading(false)
    }
  }

  async function handleArchive(row: SyllabusRow) {
    if (!adminSecret) return
    if (!confirm(`Archive "${row.topic}"? It will no longer be visible to students.`)) return
    const supabase = createClient()
    await supabase.from('syllabus').update({ status: 'archived' }).eq('id', row.id)
    loadRows()
  }

  async function handleApprove(row: SyllabusRow) {
    if (!adminSecret) return
    const res = await fetch('/api/syllabus/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
      body: JSON.stringify({ jobId: null, yearBs: row.year_bs, grade: row.grade, subjectId: row.subject_id }),
    })
    if (res.ok) {
      loadRows()
    }
  }

  const statusBadge = (status: string) => {
    if (status === 'active')   return <Badge variant="success">active</Badge>
    if (status === 'draft')    return <Badge variant="warning">draft</Badge>
    if (status === 'archived') return <Badge variant="default">archived</Badge>
    return <Badge>{status}</Badge>
  }

  if (!adminSecret) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Dashboard
            </Link>
            <span className="text-gray-300">|</span>
            <span className="font-bold text-indigo-600">Syllabus</span>
          </div>
          <span className="text-xs text-gray-400">{rows.length} rows shown</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Ingest form */}
        <Card padding="md">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Trigger ingestion job</h2>
          <form onSubmit={handleIngest} className="grid sm:grid-cols-5 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Grade</label>
              <select
                value={ingestForm.grade}
                onChange={e => setIngestForm(f => ({ ...f, grade: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {GRADE_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Subject</label>
              <select
                value={ingestForm.subjectId}
                onChange={e => setIngestForm(f => ({ ...f, subjectId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Year (BS)</label>
              <input
                type="number"
                value={ingestForm.yearBs}
                onChange={e => setIngestForm(f => ({ ...f, yearBs: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs text-gray-500">PDF URL (optional)</label>
              <input
                type="url"
                placeholder="https://..."
                value={ingestForm.pdfUrl}
                onChange={e => setIngestForm(f => ({ ...f, pdfUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <Button type="submit" loading={ingestLoading} variant="primary">
              Run pipeline
            </Button>
          </form>
          {ingestResult && (
            <p className={`text-sm mt-3 ${ingestResult.ok ? 'text-green-700' : 'text-red-600'}`}>
              {ingestResult.message}
            </p>
          )}
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1">
            {(['active', 'draft', 'archived', 'all'] as Status[]).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-semibold transition-all border',
                  filterStatus === s
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>
          <select
            value={filterGrade}
            onChange={e => setFilterGrade(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">All grades</option>
            {GRADE_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">All subjects</option>
            {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            onClick={loadRows}
            className="text-xs text-indigo-600 hover:underline"
          >
            Refresh
          </button>
        </div>

        {/* Table */}
        <Card padding="none">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading syllabus data…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No rows match the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Grade</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Subject</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Year BS</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Unit</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Chapter</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Topic</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Marks</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700">{row.grade}</td>
                      <td className="px-4 py-3 text-gray-700 capitalize">{row.subject_id}</td>
                      <td className="px-4 py-3 text-gray-500">{row.year_bs}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate" title={row.unit_title ?? ''}>
                        {row.unit_no != null ? `${row.unit_no}. ` : ''}{row.unit_title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate" title={row.chapter_title ?? ''}>
                        {row.chapter_no != null ? `${row.chapter_no}. ` : ''}{row.chapter_title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate font-medium" title={row.topic}>
                        {row.topic}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{row.marks_weight ?? '—'}</td>
                      <td className="px-4 py-3">{statusBadge(row.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {row.status === 'draft' && (
                            <>
                              <Link
                                href={`/admin/syllabus/review/${row.id}`}
                                className="text-xs text-indigo-600 hover:underline"
                              >
                                Review
                              </Link>
                              <button
                                onClick={() => handleApprove(row)}
                                className="text-xs text-green-600 hover:underline"
                              >
                                Approve
                              </button>
                            </>
                          )}
                          {row.status === 'active' && (
                            <button
                              onClick={() => handleArchive(row)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
