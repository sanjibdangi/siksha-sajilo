import { createServerClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', userId)
    .order('session_at', { ascending: false })
    .limit(100)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ progress: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, subjectId, topic, mode, score, total, durationS } = body

  if (!userId || !subjectId || !mode) {
    return Response.json({ error: 'userId, subjectId, mode required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('progress').insert({
    user_id: userId,
    subject_id: subjectId,
    topic: topic ?? null,
    mode,
    score: score ?? null,
    total: total ?? null,
    duration_s: durationS ?? null,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
