import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function isAdmin(req: Request) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET
}

const ALLOWED_KEYS = ['daily_limit_trial', 'current_year_bs']

export async function GET(req: Request) {
  if (!isAdmin(req)) return unauthorized()

  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (!key || !ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('admin_config')
    .select('key, value, updated_at')
    .eq('key', key)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  if (!isAdmin(req)) return unauthorized()

  const { key, value } = await req.json()
  if (!key || !ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }
  if (value === undefined || value === null || String(value).trim() === '') {
    return NextResponse.json({ error: 'value required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('admin_config')
    .upsert({ key, value: String(value), updated_at: new Date().toISOString() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, key, value: String(value) })
}
