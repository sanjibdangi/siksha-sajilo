'use client'

import { useState, useRef, useEffect, memo, useMemo, useCallback } from 'react'
import { MessageBubble as MessageBubbleBase } from './MessageBubble'

// Prevent completed messages from re-rendering on every streaming chunk
const MessageBubble = memo(MessageBubbleBase)
import { QuickPrompts } from './QuickPrompts'
import { TypingIndicator } from './TypingIndicator'
import type { Subject, GradeLevel, ConfidenceLevel, LanguagePreference } from '@/types/subject'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
import { recordProgress } from '@/lib/recordProgress'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatInterfaceProps {
  subject: Subject
  subjectId: string
  grade: GradeLevel
  confidence: ConfidenceLevel
  topic: string | null
  lang: LanguagePreference
  welcomeMessage: string
}

export function ChatInterface({ subject, subjectId, grade, confidence, topic, lang, welcomeMessage }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasRecordedRef = useRef(false)
  // Buffer incoming stream chunks between rAF ticks so React renders at most
  // once per animation frame (~60fps) instead of on every network chunk.
  const streamBufferRef = useRef('')
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const text = streamBufferRef.current
      if (!text) return
      streamBufferRef.current = ''
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = {
          ...next[next.length - 1],
          content: next[next.length - 1].content + text,
        }
        return next
      })
    })
  }, [])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    const userMsg: Message = { role: 'user', content: trimmed }
    const apiMessages = [...messages, userMsg]

    setMessages([...apiMessages, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, subject, grade, topic, confidence, subjectId, lang }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error ?? `Server error ${res.status}`)
      }
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      streamBufferRef.current = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        streamBufferRef.current += decoder.decode(value, { stream: true })
        scheduleFlush()
      }

      // Cancel any pending rAF and do a final synchronous flush so the last
      // chunk is committed before setStreaming(false) clears the streaming state.
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      const remaining = streamBufferRef.current
      streamBufferRef.current = ''
      if (remaining) {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + remaining }
          return next
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: `Something went wrong: ${msg}\n\nPlease try again.` }
        return updated
      })
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
      if (!hasRecordedRef.current) {
        hasRecordedRef.current = true
        recordProgress({ subjectId, topic, mode: 'tutor' })
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
  }

  const lastMsg = messages[messages.length - 1]
  const showTyping = streaming && lastMsg?.role === 'assistant' && lastMsg.content === ''

  // Split so that only the last bubble re-renders on every streaming chunk.
  // completedMessages is stable while streaming; only streamingMsg changes.
  const completedMessages = useMemo(
    () => (streaming ? messages.slice(0, -1) : messages),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [streaming ? messages.length - 1 : messages.length, streaming]
  )
  const streamingMsg = streaming ? messages[messages.length - 1] : null

  return (
    <div className="flex flex-col h-full bg-[#faf9f7]">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        <MessageBubble role="assistant" content={welcomeMessage} />

        {messages.length === 0 && (
          <QuickPrompts grade={grade} onSelect={sendMessage} />
        )}

        {completedMessages.map((msg, i) => (
          <div key={i}>
            <MessageBubble role={msg.role} content={msg.content} />
            {msg.role === 'assistant' && (
              <FeedbackWidget
                subjectId={subjectId}
                grade={grade}
                topic={topic}
                mode="tutor"
                onStillConfused={() => sendMessage("I'm still confused. Can you explain this a completely different way?")}
              />
            )}
          </div>
        ))}

        {showTyping && <TypingIndicator />}
        {streamingMsg && !showTyping && (
          <MessageBubble key="streaming" role="assistant" content={streamingMsg.content} isStreaming />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-stone-200 bg-white px-4 py-3 shrink-0">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 leading-relaxed transition-all"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className={[
              'shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center transition-all',
              input.trim() && !streaming
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm active:scale-95'
                : 'bg-stone-100 text-stone-300 cursor-not-allowed border border-stone-200',
            ].join(' ')}
            aria-label="Send"
          >
            {streaming ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-stone-400 text-center mt-2">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
