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

interface UsageStats {
  totalInteractions: number
  uniqueUsers: number
  usersAtLimit: number
  currentLimit: number
}

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [savedSecret, setSavedSecret] = useState<string | null>(null)
  const [authError, setAuthError] = useState('')
  const [verifying, setVerifying] = useState(false)
  // true while the page is checking a stored session on load
  const [sessionChecking, setSessionChecking] = useState(true)

  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [limitInput, setLimitInput] = useState('100')
  const [limitSaving, setLimitSaving] = useState(false)
  const [limitMsg, setLimitMsg] = useState('')

  // On page load, validate any stored session against the server.
  // A hard-refresh keeps sessionStorage alive, so we must re-verify rather than
  // trusting whatever string is stored.
  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_SECRET_KEY)
    if (!stored) {
      setSessionChecking(false)
      return
    }
    ;(async () => {
      try {
        const res = await fetch('/api/admin/usage-stats', {
          headers: { 'x-admin-secret': stored },
        })
        if (!res.ok) {
          // Stored secret is invalid or ADMIN_SECRET changed — clear it
          sessionStorage.removeItem(ADMIN_SECRET_KEY)
          setSessionChecking(false)
          return
        }
        const data = await res.json()
        setSavedSecret(stored)
        setUsageStats(data)
        setLimitInput(String(data.currentLimit))
        loadSyllabusStats()
      } catch {
        sessionStorage.removeItem(ADMIN_SECRET_KEY)
      } finally {
        setSessionChecking(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadSyllabusStats() {
    setStatsLoading(true)
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
      // informational — fail silently
    } finally {
      setStatsLoading(false)
    }
  }

  async function refreshUsageStats(adminSecret: string) {
    setUsageLoading(true)
    try {
      const res = await fetch('/api/admin/usage-stats', {
        headers: { 'x-admin-secret': adminSecret },
      })
      if (!res.ok) return
      const data = await res.json()
      setUsageStats(data)
      setLimitInput(String(data.currentLimit))
    } catch {
      // non-critical
    } finally {
      setUsageLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = secret.trim()
    if (!trimmed || verifying) return
    setAuthError('')
    setVerifying(true)
    try {
      const res = await fetch('/api/admin/usage-stats', {
        headers: { 'x-admin-secret': trimmed },
      })
      if (res.status === 401) {
        setAuthError('Invalid admin secret.')
        return
      }
      if (!res.ok) {
        setAuthError('Server error. Try again.')
        return
      }
      const data = await res.json()
      sessionStorage.setItem(ADMIN_SECRET_KEY, trimmed)
      setSavedSecret(trimmed)
      setUsageStats(data)
      setLimitInput(String(data.currentLimit))
      loadSyllabusStats()
    } catch {
      setAuthError('Could not reach server. Try again.')
    } finally {
      setVerifying(false)
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_SECRET_KEY)
    setSavedSecret(null)
    setStats(null)
    setUsageStats(null)
    setLimitInput('100')
    setLimitMsg('')
  }

  async function saveLimit() {
    if (!savedSecret) return
    const num = parseInt(limitInput)
    if (!num || num < 1 || num > 10000) {
      setLimitMsg('Enter a number between 1 and 10000.')
      return
    }
    setLimitSaving(true)
    setLimitMsg('')
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': savedSecret },
        body: JSON.stringify({ key: 'daily_limit_trial', value: num }),
      })
      const json = await res.json()
      if (!res.ok) { setLimitMsg(json.error ?? 'Failed to save.'); return }
      setLimitMsg(`Saved. New limit: ${num} messages/day.`)
      setUsageStats(prev => prev ? { ...prev, currentLimit: num } : prev)
    } catch {
      setLimitMsg('Network error. Try again.')
    } finally {
      setLimitSaving(false)
    }
  }

  // Show blank while validating the stored session so there's no flash of login form
  if (sessionChecking) {
    return <div className="min-h-screen bg-gray-50" />
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
              disabled={verifying}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              autoFocus
            />
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            <Button type="submit" className="w-full" disabled={!secret.trim() || verifying}>
              {verifying ? 'Verifying…' : 'Enter'}
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

        {/* ── Daily usage limit — top of page so it's always visible ── */}
        <Card padding="md" className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Daily usage limit</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Max AI messages per student per day (tutor, solve, write). Quiz and flashcards are cached — not counted.
              </p>
            </div>
            <button
              onClick={() => savedSecret && refreshUsageStats(savedSecret)}
              disabled={usageLoading}
              className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-40 transition-colors"
            >
              {usageLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {/* Today's stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Messages today', value: usageLoading ? '…' : (usageStats?.totalInteractions ?? 0) },
              { label: 'Active students', value: usageLoading ? '…' : (usageStats?.uniqueUsers ?? 0) },
              { label: 'At limit', value: usageLoading ? '…' : (usageStats?.usersAtLimit ?? 0) },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-3 text-center">
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Limit control */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Messages per day
                {usageStats && (
                  <span className="text-gray-400 font-normal ml-1">(current: <strong className="text-gray-700">{usageStats.currentLimit}</strong>)</span>
                )}
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                value={limitInput}
                onChange={e => { setLimitInput(e.target.value); setLimitMsg('') }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. 100"
              />
            </div>
            <Button
              onClick={saveLimit}
              disabled={limitSaving}
              size="sm"
            >
              {limitSaving ? 'Saving…' : 'Update'}
            </Button>
          </div>

          {limitMsg && (
            <p className={`text-xs font-medium ${limitMsg.startsWith('Saved') ? 'text-green-600' : 'text-red-600'}`}>
              {limitMsg}
            </p>
          )}

          <div className="text-xs text-gray-400 border-t border-gray-100 pt-3 space-y-0.5">
            <p>• Set higher (200+) during low-activity periods to encourage usage.</p>
            <p>• Lower (50–80) during exam season if costs spike.</p>
            <p>• Change takes effect immediately — no redeploy needed.</p>
          </div>
        </Card>

        {/* ── Syllabus health stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total chunks', value: stats?.totalChunks ?? 0, color: 'text-gray-900' },
            { label: 'Active', value: stats?.activeChunks ?? 0, color: 'text-green-700' },
            { label: 'Draft', value: stats?.draftChunks ?? 0, color: 'text-amber-700' },
            { label: 'Archived', value: stats?.archivedChunks ?? 0, color: 'text-gray-400' },
          ].map(s => (
            <Card key={s.label} padding="md">
              <p className={`text-2xl font-bold ${s.color}`}>
                {statsLoading
                  ? <span className="animate-pulse bg-gray-200 rounded h-7 w-10 inline-block" />
                  : s.value}
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

        {/* Admin tools */}
        <Card padding="md" className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Admin tools</h2>
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

            <Link
              href="/admin/users"
              className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
            >
              <span className="text-2xl">👤</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                  User management
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Create, view, and delete student accounts.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/insights"
              className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
            >
              <span className="text-2xl">📊</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                  Knowledge insights
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  See which topics students struggle with and where to add better sources.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/past-paper"
              className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all group"
            >
              <span className="text-2xl">📄</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-orange-700 transition-colors">
                  SEE past paper ingestion
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload real NEB/SEE exam papers — Claude extracts every question into RAG. Strongest external knowledge source.</p>
              </div>
            </Link>

            <Link
              href="/admin/sources"
              className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
            >
              <span className="text-2xl">🗂️</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                  Add knowledge source
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload PDF, Word, plain text or paste a YouTube URL to enrich the AI.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/ai-knowledge"
              className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all group"
            >
              <span className="text-2xl">🧬</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">
                  AI knowledge generator
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Use Claude to write curriculum-aligned explanations for every syllabus topic and load them into RAG.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/discovery"
              className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-all group"
            >
              <span className="text-2xl">🔍</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-teal-700 transition-colors">
                  Auto-discovery
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Weekly crawler finds new Nepal education content automatically. Review and approve to add to RAG.
                </p>
              </div>
            </Link>

            <Link
              href="/admin/improve"
              className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all group"
            >
              <span className="text-2xl">🧠</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">
                  AI self-improvement
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Review AI-generated teaching notes for struggling topics. Approve to push live.
                </p>
              </div>
            </Link>
          </div>
        </Card>

        {/* Draft syllabus alert */}
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
