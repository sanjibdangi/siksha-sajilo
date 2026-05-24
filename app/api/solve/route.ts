import { anthropic } from '@/lib/anthropic'
import { buildSolverPrompt } from '@/lib/prompts/solver'
import type { GradeLevel, ConfidenceLevel, Subject, LanguagePreference } from '@/types/subject'

export const maxDuration = 60

export async function POST(req: Request) {
  const { messages, subject, grade, confidence, lang, imageBase64, imageMediaType } = await req.json()

  const system = buildSolverPrompt(
    subject as Subject,
    grade as GradeLevel,
    confidence as ConfidenceLevel,
    (lang as LanguagePreference) ?? 'english'
  )

  // If an image was attached, inject it into the first user message as a content block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let apiMessages: any[] = messages
  if (imageBase64 && imageMediaType) {
    apiMessages = messages.map((msg: { role: string; content: string }, i: number) => {
      if (i === 0 && msg.role === 'user') {
        return {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageMediaType, data: imageBase64 } },
            { type: 'text', text: msg.content || 'Please solve this problem from the photo.' },
          ],
        }
      }
      return msg
    })
  }

  const stream = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system,
    messages: apiMessages,
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
}
