import { createServerClient } from '@/lib/supabase'
import { embed } from '@/lib/embeddings'
import { GradeLevel } from '@/types/subject'
import { SyllabusChunk } from '@/types/syllabus'

export async function getSyllabusContext(
  query: string,
  grade: GradeLevel,
  subjectId: string,
  yearBs: number = 2083,
  topK: number = 3
): Promise<string> {
  try {
    const supabase = createServerClient()
    const embedding = await embed(query)
    const gradeNum = grade === 'SEE Prep' ? 10 : parseInt(grade)

    const { data, error } = await supabase.rpc('match_syllabus', {
      query_embedding: embedding,
      match_grade: gradeNum,
      match_subject: subjectId,
      match_year_bs: yearBs,
      match_count: topK,
    })

    if (error || !data?.length) return ''

    return (data as SyllabusChunk[])
      .map(
        (chunk) =>
          `Unit ${chunk.unit_no}: ${chunk.unit_title}
Chapter ${chunk.chapter_no}: ${chunk.chapter_title}
Topic: ${chunk.topic}
Marks weight: ${chunk.marks_weight}
Learning objectives: ${chunk.learning_objectives?.join(', ')}`
      )
      .join('\n\n---\n\n')
  } catch {
    // Syllabus retrieval is best-effort — if Voyage AI or Supabase is unavailable,
    // fall back to general subject knowledge rather than breaking the chat.
    return ''
  }
}
