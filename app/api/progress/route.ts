import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createServerClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

async function getSessionUser(req: NextRequest) {
  try {
    const supabase = createSSRClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', user.id)
    .order('session_at', { ascending: false })
    .limit(100)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ progress: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { subjectId, topic, mode, score, total, durationS } = body

  if (!subjectId || !mode) {
    return Response.json({ error: 'subjectId and mode required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('progress').insert({
    user_id: user.id,
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
