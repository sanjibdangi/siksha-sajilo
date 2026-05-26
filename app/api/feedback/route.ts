import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getCurrentYearBs } from '@/lib/yearConfig'

export async function POST(req: Request) {
  const { subjectId, grade, topic, mode, rating } = await req.json()
  if (!subjectId || !grade || !mode || (rating !== 1 && rating !== -1)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createServerClient()
  const [{ data: { user } }, yearBs] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentYearBs(),
  ])

  await supabase.from('feedback').insert({
    user_id: user?.id ?? null,
    subject_id: subjectId,
    grade,
    topic: topic ?? null,
    mode,
    rating,
    year_bs: yearBs,
  })

  return NextResponse.json({ ok: true })
}

export async function GET(req: Request) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const activeYear = await getCurrentYearBs()

  const { data, error } = await supabase
    .from('feedback')
    .select('subject_id, grade, topic, mode, rating, created_at')
    .eq('year_bs', activeYear)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []

  // Aggregate by subject + grade + topic
  const map = new Map<string, {
    subject_id: string
    grade: string
    topic: string
    total: number
    positive: number
    recent: number   // ratings in last 7 days
  }>()

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  for (const row of rows) {
    const key = `${row.subject_id}||${row.grade}||${row.topic ?? 'General'}`
    if (!map.has(key)) {
      map.set(key, {
        subject_id: row.subject_id,
        grade: row.grade,
        topic: row.topic ?? 'General',
        total: 0,
        positive: 0,
        recent: 0,
      })
    }
    const e = map.get(key)!
    e.total++
    if (row.rating === 1) e.positive++
    if (new Date(row.created_at).getTime() > sevenDaysAgo) e.recent++
  }

  const insights = Array.from(map.values())
    .filter(e => e.total >= 5)
    .map(e => ({ ...e, satisfaction: Math.round((e.positive / e.total) * 100) }))
    .sort((a, b) => a.satisfaction - b.satisfaction)

  const totalRatings = rows.length
  const totalPositive = rows.filter(r => r.rating === 1).length
  const overallSatisfaction = totalRatings > 0 ? Math.round((totalPositive / totalRatings) * 100) : null
  const ratingsThisWeek = rows.filter(r => new Date(r.created_at).getTime() > sevenDaysAgo).length
  const lowRatedTopics = insights.filter(i => i.satisfaction < 60).length

  return NextResponse.json({
    insights,
    summary: { totalRatings, overallSatisfaction, ratingsThisWeek, lowRatedTopics },
  })
}
