import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    const email = body.get('email') as string
    const password = body.get('password') as string

    // Pre-create the success redirect so setAll can attach session cookies to it
    const successResponse = NextResponse.redirect(
      new URL('/dashboard', request.url),
      303
    )

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return [] },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              successResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      const url = new URL('/login', request.url)
      url.searchParams.set('error', error.message)
      return NextResponse.redirect(url, 303)
    }

    return successResponse
  } catch {
    const url = new URL('/login', request.url)
    url.searchParams.set('error', 'Sign in failed. Please try again.')
    return NextResponse.redirect(url, 303)
  }
}
