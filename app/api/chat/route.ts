import { anthropic } from '@/lib/anthropic'
import { getSyllabusContext } from '@/lib/rag'
import { buildTutorPrompt } from '@/lib/prompts/tutor'
import type { GradeLevel, ConfidenceLevel, Subject, LanguagePreference } from '@/types/subject'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
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
    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemBlocks,
      messages,
      stream: true,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        controller.close()
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
