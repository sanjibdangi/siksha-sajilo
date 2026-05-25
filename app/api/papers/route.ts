import { createServerClient } from '@/lib/supabase'
import type { PastPaperQuestion } from '@/types/quiz'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const subjectId = searchParams.get('subjectId')
  const grade     = parseInt(searchParams.get('grade') ?? '10')
  const yearBs    = parseInt(searchParams.get('yearBs') ?? '2082')

  if (!subjectId) return Response.json({ error: 'subjectId required' }, { status: 400 })

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('past_papers')
    .select('id,year_bs,grade,subject_id,question_no,section,question,options,correct,marks,solution,unit_title,chapter_title,topic')
    .eq('subject_id', subjectId)
    .eq('grade', grade)
    .eq('year_bs', yearBs)
    .eq('status', 'active')
    .order('section')
    .order('question_no')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Past papers change at most once a year — serve from Vercel CDN for 24 h,
  // stale-while-revalidate keeps serving the cached version for up to 7 days
  // while a background revalidation is in flight.
  return Response.json({ questions: (data ?? []) as PastPaperQuestion[] }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  })
}
