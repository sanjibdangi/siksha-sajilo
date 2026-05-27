import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { embed } from '@/lib/embeddings'
import { getCurrentYearBs } from '@/lib/yearConfig'

function isAdmin(req: Request) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET
}

// GET — list discovery queue items and recent runs
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? 'pending'

  const supabase = createServerClient()

  const [queueRes, runsRes] = await Promise.all([
    supabase
      .from('auto_discovery_queue')
      .select('id, source_url, source_site, detected_title, detected_grade, detected_subject, detected_year_bs, content_type, word_count, quality_score, quality_notes, status, discovered_at')
      .eq('status', status)
      .order('quality_score', { ascending: false })
      .order('discovered_at', { ascending: false })
      .limit(50),
    supabase
      .from('discovery_runs')
      .select('ran_at, sources_checked, new_found, errors, summary')
      .order('ran_at', { ascending: false })
      .limit(5),
  ])

  const counts = await supabase
    .from('auto_discovery_queue')
    .select('status')

  const statusCounts: Record<string, number> = {}
  for (const r of counts.data ?? []) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
  }

  return NextResponse.json({
    items: queueRes.data ?? [],
    recentRuns: runsRes.data ?? [],
    counts: statusCounts,
  })
}

// PATCH — approve or reject a queued item
export async function PATCH(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, action } = await req.json() as { id: string; action: 'approve' | 'reject' }
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createServerClient()

  if (action === 'reject') {
    await supabase
      .from('auto_discovery_queue')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ ok: true, action: 'rejected' })
  }

  // Approve: ingest into knowledge_sources
  const { data: item, error: fetchErr } = await supabase
    .from('auto_discovery_queue')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  if (!item.raw_content) return NextResponse.json({ error: 'No content to ingest' }, { status: 422 })

  const yearBs = item.detected_year_bs ?? (await getCurrentYearBs())
  const grade = item.detected_grade ?? '10'
  const subjectId = item.detected_subject ?? 'science'

  let embedding: number[] | null = null
  try {
    embedding = await embed(item.raw_content.slice(0, 2000))
  } catch {
    // Non-fatal
  }

  const { data: ks, error: ksErr } = await supabase
    .from('knowledge_sources')
    .insert({
      source_type: item.content_type ?? 'article',
      title: item.detected_title,
      source_url: item.source_url,
      grade,
      subject_id: subjectId,
      year_bs: yearBs,
      topic_tags: [item.detected_subject, item.content_type, item.source_site].filter(Boolean),
      raw_content: item.raw_content,
      word_count: item.word_count,
      status: 'active',
      embedding,
    })
    .select('id')
    .single()

  if (ksErr) return NextResponse.json({ error: ksErr.message }, { status: 500 })

  await supabase
    .from('auto_discovery_queue')
    .update({
      status: 'ingested',
      reviewed_at: new Date().toISOString(),
      knowledge_source_id: ks.id,
    })
    .eq('id', id)

  return NextResponse.json({ ok: true, action: 'ingested', knowledgeSourceId: ks.id })
}

// POST — manually trigger a discovery run (admin can trigger without waiting for cron)
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cronSecret = process.env.CRON_SECRET
  const host = req.headers.get('host') ?? 'siksha-sajilo.vercel.app'
  const protocol = host.includes('localhost') ? 'http' : 'https'

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cronSecret) headers['authorization'] = `Bearer ${cronSecret}`

  const res = await fetch(`${protocol}://${host}/api/cron/discover`, { headers })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
