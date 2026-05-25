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
// Lazy singleton: created on first request, not at module-load time (safe for
// build-time page collection). _factory gives ReturnType<> a concrete, non-
// overloaded signature so TypeScript resolves generics as `any` (matching the
// direct-call inference) rather than the SDK's last overload which defaults to `never`.
const _factory = () => createSupabaseClient(supabaseUrl, supabaseServiceKey)
let _serverClient: ReturnType<typeof _factory> | undefined
export function createServerClient() {
  return (_serverClient ??= _factory())
}
