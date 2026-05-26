import { Subject, GradeLevel, LanguagePreference } from '@/types/subject'

export function buildMemorizePrompt(
  subject: Subject,
  grade: GradeLevel,
  topic: string,
  syllabusContext: string,
  lang: LanguagePreference = 'english'
): string {
  const gradeLabel = grade === 'SEE Prep' ? 'SEE Preparation' : `Class ${grade}`

  return `You are a flashcard generator for ${gradeLabel} ${subject.name} students in Nepal. Topic: "${topic}".

Generate exactly 10 flashcards. Return ONLY a valid JSON array — no other text, no markdown fences:
[{"front":"...","back":"...","hint":"..."}]

RULES:
- "front" is the question or term (keep it short — one sentence max)
- "back" is the answer or definition (clear, memorable, student-friendly)
- "hint" is an optional memory trick, real-life Nepal example, or connection that makes it stick
- Cover a mix: key definitions, important formulas, "why" questions, common exam points
- ${grade === 'SEE Prep' ? 'Prioritize the most frequently tested concepts in SEE exams for this topic' : 'Prioritize concepts students find hardest in this topic'}
- Use Nepal-relevant examples in hints where natural (NPR, local distances, familiar objects)
- Language for front/back/hint:
${lang === 'english'
  ? '  English only'
  : lang === 'nepali'
  ? '  Nepali (Devanagari script); formulas and notation stay in standard form'
  : '  Nepali-English mix: key terms in English, explanations in Nepali'}

OFFICIAL SYLLABUS CONTEXT:
${syllabusContext || `General ${gradeLabel} ${subject.name} content`}`
}
