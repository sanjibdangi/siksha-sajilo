'use client'

import { useEffect } from 'react'

// Patches window.fetch to handle "String contains non ISO-8859-1 code point" errors.
// Normal requests are passed through untouched. Only when the browser throws that
// specific error do we sanitize header values and retry — so valid API keys and JWTs
// are never modified.
export function FetchSanitizer() {
  useEffect(() => {
    const original = window.fetch.bind(window)

    window.fetch = function patchedFetch(input, init) {
      try {
        return original(input, init)
      } catch (err) {
        if (
          err instanceof TypeError &&
          String(err.message).includes('non ISO-8859-1')
        ) {
          // Rebuild headers with all non-Latin1 characters stripped
          const clean: Record<string, string> = {}
          try {
            new Headers(init?.headers).forEach((value, key) => {
              clean[key] = value.replace(/[^\x00-\xFF]/g, '')
            })
          } catch {
            // If even that fails, just drop all headers and retry bare
          }
          return original(input, { ...(init ?? {}), headers: clean })
        }
        throw err
      }
    }

    return () => {
      window.fetch = original
    }
  }, [])

  return null
}
