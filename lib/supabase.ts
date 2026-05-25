import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser client. @supabase/ssr v0.10+ already encodes cookies as base64url by
// default — no custom handlers needed. We set isSingleton: false so the login
// page always gets a fresh client with no cached bad session from prior pages.
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    isSingleton: false,
  })
}

// Server-side client using service role key — bypasses RLS, for API routes only.
// Singleton: reused across warm Vercel invocations to avoid reconnection overhead.
let _serverClient: ReturnType<typeof createSupabaseClient> | null = null
export function createServerClient() {
  if (!_serverClient) _serverClient = createSupabaseClient(supabaseUrl, supabaseServiceKey)
  return _serverClient
}
