import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { embed } from '@/lib/embeddings'
import { getCurrentYearBs } from '@/lib/yearConfig'

// youtube-transcript uses web scraping — no per-video API key needed
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { YoutubeTranscript } = require('youtube-transcript')

const BATCH_SIZE = 5
const DELAY_MS = 2000

function isAdmin(req: Request) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// GET /api/admin/channel-ingest/[jobId] — job status + per-video breakdown
export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params

  const supabase = createServerClient()

  const [jobRes, videosRes] = await Promise.all([
    supabase
      .from('channel_ingest_jobs')
      .select('id, channel_url, channel_handle, grade, subject_id, year_bs, total_videos, status, error_msg, created_at, updated_at')
      .eq('id', jobId)
      .single(),
    supabase
      .from('channel_ingest_videos')
      .select('id, video_id, video_title, video_url, status, error_msg, knowledge_source_id')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true }),
  ])

  if (jobRes.error) return NextResponse.json({ error: jobRes.error.message }, { status: 404 })

  const videos = videosRes.data ?? []
  const done = videos.filter((v) => v.status === 'done').length
  const skipped = videos.filter((v) => v.status === 'skipped').length
  const errors = videos.filter((v) => v.status === 'error').length
  const pending = videos.filter((v) => v.status === 'pending').length

  return NextResponse.json({
    job: jobRes.data,
    stats: { done, skipped, errors, pending, total: videos.length },
    videos,
  })
}

// POST /api/admin/channel-ingest/[jobId]
// Body: { action: 'process' | 'reset' }
// Processes the next BATCH_SIZE pending videos. Designed to be called repeatedly until pending=0.
export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { jobId } = await params
  const { action } = await req.json()

  const supabase = createServerClient()

  if (action === 'reset') {
    await supabase
      .from('channel_ingest_videos')
      .update({ status: 'pending', error_msg: null })
      .eq('job_id', jobId)
      .eq('status', 'error')
    await supabase.from('channel_ingest_jobs').update({ status: 'paused', error_msg: null }).eq('id', jobId)
    return NextResponse.json({ ok: true })
  }

  // Mark job as running
  await supabase.from('channel_ingest_jobs').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', jobId)

  // Fetch job metadata
  const { data: job, error: jobErr } = await supabase
    .from('channel_ingest_jobs')
    .select('grade, subject_id, year_bs')
    .eq('id', jobId)
    .single()

  if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const activeYear = job.year_bs || (await getCurrentYearBs())

  // Fetch next batch of pending videos
  const { data: pending } = await supabase
    .from('channel_ingest_videos')
    .select('id, video_id, video_title, video_url')
    .eq('job_id', jobId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  const videos = pending ?? []
  const processed: Array<{ videoId: string; status: string }> = []

  for (const video of videos) {
    try {
      // Fetch transcript
      const transcriptItems: Array<{ text: string }> = await YoutubeTranscript.fetchTranscript(video.video_id, { lang: 'en' }).catch(
        () => YoutubeTranscript.fetchTranscript(video.video_id)
      )

      if (!transcriptItems?.length) {
        await supabase
          .from('channel_ingest_videos')
          .update({ status: 'skipped', error_msg: 'No transcript available' })
          .eq('id', video.id)
        processed.push({ videoId: video.video_id, status: 'skipped' })
        await sleep(DELAY_MS)
        continue
      }

      const rawContent = transcriptItems
        .map((t) => t.text.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')

      // Generate embedding
      let embedding: number[] | null = null
      try {
        embedding = await embed(rawContent.slice(0, 2000))
      } catch {
        // Save without embedding — won't appear in RAG but content is preserved
      }

      // Save to knowledge_sources
      const { data: ks, error: ksErr } = await supabase
        .from('knowledge_sources')
        .insert({
          source_type: 'youtube',
          title: video.video_title,
          source_url: video.video_url,
          grade: job.grade,
          subject_id: job.subject_id,
          year_bs: activeYear,
          raw_content: rawContent,
          word_count: rawContent.split(/\s+/).length,
          status: 'active',
          embedding,
        })
        .select('id')
        .single()

      if (ksErr) {
        await supabase
          .from('channel_ingest_videos')
          .update({ status: 'error', error_msg: ksErr.message })
          .eq('id', video.id)
        processed.push({ videoId: video.video_id, status: 'error' })
      } else {
        await supabase
          .from('channel_ingest_videos')
          .update({ status: 'done', knowledge_source_id: ks.id })
          .eq('id', video.id)
        processed.push({ videoId: video.video_id, status: 'done' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      // Detect YouTube rate-limiting
      const isRateLimit = /too many|rate.?limit|429|quota/i.test(msg)
      await supabase
        .from('channel_ingest_videos')
        .update({ status: 'error', error_msg: isRateLimit ? 'Rate limited — retry later' : msg })
        .eq('id', video.id)
      processed.push({ videoId: video.video_id, status: 'error' })

      if (isRateLimit) {
        // Pause the job so the admin knows to resume later
        await supabase
          .from('channel_ingest_jobs')
          .update({ status: 'paused', error_msg: 'Rate limited by YouTube — resume later', updated_at: new Date().toISOString() })
          .eq('id', jobId)
        return NextResponse.json({ ok: true, processed, rateLimited: true })
      }
    }

    await sleep(DELAY_MS)
  }

  // Check if any pending remain
  const { count } = await supabase
    .from('channel_ingest_videos')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('status', 'pending')

  const finalStatus = (count ?? 0) === 0 ? 'completed' : 'paused'
  await supabase
    .from('channel_ingest_jobs')
    .update({ status: finalStatus, error_msg: null, updated_at: new Date().toISOString() })
    .eq('id', jobId)

  return NextResponse.json({ ok: true, processed, remaining: count ?? 0, jobStatus: finalStatus })
}
