'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { MessageBubble } from '@/components/tutor/MessageBubble'
import { TypingIndicator } from '@/components/tutor/TypingIndicator'
import type { Subject, GradeLevel, ConfidenceLevel, LanguagePreference } from '@/types/subject'
import { getTheme } from '@/lib/subjectTheme'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGE_MB = 20

const SUBJECT_EXAMPLES: Record<string, string[]> = {
  mathematics: [
    'Find the area of a triangle with base 8 cm and height 5 cm',
    'Solve: 2x² − 5x + 3 = 0',
    'The sum of two numbers is 45. One is twice the other. Find them.',
  ],
  science: [
    'Explain the process of photosynthesis with a diagram',
    'What is Newton\'s second law? Give an example.',
    'Why does ice float on water?',
  ],
  english: [
    'Write 5 sentences using the present perfect tense',
    'Identify the parts of speech in: "The quick brown fox jumps"',
    'What is the difference between a simile and a metaphor?',
  ],
  nepali: [
    'कारक र विभक्तिको फरक के हो? उदाहरण दिनुहोस्।',
    '"नेपाल" शब्दको व्युत्पत्ति बताउनुहोस्।',
    'सन्धि भनेको के हो? प्रकारहरू लेख्नुहोस्।',
  ],
  social: [
    'Explain the causes of World War I in simple terms',
    'What is the difference between latitude and longitude?',
    'Describe Nepal\'s federal structure with examples',
  ],
  optmath: [
    'Find the inverse of a 2×2 matrix',
    'Prove that sin²θ + cos²θ = 1',
    'Solve the system: 3x + 2y = 12, x − y = 1',
  ],
}

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
  const theme = getTheme(subjectId)
  const examples = SUBJECT_EXAMPLES[subjectId] ?? SUBJECT_EXAMPLES.mathematics

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!streaming && phase === 'active') followUpRef.current?.focus()
  }, [streaming, phase])

  function loadImageFile(file: File) {
    setPhotoError('')
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setPhotoError('Only JPEG, PNG, WebP, or GIF images are supported.')
      return
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setPhotoError(`Image too large. Max ${MAX_IMAGE_MB} MB.`)
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
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    loadImageFile(file)
    e.target.value = ''
  }

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) loadImageFile(file)
          break
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          subject, grade, confidence, lang,
          ...(attachedPhoto ? { imageBase64: attachedPhoto.base64, imageMediaType: attachedPhoto.mediaType } : {}),
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? `${res.status}`) }
      if (!res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages(prev => {
          const u = [...prev]
          u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + chunk }
          return u
        })
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: msg }; return u })
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
    setPhotoError('')
  }

  const gradeLabel = grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`
  const lastMsg = messages[messages.length - 1]
  const showTyping = streaming && lastMsg?.role === 'assistant' && lastMsg.content === ''

  const header = (
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
          <p className="font-bold text-stone-900 text-sm leading-tight">{subject.name} · Solve</p>
          <p className="text-xs text-stone-400">{gradeLabel}</p>
        </div>
      </div>
      {phase === 'active' && (
        <button
          onClick={startNew}
          className={`text-xs font-semibold shrink-0 px-3 py-1.5 rounded-xl border ${theme.border} ${theme.accent} ${theme.accentBg} hover:opacity-80 transition-opacity`}
        >
          New problem
        </button>
      )}
    </header>
  )

  // ── IDLE ────────────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="min-h-screen flex flex-col bg-[#f5f4f2]">
        {header}
        <div className={`h-1 bg-gradient-to-r ${theme.gradient}`} />

        <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 space-y-6">

          {/* Hero */}
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-lg ${theme.glow} shadow-md shrink-0`}>
              <span className="text-2xl">{subject.icon}</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-stone-900">Solve My Problem</h1>
              <p className="text-sm text-stone-400 mt-0.5">
                Type or photograph any question — I teach through every step.
              </p>
            </div>
          </div>

          {/* Hidden file input */}
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
            <div className={`flex items-center gap-3 ${theme.accentBg} border ${theme.border} rounded-2xl px-4 py-3`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.previewUrl} alt="Problem" className="h-16 w-16 object-cover rounded-xl shrink-0 border border-stone-200" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${theme.accent}`}>Photo attached</p>
                <p className="text-xs text-stone-400">Add a note below, or solve directly</p>
              </div>
              <button onClick={() => { setPhoto(null); setPhotoError('') }} className="text-stone-400 hover:text-stone-600 p-1" aria-label="Remove">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          {photoError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              <svg className="h-4 w-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-red-700">{photoError}</p>
            </div>
          )}

          {/* Input card */}
          <div className="bg-white rounded-3xl border-2 border-stone-200 shadow-sm overflow-hidden focus-within:border-stone-300 transition-colors">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitProblem() }}
              placeholder={photo ? 'Optional: add context or a specific question about the photo...' : 'Type or paste your question here...'}
              rows={photo ? 3 : 7}
              className="w-full resize-none text-sm text-stone-800 placeholder-stone-300 focus:outline-none leading-relaxed p-5"
              autoFocus={!photo}
            />
            <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/60">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {photo ? 'Change photo' : 'Attach photo'}
              </button>
              <button
                onClick={submitProblem}
                disabled={!draft.trim() && !photo}
                className={[
                  'px-5 py-2 rounded-xl font-bold text-sm transition-all',
                  (draft.trim() || photo)
                    ? `bg-gradient-to-r ${theme.gradient} text-white shadow-md hover:opacity-90 active:scale-95`
                    : 'bg-stone-100 text-stone-300 cursor-not-allowed',
                ].join(' ')}
              >
                Solve this →
              </button>
            </div>
          </div>

          {/* Example prompts */}
          <div>
            <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider mb-3">Try an example</p>
            <div className="space-y-2">
              {examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { setDraft(ex); textareaRef.current?.focus() }}
                  className={`w-full text-left px-4 py-3 rounded-2xl border border-stone-200 bg-white text-stone-600 text-sm hover:border-stone-300 hover:text-stone-900 ${theme.hoverBorder} transition-all leading-snug`}
                >
                  <span className={`font-semibold ${theme.accent} mr-1`}>→</span> {ex}
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── ACTIVE ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-[#f5f4f2]">
      {header}
      <div className={`h-1 bg-gradient-to-r ${theme.gradient} shrink-0`} />

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 max-w-3xl w-full mx-auto">
        {messages.map((msg, i) => {
          if (showTyping && i === messages.length - 1 && msg.role === 'assistant') {
            return <TypingIndicator key={i} />
          }
          return <MessageBubble key={i} role={msg.role} content={msg.content} />
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-stone-200 bg-white px-4 py-3 shrink-0">
        {streaming ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-1.5 w-1.5 rounded-full ${theme.bar} animate-bounce`} style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="text-xs text-stone-400">Working through the solution...</p>
          </div>
        ) : (
          <div className="flex gap-2 items-end max-w-3xl mx-auto">
            <textarea
              ref={followUpRef}
              value={followUp}
              onChange={e => {
                setFollowUp(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitFollowUp() }
              }}
              placeholder="Ask to clarify any step... (Enter to send)"
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-300 leading-relaxed bg-stone-50"
            />
            <button
              onClick={submitFollowUp}
              disabled={!followUp.trim()}
              className={[
                'shrink-0 h-11 w-11 rounded-2xl flex items-center justify-center transition-all active:scale-95',
                followUp.trim()
                  ? `bg-gradient-to-br ${theme.gradient} text-white shadow-md hover:opacity-90`
                  : 'bg-stone-100 text-stone-300 cursor-not-allowed',
              ].join(' ')}
              aria-label="Send"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
