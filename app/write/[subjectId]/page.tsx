import { notFound } from 'next/navigation'
import { SUBJECTS } from '@/types/subject'
import type { GradeLevel, ConfidenceLevel, LanguagePreference } from '@/types/subject'
import { WriteClient } from '@/components/write/WriteClient'

interface PageProps {
  params: { subjectId: string }
  searchParams: { grade?: string; confidence?: string; topic?: string; lang?: string }
}

export default function WritePage({ params, searchParams }: PageProps) {
  const subject = SUBJECTS.find(s => s.id === params.subjectId)
  if (!subject) notFound()

  const grade = (searchParams.grade ?? '10') as GradeLevel
  const confidence = (searchParams.confidence ?? 'mid') as ConfidenceLevel
  const topic = searchParams.topic ?? null
  const lang = (searchParams.lang ?? 'english') as LanguagePreference

  return (
    <WriteClient
      subject={subject}
      subjectId={params.subjectId}
      grade={grade}
      confidence={confidence}
      topic={topic}
      lang={lang}
    />
  )
}
