'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { MessageBubble } from '@/components/tutor/MessageBubble'
import { TypingIndicator } from '@/components/tutor/TypingIndicator'
import { Button } from '@/components/ui/Button'
import type { Subject, GradeLevel, ConfidenceLevel, LanguagePreference } from '@/types/subject'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface SolveClientProps {
  subject: Subject
  subjectId: string
  grade: GradeLevel
  confidence: ConfidenceLevel
  lang: LanguagePreference
}

export function SolveClient({ subject, subjectId, grade, confidence, lang }: SolveClientProps) {
  const [phase, setPhase] = useState<'idle' | 'active'>('idle')
  const [draft, setDraft] = useState('')
  const [photo, setPhoto] = useState<{ base64: string; mediaType: string; previewUrl: string } | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [followUp, setFollowUp] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const followUpRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-focus follow-up input after streaming completes
  useEffect(() => {
    if (!streaming && phase === 'active') {
      followUpRef.current?.focus()
    }
  }, [streaming, phase])

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const MAX_MB = 20

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoError('')

    // Client-side validation mirrors the server — gives instant feedback
    if (!ALLOWED_TYPES.includes(file.type)) {
      setPhotoError('Only JPEG, PNG, WebP, or GIF images are supported.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setPhotoError(`Image is too large. Please use an image under ${MAX_MB} MB.`)
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      const [header, base64] = result.split(',')
      const mediaType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      setPhoto({ base64, mediaType, previewUrl: result })
    }
    reader.readAsDataURL(file)
    // reset so the same file can be re-selected
    e.target.value = ''
  }

  async function callStream(
    text: string,
    history: Message[],
    attachedPhoto?: { base64: string; mediaType: string } | null
  ) {
    const displayText = text || (attachedPhoto ? '(Photo of problem)' : '')
    const userMsg: Message = { role: 'user', content: displayText }
    const apiMessages = [...history, userMsg]

    setMessages([...apiMessages, { role: 'assistant', content: '' }])
    setStreaming(true)

    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          subject,
          grade,
          confidence,
          lang,
          ...(attachedPhoto ? { imageBase64: attachedPhoto.base64, imageMediaType: attachedPhoto.mediaType } : {}),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error ?? `Request failed (${res.status})`)
      }
      if (!res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: msg }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  function submitProblem() {
    const trimmed = draft.trim()
    if ((!trimmed && !photo) || streaming) return
    setDraft('')
    const submittedPhoto = photo
    setPhoto(null)
    setPhase('active')
    callStream(trimmed, [], submittedPhoto)
  }

  function submitFollowUp() {
    const trimmed = followUp.trim()
    if (!trimmed || streaming) return
    setFollowUp('')
    callStream(trimmed, messages)
  }

  function startNew() {
    setPhase('idle')
    setMessages([])
    setDraft('')
    setFollowUp('')
    setPhoto(null)
  }

  const gradeLabel = grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`
  const lastMsg = messages[messages.length - 1]
  const showTyping = streaming && lastMsg?.role === 'assistant' && lastMsg.content === ''

  const header = (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
      <Link
        href={`/subject/${subjectId}`}
        className="text-gray-400 hover:text-gray-600 transition-colors p-1 -ml-1 rounded-lg hover:bg-gray-100"
        aria-label="Back"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-xl shrink-0">{subject.icon}</span>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
            {subject.name} · Solve
          </p>
          <p className="text-xs text-gray-500">{gradeLabel}</p>
        </div>
      </div>

      {phase === 'active' && (
        <button
          onClick={startNew}
          className="text-xs text-indigo-600 font-medium shrink-0 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          New problem
        </button>
      )}
    </header>
  )

  // ── IDLE: problem input form ────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        {header}

        <main className="flex-1 max-w-xl w-full mx-auto px-4 py-10">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-4xl">{subject.icon}</p>
              <h1 className="text-xl font-bold text-gray-900">Solve My Problem</h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                Type a question, or photograph it straight from your textbook.<br />
                I&apos;ll teach you through every step.
              </p>
            </div>

            {/* Hidden file input — opens camera on mobile */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {/* Photo preview */}
            {photo && (
              <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                <img
                  src={photo.previewUrl}
                  alt="Problem photo"
                  className="h-16 w-16 object-cover rounded-lg shrink-0 border border-indigo-200"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-indigo-800">Photo attached</p>
                  <p className="text-xs text-indigo-500">Add a note below, or solve directly</p>
                </div>
                <button
                  onClick={() => { setPhoto(null); setPhotoError('') }}
                  className="shrink-0 text-indigo-400 hover:text-indigo-600 transition-colors"
                  aria-label="Remove photo"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {photoError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <svg className="h-4 w-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{photoError}</p>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitProblem()
                }}
                placeholder={
                  photo
                    ? `Optional: add any context or specific question about the photo...`
                    : `Paste your question or problem here...\n\nExamples:\n• "Find the area of a triangle with base 8 cm and height 5 cm"\n• "Explain the causes of the French Revolution"\n• "Solve: 2x² − 5x + 3 = 0"`
                }
                rows={photo ? 3 : 9}
                className="w-full resize-none text-sm text-gray-800 placeholder-gray-400 focus:outline-none leading-relaxed p-4"
              />
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {photo ? 'Change photo' : 'Attach photo'}
                </button>
                <Button
                  onClick={submitProblem}
                  disabled={!draft.trim() && !photo}
                  size="md"
                >
                  Solve this
                </Button>
              </div>
            </div>

            <p className="text-xs text-center text-gray-400">
              Works with any {subject.name} question from your CDC syllabus.
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ── ACTIVE: streaming solution + follow-up ──────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {header}

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 max-w-3xl w-full mx-auto">
        {messages.map((msg, i) => {
          if (showTyping && i === messages.length - 1 && msg.role === 'assistant') {
            return <TypingIndicator key={i} />
          }
          return <MessageBubble key={i} role={msg.role} content={msg.content} />
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-200 bg-white px-4 py-3 shrink-0">
        {streaming ? (
          <p className="text-xs text-gray-400 text-center py-1">
            Working through the solution...
          </p>
        ) : (
          <div className="flex gap-3 items-end max-w-3xl mx-auto">
            <textarea
              ref={followUpRef}
              value={followUp}
              onChange={(e) => {
                setFollowUp(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submitFollowUp()
                }
              }}
              placeholder="Ask to clarify any step..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent leading-relaxed"
            />
            <Button
              onClick={submitFollowUp}
              disabled={!followUp.trim()}
              size="lg"
              className="shrink-0"
            >
              Ask
            </Button>
          </div>
        )}
        {!streaming && (
          <p className="text-xs text-gray-400 text-center mt-2">
            Enter to ask · Shift+Enter for new line
          </p>
        )}
      </div>
    </div>
  )
}
