import { createServerClient } from '@/lib/supabase'

// Cache per warm Lambda instance — avoids a DB round-trip on every request.
// Resets whenever the instance cold-starts (which happens after config updates too).
let _cached: number | null = null

export async function getCurrentYearBs(): Promise<number> {
  if (_cached !== null) return _cached

  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'current_year_bs')
      .single()

    const year = parseInt(data?.value ?? '2082')
    _cached = year
    return year
  } catch {
    return 2082
  }
}

// Called by the admin year-update API to flush the in-process cache
export function invalidateYearCache() {
  _cached = null
}
