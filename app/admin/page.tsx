'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase'

const ADMIN_SECRET_KEY = 'siksha_admin_secret'

interface Stats {
  totalChunks: number
  activeChunks: number
  draftChunks: number
  archivedChunks: number
  bySubject: Record<string, number>
  byGrade: Record<number, number>
}

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [savedSecret, setSavedSecret] = useState<string | null>(null)
  const [authError, setAuthError] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_SECRET_KEY)
    if (stored) {
      setSavedSecret(stored)
      loadStats()
    }
  }, [])

  async function loadStats() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('syllabus')
        .select('status, subject_id, grade')

      if (error) throw error

      const rows = data ?? []
      const s: Stats = {
        totalChunks: rows.length,
        activeChunks: rows.filter(r => r.status === 'active').length,
        draftChunks: rows.filter(r => r.status === 'draft').length,
        archivedChunks: rows.filter(r => r.status === 'archived').length,
        bySubject: {},
        byGrade: {},
      }
      for (const r of rows.filter(x => x.status === 'active')) {
        s.bySubject[r.subject_id] = (s.bySubject[r.subject_id] ?? 0) + 1
        s.byGrade[r.grade] = (s.byGrade[r.grade] ?? 0) + 1
      }
      setStats(s)
    } catch {
      // Stats are informational — fail silently, still show dashboard
    } finally {
      setLoading(false)
    }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!secret.trim()) return
    // Store and verify via a real API call on first protected action.
    // For now gate the UI locally — all real API calls send the header server-side.
    sessionStorage.setItem(ADMIN_SECRET_KEY, secret.trim())
    setSavedSecret(secret.trim())
    setAuthError('')
    loadStats()
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_SECRET_KEY)
    setSavedSecret(null)
    setStats(null)
  }

  if (!savedSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Admin Access</h1>
            <p className="text-sm text-gray-500 mt-1">Enter your admin secret to continue.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Admin secret"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            <Button type="submit" className="w-full" disabled={!secret.trim()}>
              Enter
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← App
            </Link>
            <span className="text-gray-300">|</span>
            <span className="font-bold text-indigo-600">SikshaSajilo Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Syllabus health and admin tools.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total chunks', value: stats?.totalChunks ?? '—', color: 'text-gray-900' },
            { label: 'Active', value: stats?.activeChunks ?? '—', color: 'text-green-700' },
            { label: 'Draft', value: stats?.draftChunks ?? '—', color: 'text-amber-700' },
            { label: 'Archived', value: stats?.archivedChunks ?? '—', color: 'text-gray-400' },
          ].map(s => (
            <Card key={s.label} padding="md">
              <p className={`text-2xl font-bold ${s.color}`}>
                {loading ? <span className="animate-pulse bg-gray-200 rounded h-7 w-12 inline-block" /> : s.value}
              </p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Active chunks by subject */}
        {stats && Object.keys(stats.bySubject).length > 0 && (
          <Card padding="md">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Active chunks by subject</h2>
            <div className="space-y-2">
              {Object.entries(stats.bySubject)
                .sort(([, a], [, b]) => b - a)
                .map(([subject, count]) => (
                  <div key={subject} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-32 capitalize">{subject}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (count / (stats.activeChunks || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
                  </div>
                ))}
            </div>
          </Card>
        )}

        {/* Active chunks by grade */}
        {stats && Object.keys(stats.byGrade).length > 0 && (
          <Card padding="md">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Active chunks by grade</h2>
            <div className="flex gap-4 flex-wrap">
              {Object.entries(stats.byGrade).sort().map(([grade, count]) => (
                <div key={grade} className="flex items-center gap-2">
                  <Badge variant="info">Grade {grade}</Badge>
                  <span className="text-sm text-gray-700 font-medium">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Admin actions */}
        <Card padding="md" className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Syllabus management</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              href="/admin/syllabus"
              className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
            >
              <span className="text-2xl">📚</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                  Syllabus list &amp; upload
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  View active chunks, trigger new ingestion jobs, upload PDFs.
                </p>
              </div>
            </Link>

            <div className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 bg-gray-50 opacity-70">
              <span className="text-2xl">📊</span>
              <div>
                <p className="text-sm font-semibold text-gray-700">Progress analytics</p>
                <p className="text-xs text-gray-500 mt-0.5">Student engagement data — coming soon.</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Draft syllabus needing review */}
        {stats && stats.draftChunks > 0 && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="text-amber-500 text-xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {stats.draftChunks} draft chunk{stats.draftChunks !== 1 ? 's' : ''} awaiting review
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                These are not visible to students yet. Review and approve them from the syllabus page.
              </p>
            </div>
            <Link href="/admin/syllabus">
              <Button size="sm" variant="outline">Review</Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
