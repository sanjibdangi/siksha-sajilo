import { notFound } from 'next/navigation'

// Topics come from the CDC syllabus which changes at most once a year —
// serve cached HTML and revalidate in the background every hour.
export const revalidate = 3600
import { SUBJECTS } from '@/types/subject'
import type { GradeLevel } from '@/types/subject'
import { createServerClient } from '@/lib/supabase'
import { SubjectClient } from './SubjectClient'

interface PageProps {
  params: { subjectId: string }
  searchParams: { grade?: string }
}

export default async function SubjectPage({ params, searchParams }: PageProps) {
  const subject = SUBJECTS.find((s) => s.id === params.subjectId)
  if (!subject) notFound()

  const grade = (searchParams.grade ?? '10') as GradeLevel
  const gradeNum = grade === 'SEE Prep' ? 10 : parseInt(grade)

  // Fetch available topics from Supabase; degrades gracefully if not configured
  let topics: string[] = []
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('syllabus')
      .select('topic')
      .match({
        grade: gradeNum,
        subject_id: params.subjectId,
        status: 'active',
        year_bs: 2083,
      })
    topics = Array.from(new Set((data ?? []).map((c: { topic: string }) => c.topic))).filter(Boolean)
  } catch {
    // Supabase not configured yet — topics will be empty
  }

  return (
    <SubjectClient
      subject={subject}
      grade={grade}
      topics={topics}
    />
  )
}
