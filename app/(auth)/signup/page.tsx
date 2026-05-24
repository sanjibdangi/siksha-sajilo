'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import type { GradeLevel } from '@/types/subject'

const GRADES: { value: GradeLevel; label: string; desc: string }[] = [
  { value: '9',        label: 'Class 9',   desc: 'Foundation' },
  { value: '10',       label: 'Class 10',  desc: 'Almost SEE' },
  { value: 'SEE Prep', label: 'SEE Prep',  desc: 'Exam mode' },
]

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [grade, setGrade] = useState<GradeLevel>('10')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: signupError } = await supabase.auth.signUp({
        email, password,
        options: { data: { name, grade } },
      })
      if (signupError) throw signupError
      if (data.session) {
        localStorage.setItem('siksha_grade', grade)
        router.push('/dashboard')
      } else {
        setCheckEmail(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-4 py-3 text-sm bg-white border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all'

  if (checkEmail) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <p className="text-5xl">📬</p>
          <h1 className="text-2xl font-black text-stone-900">Check your email</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            We sent a confirmation link to <span className="text-stone-900 font-semibold">{email}</span>.<br />
            Click it to activate your account, then sign in.
          </p>
          <Link href="/login" className="block text-sm text-green-600 font-semibold hover:text-green-700 transition-colors">
            Back to sign in →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-7">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block font-black text-2xl tracking-tight text-stone-900">
            Siksha<span className="text-green-600">Sajilo</span>
          </Link>
          <p className="text-stone-500 text-sm">Create your free account</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-stone-700">Your name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                required autoComplete="name" placeholder="Aarav Sharma" className={inputCls} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-stone-700">I am in</label>
              <div className="grid grid-cols-3 gap-2">
                {GRADES.map((g) => (
                  <button key={g.value} type="button" onClick={() => setGrade(g.value)}
                    className={[
                      'flex flex-col items-center gap-0.5 py-3 px-2 rounded-xl border-2 text-center transition-all',
                      grade === g.value
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300',
                    ].join(' ')}>
                    <span className="text-sm font-bold">{g.label}</span>
                    <span className="text-xs opacity-60">{g.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-stone-700">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" placeholder="you@example.com" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-stone-700">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="new-password" minLength={6} placeholder="At least 6 characters" className={inputCls} />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
            )}
            <Button type="submit" loading={loading} size="lg" className="w-full">
              Create account →
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-stone-500">
          Already have an account?{' '}
          <Link href="/login" className="text-green-600 font-semibold hover:text-green-700 transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
