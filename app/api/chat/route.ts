import { anthropic } from '@/lib/anthropic'
import { getSyllabusContext } from '@/lib/rag'
import { buildTutorPrompt } from '@/lib/prompts/tutor'
import { checkAndIncrementUsage } from '@/lib/checkUsage'
import type { GradeLevel, ConfidenceLevel, Subject, LanguagePreference } from '@/types/subject'
import { NextRequest } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const usage = await checkAndIncrementUsage(req)
    if (!usage.allowed) {
      return Response.json(
        { error: `Daily limit reached (${usage.limit} messages/day). Come back tomorrow — consistency is how you ace the SEE.` },
        { status: 429 }
      )
    }

    const { messages, subject, grade, topic, confidence, subjectId, lang } = await req.json()

    const lastMsg = messages.at(-1)
    const query = typeof lastMsg?.content === 'string' ? lastMsg.content : ''
    // Race RAG against a 700ms timeout — if Voyage AI or Supabase is slow, start
    // streaming immediately with empty context rather than making the user wait.
    // The in-memory cache in lib/rag.ts means subsequent identical queries are free.
    const syllabusContext = await Promise.race([
      getSyllabusContext(query, grade as GradeLevel, subjectId as string),
      new Promise<string>(resolve => setTimeout(() => resolve(''), 700)),
    ])

    const system = buildTutorPrompt(
      subject as Subject,
      grade as GradeLevel,
      topic as string | null,
      confidence as ConfidenceLevel,
      syllabusContext,
      (lang as LanguagePreference) ?? 'english'
    )

    // cache_control marks the system prompt for Anthropic's prompt caching.
    // On cache hits (same subject/grade/topic/confidence) TTFB drops ~200-300ms
    // and input token cost falls by 90%.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const systemBlocks: any = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]

    // For conversations 4+ exchanges deep, mark the second-to-last assistant
    // message with cache_control. The next turn only pays cache-read rates
    // (~$0.30/M) for everything before it instead of full input rates (~$3/M).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cachedMessages: any[] = messages.length >= 8
      ? messages.map((msg: { role: string; content: string }, i: number) => {
          if (i === messages.length - 2 && msg.role === 'assistant') {
            return { ...msg, content: [{ type: 'text', text: msg.content, cache_control: { type: 'ephemeral' } }] }
          }
          return msg
        })
      : messages

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemBlocks,
      messages: cachedMessages,
      stream: true,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err instanceof Error ? err : new Error('Stream failed'))
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('[/api/chat]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
