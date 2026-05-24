import { notFound } from 'next/navigation'
import { SUBJECTS } from '@/types/subject'
import type { GradeLevel } from '@/types/subject'
import { PastPapersClient } from '@/components/papers/PastPapersClient'

interface PageProps {
  params: { subjectId: string }
  searchParams: { grade?: string }
}

export default function PastPapersPage({ params, searchParams }: PageProps) {
  const subject = SUBJECTS.find(s => s.id === params.subjectId)
  if (!subject) notFound()

  const grade = (searchParams.grade ?? '10') as GradeLevel

  return (
    <PastPapersClient
      subject={subject}
      subjectId={params.subjectId}
      grade={grade}
    />
  )
}
