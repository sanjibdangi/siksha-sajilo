import { anthropic } from '@/lib/anthropic'
import { buildWriterPrompt } from '@/lib/prompts/writer'
import type { GradeLevel, ConfidenceLevel, Subject, LanguagePreference } from '@/types/subject'

export const maxDuration = 60

export async function POST(req: Request) {
  const { messages, subject, grade, confidence, lang } = await req.json()

  const system = buildWriterPrompt(
    subject as Subject,
    grade as GradeLevel,
    confidence as ConfidenceLevel,
    (lang as LanguagePreference) ?? 'english'
  )

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
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
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
}
