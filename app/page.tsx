import Link from 'next/link'
import { SUBJECTS } from '@/types/subject'

const FEATURES = [
  {
    icon: '💬',
    title: 'AI Tutor',
    accent: 'border-green-200 bg-green-50',
    titleColor: 'text-green-700',
    desc: 'Ask anything. Calm, step-by-step explanations at your pace. No judgment, ever.',
  },
  {
    icon: '📝',
    title: 'Practice Quiz',
    accent: 'border-amber-200 bg-amber-50',
    titleColor: 'text-amber-700',
    desc: '5 questions per topic, grounded in the official CDC syllabus. Every wrong answer comes with a warm explanation.',
  },
  {
    icon: '🔍',
    title: 'Solve My Problem',
    accent: 'border-blue-200 bg-blue-50',
    titleColor: 'text-blue-700',
    desc: 'Paste any question. Teaches through every step — not just the answer. Built for SEE exam.',
  },
]

const STATS = [
  { value: '6', label: 'SEE subjects' },
  { value: '3', label: 'grade levels' },
  { value: '100%', label: 'CDC grounded' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-900">
      {/* Nav */}
      <nav className="border-b border-stone-200 px-6 py-4 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-black text-lg tracking-tight text-stone-900">
            Siksha<span className="text-green-600">Sajilo</span>
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm text-stone-500 hover:text-stone-900 font-semibold transition-colors px-3 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-semibold transition-colors shadow-sm"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-stone-200 bg-white text-xs text-stone-500 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Built for Nepal&apos;s SEE students
        </div>

        <h1 className="text-5xl sm:text-6xl font-black leading-[1.1] tracking-tight text-stone-900">
          सिक्ने{' '}
          <span className="text-green-600">सजिलो</span>{' '}
          तरिका
        </h1>

        <p className="text-stone-500 text-lg max-w-xl mx-auto leading-relaxed">
          AI-powered tutoring grounded in Nepal&apos;s official CDC syllabus.
          Calm, patient, step-by-step — built for how Nepali students actually think and learn.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/signup"
            className="bg-green-600 hover:bg-green-700 text-white px-7 py-3.5 rounded-xl font-bold text-base transition-colors shadow-md"
          >
            Start learning free →
          </Link>
          <Link
            href="/login"
            className="text-stone-700 hover:text-stone-900 px-7 py-3.5 rounded-xl font-semibold border border-stone-300 hover:border-stone-400 bg-white transition-all text-base"
          >
            Sign in
          </Link>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-10 pt-2">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-black text-stone-900">{s.value}</p>
              <p className="text-xs text-stone-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white border-y border-stone-100">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-center text-2xl font-black text-stone-900 mb-2">Three ways to learn</h2>
          <p className="text-center text-stone-400 text-sm mb-10">Choose what you need right now.</p>
          <div className="grid md:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className={`rounded-2xl p-6 border-2 space-y-3 ${f.accent}`}>
                <span className="text-3xl block">{f.icon}</span>
                <h3 className={`font-bold text-base ${f.titleColor}`}>{f.title}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subjects */}
      <section className="py-16 max-w-4xl mx-auto px-6">
        <h2 className="text-center text-2xl font-black text-stone-900 mb-2">All your SEE subjects</h2>
        <p className="text-center text-stone-400 text-sm mb-10">Every subject. Official CDC syllabus. One platform.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SUBJECTS.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 p-4 rounded-2xl border border-stone-200 bg-white hover:border-green-300 hover:shadow-sm transition-all group"
            >
              <span className="text-2xl shrink-0">{s.icon}</span>
              <div className="min-w-0">
                <p className="font-bold text-stone-900 text-sm group-hover:text-green-700 transition-colors truncate">{s.name}</p>
                <p className="text-xs text-stone-400 truncate">{s.nameNepali}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white border-t border-stone-100">
        <div className="max-w-xl mx-auto px-6 text-center space-y-5">
          <h2 className="text-3xl font-black text-stone-900">
            Ready to actually <span className="text-green-600">understand</span>?
          </h2>
          <p className="text-stone-500 text-sm leading-relaxed">
            Not just memorize. Not just get answers. Actually understand —
            so the exam feels manageable.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-bold text-base transition-colors shadow-md"
          >
            Create free account →
          </Link>
        </div>
      </section>

      <footer className="border-t border-stone-100 py-8 text-center bg-white">
        <p className="text-sm text-stone-400">SikshaSajilo · Grounded in Nepal&apos;s CDC syllabus</p>
      </footer>
    </div>
  )
}
