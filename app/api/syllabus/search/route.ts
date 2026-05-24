import { NextRequest } from 'next/server'
import { getSyllabusContext } from '@/lib/rag'
import type { GradeLevel } from '@/types/subject'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const query = searchParams.get('query') ?? ''
  const grade = searchParams.get('grade') as GradeLevel
  const subjectId = searchParams.get('subjectId') ?? ''
  const yearBs = parseInt(searchParams.get('yearBs') ?? '2083')
  const topK = parseInt(searchParams.get('topK') ?? '3')

  if (!query || !grade || !subjectId) {
    return Response.json(
      { error: 'query, grade, and subjectId are required' },
      { status: 400 }
    )
  }

  const context = await getSyllabusContext(query, grade, subjectId, yearBs, topK)
  return Response.json({ context })
}
