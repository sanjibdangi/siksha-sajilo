import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function checkSecret(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  return secret === process.env.ADMIN_SECRET
}

// GET /api/admin/users — list all auth users + their profiles
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 500 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = users.map(u => u.id)
  const { data: profiles } = await supabase
    .from('users')
    .select('id, name, grade, school, district, medium')
    .in('id', ids)

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const rows = users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    ...profileMap[u.id],
  }))

  return NextResponse.json({ users: rows })
}

// POST /api/admin/users — create a new user
export async function POST(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, password, name, grade } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'email and password are required' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, grade },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Insert profile row if name/grade provided
  if (name || grade) {
    await supabase.from('users').upsert({
      id: data.user.id,
      name: name || null,
      grade: grade || null,
    })
  }

  return NextResponse.json({ user: data.user }, { status: 201 })
}

// DELETE /api/admin/users?id=<uuid> — delete a user
export async function DELETE(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
