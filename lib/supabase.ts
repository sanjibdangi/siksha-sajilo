import { createBrowserClient, createServerClient as createSSRServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser client — stores session in cookies so middleware can read it
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Server-side client using service role key — bypasses RLS, for API routes only
export function createServerClient() {
  return createSupabaseClient(supabaseUrl, supabaseServiceKey)
}
