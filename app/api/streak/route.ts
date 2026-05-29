import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createServerClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

// Nepal timezone offset: UTC+5:45
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000

function toNepalDate(isoString: string): string {
  const d = new Date(new Date(isoString).getTime() + NEPAL_OFFSET_MS)
  return d.toISOString().slice(0, 10)
}

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
    .from('progress')
    .select('session_at')
    .eq('user_id', user.id)
    .order('session_at', { ascending: false })

  if (!data?.length) {
    return Response.json({ current_streak: 0, longest_streak: 0, studied_today: false })
  }

  // Unique Nepal-timezone dates, most recent first
  const uniqueDates = Array.from(new Set(data.map(r => toNepalDate(r.session_at as string))))
    .sort((a, b) => b.localeCompare(a))

  const today = toNepalDate(new Date().toISOString())
  const yesterday = toNepalDate(new Date(Date.now() - 86400000).toISOString())

  const studiedToday = uniqueDates[0] === today

  // Current streak: count consecutive days ending today (or yesterday)
  let currentStreak = 0
  let checkDate = studiedToday ? today : yesterday
  for (const date of uniqueDates) {
    if (date === checkDate) {
      currentStreak++
      const d = new Date(checkDate + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() - 1)
      checkDate = d.toISOString().slice(0, 10)
    } else if (date < checkDate) {
      break
    }
  }

  // Longest streak ever
  let longestStreak = 0
  let run = 1
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1] + 'T00:00:00Z')
    const curr = new Date(uniqueDates[i] + 'T00:00:00Z')
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000)
    if (diffDays === 1) {
      run++
    } else {
      longestStreak = Math.max(longestStreak, run)
      run = 1
    }
  }
  longestStreak = Math.max(longestStreak, run)

  return Response.json({ current_streak: currentStreak, longest_streak: longestStreak, studied_today: studiedToday })
}
