'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { LoadingDots } from '@/components/ui/LoadingDots'
import type { Subject, GradeLevel, LanguagePreference } from '@/types/subject'
import type { Flashcard } from '@/types/flashcard'
import { createClient } from '@/lib/supabase'

interface MemorizeClientProps {
  subject: Subject
  subjectId: string
  grade: GradeLevel
  topic: string | null
  lang: LanguagePreference
}

type Phase = 'loading' | 'error' | 'study' | 'complete'

function saveProgress(userId: string, subjectId: string, topic: string | null, known: number, total: number) {
  fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, subjectId, topic, mode: 'memorize', score: known, total }),
  }).catch(() => { /* fire-and-forget */ })
}

export function MemorizeClient({ subject, subjectId, grade, topic, lang }: MemorizeClientProps) {
  const [fetchKey, setFetchKey] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [cards, setCards] = useState<Flashcard[]>([])
  const [queue, setQueue] = useState<number[]>([])   // indices of cards to show
  const [currentPos, setCurrentPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<number>>(new Set())
  const [review, setReview] = useState<Set<number>>(new Set())
  const [round, setRound] = useState(1)
  const startTime = useRef(Date.now())
  const savedRef = useRef(false)

  useEffect(() => {
    setPhase('loading')
    setFlipped(false)
    setKnown(new Set())
    setReview(new Set())
    setCurrentPos(0)
    setRound(1)
    savedRef.current = false
    startTime.current = Date.now()

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

  function currentCardIndex() { return queue[currentPos] }

  function handleKnew() {
    const idx = currentCardIndex()
    const newKnown = new Set(known).add(idx)
    setKnown(newKnown)
    advance(newKnown, review)
  }

  function handleStudyAgain() {
    const idx = currentCardIndex()
    const newReview = new Set(review).add(idx)
    setReview(newReview)
    advance(known, newReview)
  }

  function advance(currentKnown: Set<number>, currentReview: Set<number>) {
    setFlipped(false)
    const next = currentPos + 1
    if (next < queue.length) {
      setCurrentPos(next)
    } else {
      // End of this round
      if (currentReview.size === 0) {
        // All known — done
        finishSession(currentKnown.size, cards.length)
        setPhase('complete')
      } else {
        // Another round with review cards
        setQueue(Array.from(currentReview))
        setCurrentPos(0)
        setRound(r => r + 1)
        setReview(new Set())
      }
    }
  }

  async function finishSession(knownCount: number, totalCount: number) {
    if (savedRef.current) return
    savedRef.current = true
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) saveProgress(user.id, subjectId, topic, knownCount, totalCount)
  }

  function retry() { setFetchKey(k => k + 1) }

  const gradeLabel = grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`
  const card = cards[currentCardIndex()]
  const progress = phase === 'study' ? ((currentPos) / queue.length) * 100 : 0

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f7]">
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <Link
          href={`/subject/${subjectId}`}
          className="text-stone-400 hover:text-stone-600 transition-colors p-1 -ml-1 rounded-lg hover:bg-stone-100"
          aria-label="Back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xl shrink-0">{subject.icon}</span>
          <div className="min-w-0">
            <p className="font-semibold text-stone-900 text-sm leading-tight truncate">
              {subject.name} · Flashcards
            </p>
            <p className="text-xs text-stone-400">
              {gradeLabel}{topic ? ` · ${topic}` : ''}
              {phase === 'study' && round > 1 ? ` · Round ${round}` : ''}
            </p>
          </div>
        </div>
        {phase === 'study' && (
          <span className="text-xs text-stone-400 shrink-0">{currentPos}/{queue.length}</span>
        )}
      </header>

      {phase === 'study' && (
        <div className="h-1 bg-stone-100">
          <div
            className="h-1 bg-violet-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8 flex flex-col">

        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-24 text-stone-400">
            <LoadingDots className="text-violet-400" />
            <p className="text-sm">Preparing your flashcards...</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <p className="text-stone-600 text-sm">Couldn&apos;t load flashcards. Please try again.</p>
            <button
              onClick={retry}
              className="px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {phase === 'study' && card && (
          <div className="flex flex-col gap-6 flex-1">
            {/* Card */}
            <button
              onClick={() => setFlipped(f => !f)}
              className="flex-1 min-h-[260px] bg-white rounded-3xl border-2 border-stone-200 shadow-sm hover:border-violet-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-4 px-6 py-8 text-center active:scale-[0.99]"
            >
              {!flipped ? (
                <>
                  <span className="text-3xl">🃏</span>
                  <p className="text-stone-900 font-semibold text-lg leading-snug">{card.front}</p>
                  <p className="text-xs text-stone-400 mt-2">Tap to reveal answer</p>
                </>
              ) : (
                <>
                  <p className="text-stone-900 text-base leading-relaxed">{card.back}</p>
                  {card.hint && (
                    <div className="mt-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl w-full">
                      <p className="text-xs text-amber-700 leading-relaxed">💡 {card.hint}</p>
                    </div>
                  )}
                </>
              )}
            </button>

            {/* Action buttons — only show after flip */}
            {flipped ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleStudyAgain}
                  className="py-4 rounded-2xl border-2 border-red-200 bg-red-50 text-red-700 font-bold text-sm hover:bg-red-100 transition-colors active:scale-[0.98]"
                >
                  Study again
                </button>
                <button
                  onClick={handleKnew}
                  className="py-4 rounded-2xl border-2 border-green-300 bg-green-50 text-green-700 font-bold text-sm hover:bg-green-100 transition-colors active:scale-[0.98]"
                >
                  I knew it ✓
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 opacity-30 pointer-events-none select-none">
                <div className="py-4 rounded-2xl border-2 border-stone-200 bg-stone-50 text-stone-400 font-bold text-sm text-center">Study again</div>
                <div className="py-4 rounded-2xl border-2 border-stone-200 bg-stone-50 text-stone-400 font-bold text-sm text-center">I knew it</div>
              </div>
            )}

            {/* Stats row */}
            <div className="flex justify-center gap-6 text-xs text-stone-400">
              <span>✓ Known: <strong className="text-green-600">{known.size}</strong></span>
              <span>↩ Review: <strong className="text-red-500">{review.size}</strong></span>
              <span>Remaining: <strong className="text-stone-600">{queue.length - currentPos}</strong></span>
            </div>
          </div>
        )}

        {phase === 'complete' && (
          <div className="flex flex-col items-center gap-6 py-10 text-center max-w-sm mx-auto flex-1 justify-center">
            <div className="text-6xl">🎉</div>
            <div className="space-y-1">
              <p className="text-sm text-stone-500">Cards mastered</p>
              <p className="text-6xl font-bold text-green-600">{known.size}/{cards.length}</p>
            </div>
            <p className="text-stone-600 text-sm leading-relaxed">
              {known.size === cards.length
                ? 'All cards mastered. That topic is solid — carry this confidence into the exam.'
                : `You got ${known.size} out of ${cards.length}. The ones you reviewed are worth revisiting — that is how memory works.`}
            </p>
            <div className="w-full space-y-3 pt-2">
              <button
                onClick={retry}
                className="w-full py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors"
              >
                New set of cards
              </button>
              <Link
                href={`/tutor/${subjectId}?grade=${encodeURIComponent(grade)}&confidence=mid${topic ? `&topic=${encodeURIComponent(topic)}` : ''}`}
                className="block w-full py-3 border-2 border-violet-300 text-violet-600 font-semibold rounded-xl hover:bg-violet-50 transition-colors"
              >
                Ask the AI tutor about this
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
