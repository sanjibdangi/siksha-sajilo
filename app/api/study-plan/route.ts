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
  const { data } = await supabase
    .from('study_plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('generated_at', { ascending: false })
    .limit(1)

  return Response.json({ plan: data?.[0] ?? null })
}
