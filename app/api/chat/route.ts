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
    const syllabusContext = await getSyllabusContext(query, grade as GradeLevel, subjectId as string)

    const system = buildTutorPrompt(
      subject as Subject,
      grade as GradeLevel,
      topic as string | null,
      confidence as ConfidenceLevel,
      syllabusContext,
      (lang as LanguagePreference) ?? 'english'
    )

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system,
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
