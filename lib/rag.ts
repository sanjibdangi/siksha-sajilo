import { createServerClient } from '@/lib/supabase'
import { embed } from '@/lib/embeddings'
import { GradeLevel } from '@/types/subject'
import { SyllabusChunk } from '@/types/syllabus'
import { getCurrentYearBs } from '@/lib/yearConfig'

// Lazily initialized so env vars are read at runtime, not at build time.
// The singleton is reused across warm Vercel invocations.
let _supabase: ReturnType<typeof createServerClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createServerClient()
  return _supabase
}

// Avoids re-embedding the same topic query within a warm instance lifetime.
// Capped at 200 entries — evict oldest first to prevent unbounded memory growth
// on long-lived Lambda instances.
const CACHE_MAX = 200
const contextCache = new Map<string, string>()

export async function getSyllabusContext(
  query: string,
  grade: GradeLevel,
  subjectId: string,
  yearBs?: number,
  topK: number = 3
): Promise<string> {
  try {
    const activeYear = yearBs ?? await getCurrentYearBs()
    const cacheKey = `${subjectId}:${grade}:${activeYear}:${query.slice(0, 120)}`
    const cached = contextCache.get(cacheKey)
    if (cached !== undefined) return cached

    const embedding = await embed(query)
    const gradeNum = grade === 'SEE Prep' ? 10 : parseInt(grade)

    const [syllabusRes, knowledgeRes] = await Promise.all([
      getSupabase().rpc('match_syllabus', {
        query_embedding: embedding,
        match_grade: gradeNum,
        match_subject: subjectId,
        match_year_bs: activeYear,
        match_count: topK,
      }),
      getSupabase().rpc('match_knowledge_sources', {
        query_embedding: embedding,
        match_grade: grade,
        match_subject: subjectId,
        match_year_bs: activeYear,
        match_count: 2,
      }),
    ])

    const syllabusChunks = (!syllabusRes.error && syllabusRes.data?.length)
      ? (syllabusRes.data as SyllabusChunk[]).map(
          (chunk) =>
            `Unit ${chunk.unit_no}: ${chunk.unit_title}\nChapter ${chunk.chapter_no}: ${chunk.chapter_title}\nTopic: ${chunk.topic}\nMarks weight: ${chunk.marks_weight}\nLearning objectives: ${chunk.learning_objectives?.join(', ')}`
        ).join('\n\n---\n\n')
      : ''

    const knowledgeChunks = (!knowledgeRes.error && knowledgeRes.data?.length)
      ? (knowledgeRes.data as Array<{ title: string; source_type: string; source_url: string; raw_content: string; topic_tags: string[] }>)
          .map(
            (ks) =>
              `[Reference: ${ks.title || ks.source_type}${ks.source_url ? ` — ${ks.source_url}` : ''}]\n${ks.raw_content.slice(0, 1200)}`
          ).join('\n\n---\n\n')
      : ''

    const parts = [syllabusChunks, knowledgeChunks].filter(Boolean)
    const result = parts.length
      ? parts.join('\n\n===\n\n')
      : ''

    if (contextCache.size >= CACHE_MAX) {
      contextCache.delete(contextCache.keys().next().value!)
    }
    contextCache.set(cacheKey, result)
    return result
  } catch {
    // Syllabus retrieval is best-effort — if Voyage AI or Supabase is unavailable,
    // fall back to general subject knowledge rather than breaking the chat.
    return ''
  }
}
