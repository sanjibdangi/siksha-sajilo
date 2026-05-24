import { notFound } from 'next/navigation'
import { SUBJECTS } from '@/types/subject'
import type { GradeLevel, ConfidenceLevel, LanguagePreference } from '@/types/subject'
import { SolveClient } from './SolveClient'

interface PageProps {
  params: { subjectId: string }
  searchParams: { grade?: string; confidence?: string; lang?: string }
}

export default function SolvePage({ params, searchParams }: PageProps) {
  const subject = SUBJECTS.find((s) => s.id === params.subjectId)
  if (!subject) notFound()

  const grade = (searchParams.grade ?? '10') as GradeLevel
  const confidence = (searchParams.confidence ?? 'mid') as ConfidenceLevel
  const lang = (searchParams.lang ?? 'english') as LanguagePreference

  return (
    <SolveClient
      subject={subject}
      subjectId={params.subjectId}
      grade={grade}
      confidence={confidence}
      lang={lang}
    />
  )
}
