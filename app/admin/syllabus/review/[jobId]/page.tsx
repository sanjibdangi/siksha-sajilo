'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase'
import { SUBJECTS } from '@/types/subject'

const ADMIN_SECRET_KEY = 'siksha_admin_secret'

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
  learning_objectives: string[] | null
  marks_weight: number | null
  exam_pattern: Record<string, unknown> | null
  status: string
}

interface DiffItem {
  topic: string
  type: 'added' | 'removed' | 'changed'
  draft?: SyllabusRow
  active?: SyllabusRow
}

export default function SyllabusReviewPage() {
  const params = useParams()
  const jobId = params.jobId as string
  const router = useRouter()

  const [adminSecret, setAdminSecret] = useState<string | null>(null)
  const [draftRow, setDraftRow] = useState<SyllabusRow | null>(null)
  const [diffItems, setDiffItems] = useState<DiffItem[]>([])
  const [loading, setLoading] = useState(true)
  const [approveLoading, setApproveLoading] = useState(false)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_SECRET_KEY)
    if (!stored) {
      router.replace('/admin')
      return
    }
    setAdminSecret(stored)
  }, [router])

  const loadDiff = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      // Load the specific draft row by id (jobId is the row id in simple flow)
      const { data: draft, error: draftErr } = await supabase
        .from('syllabus')
        .select('*')
        .eq('id', jobId)
        .single()

      if (draftErr || !draft) {
        setError('Could not find this syllabus entry. It may have already been approved or removed.')
        return
      }

      setDraftRow(draft)

      // Load all active rows for same grade+subject to compute diff
      const { data: activeRows } = await supabase
        .from('syllabus')
        .select('*')
        .eq('grade', draft.grade)
        .eq('subject_id', draft.subject_id)
        .eq('year_bs', draft.year_bs)
        .eq('status', 'active')

      // Load all draft rows for same grade+subject+year to show full incoming set
      const { data: draftRows } = await supabase
        .from('syllabus')
        .select('*')
        .eq('grade', draft.grade)
        .eq('subject_id', draft.subject_id)
        .eq('year_bs', draft.year_bs)
        .eq('status', 'draft')

      const activeMap = new Map<string, SyllabusRow>((activeRows ?? []).map(r => [r.topic, r]))
      const draftMap = new Map<string, SyllabusRow>((draftRows ?? []).map(r => [r.topic, r]))

      const items: DiffItem[] = []

      // Topics only in draft = added
      for (const [topic, d] of Array.from(draftMap.entries())) {
        if (!activeMap.has(topic)) {
          items.push({ topic, type: 'added', draft: d })
        } else {
          const a = activeMap.get(topic)!
          const changed = a.marks_weight !== d.marks_weight ||
            JSON.stringify(a.learning_objectives) !== JSON.stringify(d.learning_objectives)
          if (changed) {
            items.push({ topic, type: 'changed', draft: d, active: a })
          }
        }
      }

      // Topics only in active = removed
      for (const [topic, a] of Array.from(activeMap.entries())) {
        if (!draftMap.has(topic)) {
          items.push({ topic, type: 'removed', active: a })
        }
      }

      items.sort((a, b) => {
        const order = { removed: 0, changed: 1, added: 2 }
        return order[a.type] - order[b.type]
      })

      setDiffItems(items)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    if (adminSecret) loadDiff()
  }, [adminSecret, loadDiff])

  async function handleApprove() {
    if (!adminSecret || !draftRow) return
    setApproveLoading(true)
    try {
      const res = await fetch('/api/syllabus/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          jobId,
          yearBs: draftRow.year_bs,
          grade: draftRow.grade,
          subjectId: draftRow.subject_id,
        }),
      })
      if (res.ok) {
        setApproved(true)
      } else {
        const data = await res.json()
        setError(data.error ?? 'Approval failed.')
      }
    } catch {
      setError('Network error during approval.')
    } finally {
      setApproveLoading(false)
    }
  }

  const subjectName = draftRow
    ? SUBJECTS.find(s => s.id === draftRow.subject_id)?.name ?? draftRow.subject_id
    : '—'

  const diffBadge = (type: DiffItem['type']) => {
    if (type === 'added')   return <Badge variant="success">+ added</Badge>
    if (type === 'removed') return <Badge variant="error">− removed</Badge>
    return <Badge variant="warning">~ changed</Badge>
  }

  if (!adminSecret) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/syllabus" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Syllabus
            </Link>
            <span className="text-gray-300">|</span>
            <span className="font-bold text-indigo-600">Review diff</span>
          </div>
          {draftRow && !approved && (
            <Button
              onClick={handleApprove}
              loading={approveLoading}
              size="sm"
            >
              Approve &amp; go live
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {loading && (
          <div className="text-center py-16 text-sm text-gray-400 animate-pulse">Loading diff…</div>
        )}

        {error && (
          <Card padding="md" className="border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{error}</p>
            <Link href="/admin/syllabus" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">
              Back to syllabus list
            </Link>
          </Card>
        )}

        {approved && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="text-5xl">✅</span>
            <h2 className="text-lg font-bold text-gray-900">Syllabus approved and live</h2>
            <p className="text-sm text-gray-500">
              The new syllabus for {subjectName} (Grade {draftRow?.grade}, {draftRow?.year_bs} BS)
              is now active for all students.
            </p>
            <Link href="/admin/syllabus">
              <Button variant="outline" size="sm">Back to syllabus list</Button>
            </Link>
          </div>
        )}

        {!loading && !error && !approved && draftRow && (
          <>
            {/* Summary header */}
            <Card padding="md">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-gray-500">Subject</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{subjectName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Grade</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{draftRow.grade}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Year (BS)</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{draftRow.year_bs}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Changes</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {diffItems.filter(d => d.type === 'added').length > 0 && (
                      <Badge variant="success">+{diffItems.filter(d => d.type === 'added').length} added</Badge>
                    )}
                    {diffItems.filter(d => d.type === 'removed').length > 0 && (
                      <Badge variant="error">−{diffItems.filter(d => d.type === 'removed').length} removed</Badge>
                    )}
                    {diffItems.filter(d => d.type === 'changed').length > 0 && (
                      <Badge variant="warning">{diffItems.filter(d => d.type === 'changed').length} changed</Badge>
                    )}
                    {diffItems.length === 0 && (
                      <Badge variant="default">No differences</Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* No diff */}
            {diffItems.length === 0 && (
              <Card padding="md" className="text-center py-8">
                <p className="text-sm text-gray-500">
                  The incoming draft matches the current active syllabus exactly.
                  Approving will simply promote the draft to active.
                </p>
              </Card>
            )}

            {/* Diff list */}
            {diffItems.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-700">Topic-level diff</h2>
                {diffItems.map((item, i) => (
                  <Card key={i} padding="none" className="overflow-hidden">
                    <div className={[
                      'px-4 py-3 flex items-start gap-3',
                      item.type === 'added'   ? 'bg-green-50 border-l-4 border-green-400' : '',
                      item.type === 'removed' ? 'bg-red-50 border-l-4 border-red-400' : '',
                      item.type === 'changed' ? 'bg-amber-50 border-l-4 border-amber-400' : '',
                    ].join(' ')}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {diffBadge(item.type)}
                          <span className="text-sm font-medium text-gray-900">{item.topic}</span>
                        </div>

                        {/* Added: show new details */}
                        {item.type === 'added' && item.draft && (
                          <div className="mt-2 text-xs text-gray-600 space-y-1">
                            {item.draft.unit_title && (
                              <p>Unit {item.draft.unit_no}: {item.draft.unit_title}</p>
                            )}
                            {item.draft.chapter_title && (
                              <p>Chapter {item.draft.chapter_no}: {item.draft.chapter_title}</p>
                            )}
                            {item.draft.marks_weight != null && (
                              <p>Marks: {item.draft.marks_weight}</p>
                            )}
                            {item.draft.learning_objectives?.length ? (
                              <ul className="list-disc ml-4 space-y-0.5">
                                {item.draft.learning_objectives.map((o, j) => <li key={j}>{o}</li>)}
                              </ul>
                            ) : null}
                          </div>
                        )}

                        {/* Removed: show what's going away */}
                        {item.type === 'removed' && item.active && (
                          <div className="mt-2 text-xs text-gray-500 space-y-1 line-through opacity-70">
                            {item.active.marks_weight != null && (
                              <p>Marks: {item.active.marks_weight}</p>
                            )}
                          </div>
                        )}

                        {/* Changed: show side-by-side */}
                        {item.type === 'changed' && item.active && item.draft && (
                          <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1">
                              <p className="font-semibold text-gray-500">Current (active)</p>
                              {item.active.marks_weight != null && (
                                <p className="text-gray-600">Marks: {item.active.marks_weight}</p>
                              )}
                              {item.active.learning_objectives?.length ? (
                                <ul className="list-disc ml-4 text-gray-500 space-y-0.5">
                                  {item.active.learning_objectives.map((o, j) => <li key={j}>{o}</li>)}
                                </ul>
                              ) : null}
                            </div>
                            <div className="space-y-1">
                              <p className="font-semibold text-green-700">Incoming (draft)</p>
                              {item.draft.marks_weight != null && (
                                <p className="text-gray-700">Marks: {item.draft.marks_weight}</p>
                              )}
                              {item.draft.learning_objectives?.length ? (
                                <ul className="list-disc ml-4 text-gray-700 space-y-0.5">
                                  {item.draft.learning_objectives.map((o, j) => <li key={j}>{o}</li>)}
                                </ul>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Approve action at bottom for long diffs */}
            {diffItems.length > 4 && (
              <div className="flex justify-end pt-2">
                <Button onClick={handleApprove} loading={approveLoading}>
                  Approve &amp; go live
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
