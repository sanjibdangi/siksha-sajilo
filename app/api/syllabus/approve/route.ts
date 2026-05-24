import { createServerClient } from '@/lib/supabase'

export async function POST(req: Request) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { jobId, yearBs, grade, subjectId } = await req.json()
  const supabase = createServerClient()

  // Archive the currently active syllabus for this grade/subject/year
  await supabase
    .from('syllabus')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .match({ year_bs: yearBs, grade, subject_id: subjectId, status: 'active' })

  // Promote the pending draft to active
  const { error } = await supabase
    .from('syllabus')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .match({ year_bs: yearBs, grade, subject_id: subjectId, status: 'draft' })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, jobId })
}
