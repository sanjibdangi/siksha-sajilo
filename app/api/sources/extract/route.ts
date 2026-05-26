import { NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? ''

  // ── YouTube URL ────────────────────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'Missing URL' }, { status: 400 })

    try {
      const segments = await YoutubeTranscript.fetchTranscript(url)
      if (!segments?.length) throw new Error('No transcript found')
      const text = segments.map((s: { text: string }) => s.text).join(' ')
      return NextResponse.json({ text, wordCount: text.split(/\s+/).length })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      if (msg.includes('disabled') || msg.includes('Could not find')) {
        return NextResponse.json(
          { error: 'This video has no captions. Try a different video or upload the content as a text file.' },
          { status: 422 }
        )
      }
      return NextResponse.json({ error: `Could not fetch transcript: ${msg}` }, { status: 500 })
    }
  }

  // ── File upload (PDF / DOCX / TXT) ────────────────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const sourceType = form.get('sourceType') as string | null

    if (!file || !sourceType) {
      return NextResponse.json({ error: 'Missing file or sourceType' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    try {
      let text = ''

      if (sourceType === 'text') {
        text = buffer.toString('utf-8')
      }

      if (sourceType === 'pdf') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
        const data = await pdfParse(buffer)
        text = data.text
      }

      if (sourceType === 'docx') {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
      }

      if (!text.trim()) {
        return NextResponse.json({ error: 'Could not extract any text from this file.' }, { status: 422 })
      }

      return NextResponse.json({ text: text.trim(), wordCount: text.trim().split(/\s+/).length })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Extraction failed'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unsupported content-type' }, { status: 415 })
}
