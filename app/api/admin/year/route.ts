import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getCurrentYearBs, invalidateYearCache } from '@/lib/yearConfig'

export async function GET(req: Request) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const year = await getCurrentYearBs()
  return NextResponse.json({ current_year_bs: year, academic_year: `${year}-${year + 1} BS` })
}

export async function POST(req: Request) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { year_bs } = await req.json()
  if (!year_bs || typeof year_bs !== 'number' || year_bs < 2080 || year_bs > 2120) {
    return NextResponse.json({ error: 'Invalid year_bs' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('admin_config')
    .upsert({ key: 'current_year_bs', value: String(year_bs), updated_at: new Date().toISOString() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateYearCache()

  return NextResponse.json({
    ok: true,
    current_year_bs: year_bs,
    academic_year: `${year_bs}-${year_bs + 1} BS`,
    message: `System is now using syllabus for ${year_bs}-${year_bs + 1} BS academic year.`,
  })
}
