import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createServerClient } from '@/lib/supabase'
import { anthropic } from '@/lib/anthropic'
import { NextRequest } from 'next/server'

export const maxDuration = 60

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

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { exam_date, grade } = await req.json()
  if (!exam_date || !grade) {
    return Response.json({ error: 'exam_date and grade required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Get recent quiz performance (last 60 days)
  const since = new Date(Date.now() - 60 * 86400000).toISOString()
  const { data: sessions } = await supabase
    .from('progress')
    .select('subject_id, score, total')
    .eq('user_id', user.id)
    .eq('mode', 'practice')
    .gte('session_at', since)
    .not('score', 'is', null)
    .not('total', 'is', null)

  // Aggregate avg score by subject
  const subjectScores: Record<string, { total: number; count: number }> = {}
  for (const s of sessions ?? []) {
    const pct = (s.score / s.total) * 5
    if (!subjectScores[s.subject_id]) subjectScores[s.subject_id] = { total: 0, count: 0 }
    subjectScores[s.subject_id].total += pct
    subjectScores[s.subject_id].count++
  }

  const performanceLines = Object.entries(subjectScores).map(([subj, { total, count }]) =>
    `- ${subj}: ${(total / count).toFixed(1)}/5 avg (${count} sessions)`
  ).join('\n') || '- No quiz data yet (treat all subjects as needing practice)'

  const examDateObj = new Date(exam_date)
  const daysLeft = Math.max(1, Math.ceil((examDateObj.getTime() - Date.now()) / 86400000))
  const gradeLabel = grade === 'SEE Prep' ? 'SEE Preparation' : `Class ${grade}`

  const prompt = `You are a study schedule generator for Nepal SEE exam students.

Student: ${gradeLabel}, ${daysLeft} days until SEE exam (${exam_date})

Recent quiz performance (avg out of 5):
${performanceLines}

Create a 7-day weekly study schedule (Monday–Sunday). Subjects with lower scores or no data need more days. Mathematics and Science typically need the most attention for SEE.

Compulsory subjects to schedule: mathematics, science, english, nepali, social, hpe

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "weekly_schedule": [
    { "day": "Monday", "subject_id": "mathematics", "topic": "Quadratic Equations", "mode": "practice", "duration_min": 45 },
    { "day": "Tuesday", "subject_id": "science", "topic": "Light and Reflection", "mode": "tutor", "duration_min": 45 },
    { "day": "Wednesday", "subject_id": "english", "topic": "Essay Writing", "mode": "write", "duration_min": 40 },
    { "day": "Thursday", "subject_id": "mathematics", "topic": "Trigonometry", "mode": "solve", "duration_min": 45 },
    { "day": "Friday", "subject_id": "science", "topic": "Chemical Reactions", "mode": "practice", "duration_min": 45 },
    { "day": "Saturday", "subject_id": "social", "topic": "Nepal Geography", "mode": "tutor", "duration_min": 35 },
    { "day": "Sunday", "subject_id": "nepali", "topic": "Nibandha Lekhan", "mode": "write", "duration_min": 30 }
  ],
  "reasoning": "One sentence explaining the subject distribution"
}

Rules:
- Exactly 7 entries (one per day, Monday through Sunday in order)
- mode must be one of: tutor, practice, solve, memorize, write
- Topics must be realistic CDC Nepal syllabus topics for ${gradeLabel}
- Duration 30–60 minutes per session
- Prioritize subjects with lower quiz scores or missing data`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  let plan: unknown
  try {
    plan = JSON.parse(raw)
  } catch {
    return Response.json({ error: 'Failed to parse plan from AI' }, { status: 500 })
  }

  // Deactivate old plans
  await supabase
    .from('study_plans')
    .update({ is_active: false })
    .eq('user_id', user.id)

  // Update exam_date on user profile
  await supabase
    .from('users')
    .update({ exam_date })
    .eq('id', user.id)

  // Insert new plan
  const { data: newPlan, error } = await supabase
    .from('study_plans')
    .insert({ user_id: user.id, exam_date, plan })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ plan: newPlan })
}
