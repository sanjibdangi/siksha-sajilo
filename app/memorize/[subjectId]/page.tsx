import { notFound } from 'next/navigation'
import { SUBJECTS } from '@/types/subject'
import type { GradeLevel, LanguagePreference } from '@/types/subject'
import { MemorizeClient } from '@/components/memorize/MemorizeClient'

interface PageProps {
  params: { subjectId: string }
  searchParams: { grade?: string; topic?: string; lang?: string }
}

export default function MemorizePage({ params, searchParams }: PageProps) {
  const subject = SUBJECTS.find(s => s.id === params.subjectId)
  if (!subject) notFound()

  const grade = (searchParams.grade ?? '10') as GradeLevel
  const topic = searchParams.topic ?? null
  const lang = (searchParams.lang ?? 'english') as LanguagePreference

  return (
    <MemorizeClient
      subject={subject}
      subjectId={params.subjectId}
      grade={grade}
      topic={topic}
      lang={lang}
    />
  )
}
