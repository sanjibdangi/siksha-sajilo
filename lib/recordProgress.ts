interface ProgressPayload {
  subjectId: string
  topic?: string | null
  mode: string
  score?: number | null
  total?: number | null
  durationS?: number | null
}

export async function recordProgress(payload: ProgressPayload): Promise<void> {
  try {
    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Non-critical — never throw from progress tracking
  }
}
