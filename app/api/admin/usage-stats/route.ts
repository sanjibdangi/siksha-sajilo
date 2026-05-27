import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function isAdmin(req: Request) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET
}

export async function GET(req: Request) {
  if (!isAdmin(req)) return unauthorized()

  const supabase = createServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const [usageRes, configRes] = await Promise.all([
    supabase.from('daily_usage').select('count').eq('date', today),
    supabase.from('admin_config').select('value').eq('key', 'daily_limit_trial').single(),
  ])

  const rows = usageRes.data ?? []
  const limit = configRes.data ? parseInt(configRes.data.value) : 100

  return NextResponse.json({
    totalInteractions: rows.reduce((sum, r) => sum + (r.count as number), 0),
    uniqueUsers: rows.length,
    usersAtLimit: rows.filter(r => (r.count as number) >= limit).length,
    currentLimit: limit,
  })
}
