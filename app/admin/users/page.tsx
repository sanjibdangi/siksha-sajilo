'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const ADMIN_SECRET_KEY = 'siksha_admin_secret'

const GRADE_OPTIONS = [
  { value: '', label: 'No grade' },
  { value: '9', label: 'Class 9' },
  { value: '10', label: 'Class 10' },
  { value: 'SEE Prep', label: 'SEE Prep' },
]

interface UserRow {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  name: string | null
  grade: string | null
  school: string | null
}

interface CreateForm {
  email: string
  password: string
  name: string
  grade: string
}

const emptyForm: CreateForm = { email: '', password: '', name: '', grade: '' }

export default function AdminUsersPage() {
  const [secret, setSecret] = useState<string | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateForm>(emptyForm)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_SECRET_KEY)
    if (!stored) {
      window.location.href = '/admin'
    } else {
      setSecret(stored)
    }
  }, [])

  const loadUsers = useCallback(async (s: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'x-admin-secret': s },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load users')
      setUsers(json.users)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (secret) loadUsers(secret)
  }, [secret, loadUsers])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!secret) return
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret,
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim() || undefined,
          grade: form.grade || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create user')
      setForm(emptyForm)
      setShowCreate(false)
      loadUsers(secret)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!secret) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': secret },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete user')
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete user')
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (!secret) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Admin
            </Link>
            <span className="text-gray-300">|</span>
            <span className="font-bold text-indigo-600">Users</span>
          </div>
          <Button size="sm" onClick={() => { setShowCreate(true); setCreateError('') }}>
            + Create user
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Create user form */}
        {showCreate && (
          <Card padding="md">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Create new user</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="student@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Min 6 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Student name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
                  <select
                    value={form.grade}
                    onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {GRADE_OPTIONS.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {createError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {createError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create user'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowCreate(false); setForm(emptyForm); setCreateError('') }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* User list */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              All users {!loading && <span className="font-normal text-gray-400">({users.length})</span>}
            </h2>
            <button
              onClick={() => secret && loadUsers(secret)}
              className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Refresh
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No users yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Email</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Name</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Grade</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Created</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Last sign in</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4 text-gray-900 font-medium">{user.email}</td>
                      <td className="py-3 pr-4 text-gray-600">{user.name || <span className="text-gray-300">—</span>}</td>
                      <td className="py-3 pr-4">
                        {user.grade
                          ? <Badge variant="info">{user.grade}</Badge>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-gray-500">{formatDate(user.created_at)}</td>
                      <td className="py-3 pr-4 text-gray-500">{formatDate(user.last_sign_in_at)}</td>
                      <td className="py-3">
                        {confirmDeleteId === user.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Delete?</span>
                            <button
                              onClick={() => handleDelete(user.id)}
                              disabled={deletingId === user.id}
                              className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                            >
                              {deletingId === user.id ? 'Deleting...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(user.id)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                          >
                            Delete
                          </button>
                        )}
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
