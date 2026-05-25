// Safe base64 encoding for cookie values containing Unicode (e.g. Nepali user metadata).
// Cookies must be ISO-8859-1; base64 output is pure ASCII.

export function encodeCookie(value: string): string {
  try {
    return btoa(
      encodeURIComponent(value).replace(/%([0-9A-F]{2})/gi, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
    )
  } catch {
    return value
  }
}

export function decodeCookie(value: string): string {
  try {
    return decodeURIComponent(
      Array.from(atob(value), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    )
  } catch {
    // Not base64 — old unencoded cookie; return as-is so the caller can decide what to do
    return value
  }
}

// Returns true if any character is above U+00FF (outside Latin-1)
export function hasNonLatin1(str: string): boolean {
  return /[^\x00-\xFF]/.test(str)
}
