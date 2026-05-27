import { createServerClient } from '@/lib/supabase'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'

const FALLBACK_LIMIT = 100

async function getDailyLimit(): Promise<number> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'daily_limit_trial')
      .single()
    return data ? parseInt(data.value) : FALLBACK_LIMIT
  } catch {
    return FALLBACK_LIMIT
  }
}

async function getSessionUserId(req: NextRequest): Promise<string | null> {
  try {
    const supabase = createSSRClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

interface UsageResult {
  allowed: boolean
  used: number
  limit: number
}

/**
 * Check if the authenticated user is within their daily AI interaction limit,
 * and increment the counter if so. Call this at the start of any expensive
 * real-time AI route (chat, solve, write). Returns allowed=false with a 429
 * response body if the limit is exceeded.
 */
export async function checkAndIncrementUsage(req: NextRequest): Promise<UsageResult> {
  const userId = await getSessionUserId(req)
  if (!userId) return { allowed: false, used: 0, limit: 0 }

  const limit = await getDailyLimit()
  const supabase = createServerClient()
  const today = new Date().toISOString().slice(0, 10)  // YYYY-MM-DD

  // Upsert: insert today's row if missing, else increment
  const { data, error } = await supabase.rpc('increment_daily_usage', {
    p_user_id: userId,
    p_date: today,
    p_limit: limit,
  })

  if (error || data === null) {
    // If the RPC doesn't exist yet or fails, allow through (fail open)
    return { allowed: true, used: 0, limit }
  }

  const used: number = data
  return { allowed: used <= limit, used, limit }
}
