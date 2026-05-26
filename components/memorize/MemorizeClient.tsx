'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { Subject, GradeLevel, LanguagePreference } from '@/types/subject'
import type { Flashcard } from '@/types/flashcard'
import { createClient } from '@/lib/supabase'
import { getTheme, getStars } from '@/lib/subjectTheme'

type Phase = 'loading' | 'error' | 'study' | 'complete'

interface MemorizeClientProps {
  subject: Subject
  subjectId: string
  grade: GradeLevel
  topic: string | null
  lang: LanguagePreference
}

function saveProgress(userId: string, subjectId: string, topic: string | null, known: number, total: number) {
  fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, subjectId, topic, mode: 'memorize', score: known, total }),
  }).catch(() => {})
}

export function MemorizeClient({ subject, subjectId, grade, topic, lang }: MemorizeClientProps) {
  const theme = getTheme(subjectId)

  const [fetchKey, setFetchKey] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [cards, setCards] = useState<Flashcard[]>([])
  const [queue, setQueue] = useState<number[]>([])
  const [currentPos, setCurrentPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<number>>(new Set())
  const [review, setReview] = useState<Set<number>>(new Set())
  const [round, setRound] = useState(1)
  const [transitioning, setTransitioning] = useState(false)
  const savedRef = useRef(false)
  const pendingAction = useRef<null | 'knew' | 'again'>(null)

  useEffect(() => {
    setPhase('loading')
    setFlipped(false)
    setKnown(new Set())
    setReview(new Set())
    setCurrentPos(0)
    setRound(1)
    setTransitioning(false)
    savedRef.current = false

    let active = true
    fetch('/api/memorize/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, grade, topic: topic ?? subject.name, subjectId, lang }),
    })
      .then(r => r.json())
      .then(data => {
        if (!active) return
        if (!data.cards?.length) throw new Error('empty')
        setCards(data.cards)
        setQueue(data.cards.map((_: Flashcard, i: number) => i))
        setPhase('study')
      })
      .catch(() => { if (active) setPhase('error') })

    return () => { active = false }
  }, [fetchKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentCardIndex = () => queue[currentPos]

  function doAdvance(action: 'knew' | 'again') {
    if (transitioning) return
    const idx = currentCardIndex()

    let newKnown = known
    let newReview = review

    if (action === 'knew') {
      newKnown = new Set(known).add(idx)
      setKnown(newKnown)
    } else {
      newReview = new Set(review).add(idx)
      setReview(newReview)
    }

    pendingAction.current = action
    setTransitioning(true)
    setFlipped(false)

    setTimeout(() => {
      const next = currentPos + 1
      if (next < queue.length) {
        setCurrentPos(next)
      } else {
        if (newReview.size === 0) {
          finishSession(newKnown.size, cards.length)
          setPhase('complete')
        } else {
          setQueue(Array.from(newReview))
          setCurrentPos(0)
          setRound(r => r + 1)
          setReview(new Set())
        }
      }
      pendingAction.current = null
      setTransitioning(false)
    }, 280)
  }

  async function finishSession(knownCount: number, totalCount: number) {
    if (savedRef.current) return
    savedRef.current = true
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) saveProgress(user.id, subjectId, topic, knownCount, totalCount)
  }

  // Keyboard shortcuts
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (phase !== 'study') return
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f) }
    if (e.key === 'ArrowRight' && flipped) doAdvance('knew')
    if (e.key === 'ArrowLeft' && flipped) doAdvance('again')
  }, [phase, flipped]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  function retry() { setFetchKey(k => k + 1) }

  const gradeLabel = grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`
  const card = cards[currentCardIndex()]
  const progressPct = phase === 'study' ? (currentPos / queue.length) * 100 : 0
  const stars = phase === 'complete' ? getStars(known.size, cards.length) : 0

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f4f2]">

      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <Link
          href={`/subject/${subjectId}`}
          className="text-stone-400 hover:text-stone-600 transition-colors p-1.5 -ml-1 rounded-xl hover:bg-stone-100"
          aria-label="Back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="text-xl shrink-0">{subject.icon}</span>
          <div className="min-w-0">
            <p className="font-bold text-stone-900 text-sm leading-tight">{subject.name}</p>
            <p className="text-xs text-stone-400">
              {gradeLabel}{topic ? ` · ${topic}` : ''}
            </p>
          </div>
        </div>
        {phase === 'study' && round > 1 && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${theme.pill}`}>
            Round {round}
          </span>
        )}
        {phase === 'study' && (
          <span className="text-sm font-bold text-stone-500 tabular-nums shrink-0">
            {currentPos + 1}<span className="text-stone-300">/{queue.length}</span>
          </span>
        )}
      </header>

      {/* Progress bar */}
      <div className="h-1.5 bg-stone-100">
        <div
          className={`h-1.5 ${theme.bar} transition-all duration-500 ease-out`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6 flex flex-col gap-5">

        {/* ── LOADING ── */}
        {phase === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-xl ${theme.glow} shadow-lg`}>
              <span className="text-4xl">{subject.icon}</span>
            </div>
            <div className="text-center space-y-2">
              <p className="font-bold text-stone-800">Building your flashcards</p>
              <p className="text-sm text-stone-400">Pulling the most important concepts from {topic ?? subject.name}...</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full ${theme.bar} animate-bounce`}
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {phase === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-4xl">⚠️</p>
            <p className="text-stone-600 font-medium">Couldn&apos;t load flashcards</p>
            <button
              onClick={retry}
              className={`px-6 py-3 bg-gradient-to-r ${theme.gradient} text-white font-semibold rounded-2xl shadow-md active:scale-95 transition-transform`}
            >
              Try again
            </button>
          </div>
        )}

        {/* ── STUDY ── */}
        {phase === 'study' && card && (
          <div
            className={`flex flex-col gap-5 flex-1 transition-opacity duration-200 ${transitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
            style={{ transitionProperty: 'opacity, transform' }}
          >
            {/* Card stack + flip */}
            <div className="relative flex-1 min-h-[300px]" style={{ perspective: '1200px' }}>
              {/* Ghost cards for depth */}
              <div className={`absolute inset-x-3 bottom-0 top-3 rounded-3xl ${theme.ghost1} opacity-40`} />
              <div className={`absolute inset-x-1.5 bottom-0 top-1.5 rounded-3xl ${theme.ghost2} opacity-60`} />

              {/* Flip container */}
              <div
                onClick={() => !transitioning && setFlipped(f => !f)}
                className={`absolute inset-0 cursor-pointer select-none`}
                style={{
                  transformStyle: 'preserve-3d',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {/* FRONT */}
                <div
                  className="absolute inset-0 rounded-3xl bg-white shadow-xl flex flex-col items-center justify-center gap-5 px-8 py-10 text-center"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-md`}>
                    <span className="text-lg">{subject.icon}</span>
                  </div>
                  <p className="text-stone-900 font-bold text-xl leading-snug">{card.front}</p>
                  <div className="flex items-center gap-2 text-stone-300">
                    <div className="h-px w-8 bg-stone-200" />
                    <p className="text-xs font-medium">tap to flip</p>
                    <div className="h-px w-8 bg-stone-200" />
                  </div>
                </div>

                {/* BACK */}
                <div
                  className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${theme.gradient} shadow-xl ${theme.glow} shadow-2xl flex flex-col items-center justify-center gap-5 px-8 py-10 text-center`}
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <p className="text-white font-bold text-xl leading-snug">{card.back}</p>
                  {card.hint && (
                    <div className="w-full bg-white/20 backdrop-blur-sm rounded-2xl px-5 py-3">
                      <p className="text-white/90 text-sm leading-relaxed">
                        <span className="font-bold">💡 </span>{card.hint}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {flipped ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => doAdvance('again')}
                  disabled={transitioning}
                  className="group flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-white border-2 border-red-200 hover:border-red-400 hover:bg-red-50 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-red-400 group-hover:text-red-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                    <span className="font-bold text-sm text-red-500 group-hover:text-red-700">Study again</span>
                  </div>
                  <span className="text-xs text-stone-300 font-mono">← key</span>
                </button>
                <button
                  onClick={() => doAdvance('knew')}
                  disabled={transitioning}
                  className={`group flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-gradient-to-br ${theme.gradient} hover:opacity-90 transition-all active:scale-95 shadow-lg disabled:opacity-50`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-bold text-sm text-white">Got it!</span>
                  </div>
                  <span className="text-xs text-white/50 font-mono">→ key</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-3 text-stone-300">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                </svg>
                <span className="text-sm">Tap the card or press <kbd className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-400 text-xs font-mono">Space</kbd> to flip</span>
              </div>
            )}

            {/* Mini stats */}
            <div className="flex justify-center gap-5">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <span className="text-xs text-stone-500">Known <strong className="text-stone-700">{known.size}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-300" />
                <span className="text-xs text-stone-500">Review <strong className="text-stone-700">{review.size}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-stone-300" />
                <span className="text-xs text-stone-500">Left <strong className="text-stone-700">{queue.length - currentPos - 1}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* ── COMPLETE ── */}
        {phase === 'complete' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-2">
            {/* Stars */}
            <div className="flex gap-2">
              {[1, 2, 3].map(s => (
                <svg
                  key={s}
                  className={`h-10 w-10 transition-all ${s <= stars ? 'text-amber-400 scale-110' : 'text-stone-200'}`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>

            {/* Score */}
            <div className={`w-36 h-36 rounded-full bg-gradient-to-br ${theme.gradient} flex flex-col items-center justify-center shadow-2xl ${theme.glow} shadow-xl`}>
              <p className="text-4xl font-black text-white">{Math.round((known.size / cards.length) * 100)}%</p>
              <p className="text-white/70 text-xs font-medium">mastered</p>
            </div>

            <div className="space-y-2">
              <p className="font-black text-stone-900 text-xl">
                {known.size === cards.length ? 'Perfect round!' : `${known.size} of ${cards.length} cards`}
              </p>
              <p className="text-stone-500 text-sm leading-relaxed max-w-xs mx-auto">
                {known.size === cards.length
                  ? 'Every card mastered. This topic is locked in — you\'re ready for the exam.'
                  : known.size >= cards.length * 0.7
                  ? 'Solid session. The few you missed will stick better next time — that\'s how memory works.'
                  : 'Good start. These cards need a bit more repetition — try again and you\'ll see the difference.'}
              </p>
            </div>

            <div className="w-full space-y-2.5 pt-1">
              <button
                onClick={retry}
                className={`w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r ${theme.gradient} shadow-lg active:scale-[0.98] transition-transform`}
              >
                New set of cards
              </button>
              <Link
                href={`/practice/${subjectId}?grade=${encodeURIComponent(grade)}&confidence=mid${topic ? `&topic=${encodeURIComponent(topic)}` : ''}`}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border-2 border-stone-200 bg-white text-stone-700 font-semibold text-sm hover:border-stone-300 transition-colors"
              >
                <span>📝</span> Test yourself with a quiz
              </Link>
              <Link
                href={`/tutor/${subjectId}?grade=${encodeURIComponent(grade)}&confidence=mid${topic ? `&topic=${encodeURIComponent(topic)}` : ''}`}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border-2 border-stone-200 bg-white text-stone-700 font-semibold text-sm hover:border-stone-300 transition-colors"
              >
                <span>💬</span> Ask the AI tutor
              </Link>
              <Link
                href={`/subject/${subjectId}`}
                className="block text-sm text-stone-400 hover:text-stone-600 transition-colors py-1"
              >
                Back to subject
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
