'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const err = params.get('error')
      if (err) {
        setError(err)
        window.history.replaceState(null, '', '/login')
      }
    } catch { /* ignore */ }
  }, [])

  const inputCls = 'w-full px-4 py-3 text-sm bg-white border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all'

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-7">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block font-black text-2xl tracking-tight text-stone-900">
            Siksha<span className="text-green-600">Sajilo</span>
          </Link>
          <p className="text-stone-500 text-sm">Sign in to continue learning</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
          {/* Pure HTML form — no JavaScript fetch, no onSubmit handler.
              The browser sends a native POST; the server authenticates and redirects. */}
          <form action="/api/auth/login" method="POST" className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-stone-700" htmlFor="email">Email</label>
              <input
                id="email" name="email" type="email"
                required autoComplete="email" placeholder="you@example.com"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-stone-700" htmlFor="password">Password</label>
              <input
                id="password" name="password" type="password"
                required autoComplete="current-password" placeholder="••••••••"
                className={inputCls}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
            )}
            <Button type="submit" size="lg" className="w-full mt-1">
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-stone-500">
          New here?{' '}
          <Link href="/signup" className="text-green-600 font-semibold hover:text-green-700 transition-colors">
            Create a free account
          </Link>
        </p>
      </div>
    </div>
  )
}
