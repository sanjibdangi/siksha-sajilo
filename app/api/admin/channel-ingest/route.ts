import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function isAdmin(req: Request) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET
}

// POST /api/admin/channel-ingest
// Body: { channelUrl, channelHandle, grade, subjectId, yearBs }
// Scans the channel via YouTube Data API and creates a job + video rows.
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channelUrl, channelHandle, grade, subjectId, yearBs } = await req.json()
  if (!channelUrl || !grade || !subjectId || !yearBs) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 })

  const supabase = createServerClient()

  // Resolve channel handle/URL to a channelId
  let channelId: string | null = null

  // Try to extract channel ID from URL patterns
  const idMatch = channelUrl.match(/\/channel\/([A-Za-z0-9_-]+)/)
  if (idMatch) {
    channelId = idMatch[1]
  } else {
    // Use handle-based search via forHandle parameter
    const handle = (channelHandle || channelUrl.match(/@([A-Za-z0-9_]+)/)?.[1] || '').replace('@', '')
    if (!handle) return NextResponse.json({ error: 'Could not extract channel handle from URL' }, { status: 400 })

    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${apiKey}`
    )
    const searchData = await searchRes.json()
    if (searchData.error) return NextResponse.json({ error: `YouTube API: ${searchData.error.message}` }, { status: 502 })
    channelId = searchData.items?.[0]?.id ?? null
  }

  if (!channelId) return NextResponse.json({ error: 'Channel not found on YouTube' }, { status: 404 })

  // Create the job row first
  const { data: job, error: jobErr } = await supabase
    .from('channel_ingest_jobs')
    .insert({
      channel_url: channelUrl,
      channel_handle: channelHandle || null,
      grade,
      subject_id: subjectId,
      year_bs: yearBs,
      status: 'running',
    })
    .select('id')
    .single()

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })

  // Paginate through all uploads playlist videos
  const uploadsPlaylistId = channelId.replace(/^UC/, 'UU')
  const videoRows: Array<{ job_id: string; video_id: string; video_title: string; video_url: string }> = []
  let pageToken: string | undefined

  try {
    do {
      const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('playlistId', uploadsPlaylistId)
      url.searchParams.set('maxResults', '50')
      url.searchParams.set('key', apiKey)
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      const res = await fetch(url.toString())
      const data = await res.json()

      if (data.error) {
        await supabase.from('channel_ingest_jobs').update({ status: 'error', error_msg: data.error.message }).eq('id', job.id)
        return NextResponse.json({ error: `YouTube API: ${data.error.message}` }, { status: 502 })
      }

      for (const item of data.items ?? []) {
        const vid = item.snippet?.resourceId?.videoId
        const title = item.snippet?.title
        if (vid && title !== 'Deleted video' && title !== 'Private video') {
          videoRows.push({
            job_id: job.id,
            video_id: vid,
            video_title: title,
            video_url: `https://www.youtube.com/watch?v=${vid}`,
          })
        }
      }

      pageToken = data.nextPageToken
    } while (pageToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error fetching playlist'
    await supabase.from('channel_ingest_jobs').update({ status: 'error', error_msg: msg }).eq('id', job.id)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Bulk-insert video rows (ignore duplicates)
  if (videoRows.length) {
    await supabase.from('channel_ingest_videos').upsert(videoRows, { onConflict: 'job_id,video_id', ignoreDuplicates: true })
  }

  // Update job with total count and pause (processing happens per-batch via [jobId] route)
  await supabase
    .from('channel_ingest_jobs')
    .update({ total_videos: videoRows.length, status: 'paused' })
    .eq('id', job.id)

  return NextResponse.json({ ok: true, jobId: job.id, totalVideos: videoRows.length })
}

// GET /api/admin/channel-ingest — list all jobs
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('channel_ingest_jobs')
    .select('id, channel_url, channel_handle, grade, subject_id, year_bs, total_videos, status, error_msg, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data ?? [] })
}
