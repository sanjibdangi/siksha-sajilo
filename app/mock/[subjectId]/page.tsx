import { notFound } from 'next/navigation'
import { SUBJECTS } from '@/types/subject'
import type { GradeLevel } from '@/types/subject'
import { MockTestClient } from '@/components/papers/MockTestClient'

interface PageProps {
  params: { subjectId: string }
  searchParams: { grade?: string; yearBs?: string }
}

export default function MockTestPage({ params, searchParams }: PageProps) {
  const subject = SUBJECTS.find(s => s.id === params.subjectId)
  if (!subject) notFound()

  const grade = (searchParams.grade ?? '10') as GradeLevel
  const yearBs = parseInt(searchParams.yearBs ?? '2082')

  return (
    <MockTestClient
      subject={subject}
      subjectId={params.subjectId}
      grade={grade}
      yearBs={yearBs}
    />
  )
}
