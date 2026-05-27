'use client'

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

const PROSE_CLASSES = [
  'text-sm leading-relaxed',
  'prose prose-sm max-w-none',
  'prose-p:my-1.5 prose-p:text-stone-700',
  'prose-headings:my-2 prose-headings:font-bold prose-headings:text-stone-900',
  'prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-li:text-stone-700',
  'prose-strong:font-bold prose-strong:text-stone-900',
  'prose-code:bg-stone-100 prose-code:text-green-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:border prose-code:border-stone-200',
  'prose-pre:bg-stone-900 prose-pre:text-stone-100 prose-pre:rounded-xl prose-pre:p-4 prose-pre:overflow-x-auto prose-pre:my-3 prose-pre:text-xs prose-pre:leading-snug',
  'prose-pre:prose-code:bg-transparent prose-pre:prose-code:border-0 prose-pre:prose-code:p-0 prose-pre:prose-code:text-green-300',
  'prose-table:text-xs prose-table:border-collapse prose-table:my-3 prose-table:w-full',
  'prose-th:bg-stone-100 prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:font-semibold prose-th:border prose-th:border-stone-200',
  'prose-td:px-3 prose-td:py-1.5 prose-td:border prose-td:border-stone-200',
  'prose-blockquote:border-l-4 prose-blockquote:border-green-500 prose-blockquote:bg-green-50 prose-blockquote:pl-3 prose-blockquote:py-1 prose-blockquote:my-2 prose-blockquote:not-italic prose-blockquote:text-green-800 prose-blockquote:rounded-r-lg',
].join(' ')

export function MessageBubble({ role, content, isStreaming = false }: MessageBubbleProps) {
  const isUser = role === 'user'

  const renderedMarkdown = useMemo(
    () => <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>,
    [content]
  )

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={[
        'h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black select-none',
        isUser
          ? 'bg-green-600 text-white'
          : 'bg-stone-100 text-green-700 border border-stone-200',
      ].join(' ')}>
        {isUser ? 'You' : '✦'}
      </div>

      <div className={[
        'max-w-[82%] rounded-2xl px-4 py-3',
        isUser
          ? 'bg-green-600 text-white rounded-tr-sm'
          : 'bg-white text-stone-800 rounded-tl-sm border border-stone-200 shadow-sm',
      ].join(' ')}>
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <div className={PROSE_CLASSES}>
            {renderedMarkdown}
            {isStreaming && (
              <span className="inline-block w-0.5 h-3.5 bg-stone-400 ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
