'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { MessageBubble } from '@/components/tutor/MessageBubble'
import { TypingIndicator } from '@/components/tutor/TypingIndicator'
import type { Subject, GradeLevel, ConfidenceLevel, LanguagePreference } from '@/types/subject'
import { recordProgress } from '@/lib/recordProgress'

const WRITING_TYPES = [
  { id: 'essay', label: 'Essay' },
  { id: 'letter', label: 'Letter' },
  { id: 'paragraph', label: 'Paragraph' },
  { id: 'story', label: 'Story / Narrative' },
  { id: 'report', label: 'Report' },
  { id: 'other', label: 'Other' },
]

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface WriteClientProps {
  subject: Subject
  subjectId: string
  grade: GradeLevel
  confidence: ConfidenceLevel
  topic: string | null
  lang: LanguagePreference
}

export function WriteClient({ subject, subjectId, grade, confidence, topic, lang }: WriteClientProps) {
  const [phase, setPhase] = useState<'idle' | 'active'>('idle')
  const [writingType, setWritingType] = useState('essay')
  const [draft, setDraft] = useState(topic ? `Write a ${topic}` : '')
  const [messages, setMessages] = useState<Message[]>([])
  const [followUp, setFollowUp] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const followUpRef = useRef<HTMLTextAreaElement>(null)
  const hasRecordedRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!streaming && phase === 'active') {
      followUpRef.current?.focus()
    }
  }, [streaming, phase])

  async function streamResponse(history: Message[]) {
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, subject, grade, confidence, lang }),
      })

      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: text }
          return updated
        })
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.' }
        return updated
      })
    } finally {
      setStreaming(false)
      if (!hasRecordedRef.current) {
        hasRecordedRef.current = true
        recordProgress({ subjectId, topic, mode: 'write' })
      }
    }
  }

  function handleSubmit() {
    if (!draft.trim()) return
    const taskLabel = writingType !== 'other' ? `[${WRITING_TYPES.find(t => t.id === writingType)?.label}] ` : ''
    const userMessage: Message = { role: 'user', content: `${taskLabel}${draft.trim()}` }
    const history: Message[] = [userMessage]
    setMessages([userMessage])
    setPhase('active')
    streamResponse(history)
  }

  function handleFollowUp(e: React.FormEvent) {
    e.preventDefault()
    if (!followUp.trim() || streaming) return
    const userMessage: Message = { role: 'user', content: followUp.trim() }
    const history: Message[] = [...messages, userMessage]
    setMessages(history)
    setFollowUp('')
    streamResponse(history)
  }

  const gradeLabel = grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`

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
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{subject.icon}</span>
          <div className="min-w-0">
            <p className="font-semibold text-stone-900 text-sm leading-tight truncate">
              {subject.name} · Writing Assistant
            </p>
            <p className="text-xs text-stone-400">{gradeLabel}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-4">

        {/* Idle — task input */}
        {phase === 'idle' && (
          <div className="flex-1 flex flex-col justify-center gap-6 py-8">
            <div className="space-y-1">
              <h2 className="font-bold text-stone-900 text-lg">What do you need to write?</h2>
              <p className="text-sm text-stone-400">
                Paste your question or writing task. I&apos;ll teach you how to write it, not just do it for you.
              </p>
            </div>

            {/* Writing type selector */}
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Type of writing</p>
              <div className="flex flex-wrap gap-2">
                {WRITING_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setWritingType(t.id)}
                    className={[
                      'px-3 py-1.5 rounded-xl text-sm font-medium border transition-all',
                      writingType === t.id
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300',
                    ].join(' ')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Task input */}
            <div className="space-y-3">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={`Paste your writing question here...\n\nExamples:\n• Write an essay on the importance of trees.\n• Write a formal letter to your school principal requesting leave.\n• Write a paragraph about your favourite festival.`}
                rows={6}
                className="w-full px-4 py-3 rounded-2xl border-2 border-stone-200 bg-white text-stone-900 text-sm focus:outline-none focus:border-emerald-400 resize-none leading-relaxed placeholder:text-stone-300"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={!draft.trim()}
                className={[
                  'w-full py-4 rounded-2xl font-black text-sm transition-all',
                  draft.trim()
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-[0.98]'
                    : 'bg-stone-100 text-stone-400 cursor-not-allowed',
                ].join(' ')}
              >
                Teach me how to write this →
              </button>
              <p className="text-center text-xs text-stone-400">Ctrl+Enter to submit</p>
            </div>
          </div>
        )}

        {/* Active — conversation */}
        {phase === 'active' && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 py-6 space-y-4 overflow-y-auto">
              {messages.map((msg, i) => (
                <MessageBubble key={i} role={msg.role} content={msg.content} />
              ))}
              {streaming && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="bg-white border border-stone-200 rounded-2xl px-4 py-3 shadow-sm">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Follow-up input */}
            <div className="border-t border-stone-200 bg-white py-3 shrink-0">
              <form onSubmit={handleFollowUp} className="flex gap-2 items-end">
                <textarea
                  ref={followUpRef}
                  value={followUp}
                  onChange={e => setFollowUp(e.target.value)}
                  placeholder="Ask for a revision, explanation, or share your own attempt..."
                  rows={2}
                  disabled={streaming}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 text-sm focus:outline-none focus:border-emerald-400 resize-none leading-relaxed disabled:opacity-50"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleFollowUp(e)
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!followUp.trim() || streaming}
                  className="shrink-0 h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Send"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
