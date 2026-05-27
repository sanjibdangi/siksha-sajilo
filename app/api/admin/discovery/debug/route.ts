import { NextResponse } from 'next/server'

function isAdmin(req: Request) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET
}

const FETCH_TIMEOUT_MS = 10000

async function fetchPage(url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SikshaSajiloBot/1.0)' },
    })
    if (!res.ok) return { error: `HTTP ${res.status}`, links: [], text: '' }
    const html = await res.text()
    const origin = new URL(url).origin

    const links: Array<{ href: string; text: string }> = []
    const anchorRe = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
    let match
    while ((match = anchorRe.exec(html)) !== null) {
      const rawHref = match[1].trim()
      const linkText = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      if (!linkText || linkText.length < 3) continue
      if (/^(Home|About|Contact|Login|Register|Search|Menu|Tag|Category|Archive|Privacy|Terms)$/i.test(linkText)) continue
      try {
        const absolute = rawHref.startsWith('http') ? rawHref : new URL(rawHref, origin).href
        links.push({ href: absolute, text: linkText.slice(0, 120) })
      } catch { /* skip */ }
    }

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ').trim()
      .slice(0, 1000)

    return { htmlLength: html.length, links: links.slice(0, 30), text, error: null }
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const testUrl = url.searchParams.get('url')
  if (!testUrl) return NextResponse.json({ error: 'Pass ?url=<url> to test' }, { status: 400 })

  const result = await fetchPage(testUrl)
  return NextResponse.json(result)
}
