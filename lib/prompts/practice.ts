import { Subject, GradeLevel, LanguagePreference } from '@/types/subject'

export function buildPracticePrompt(
  subject: Subject,
  grade: GradeLevel,
  topic: string,
  syllabusContext: string,
  lang: LanguagePreference = 'english'
): string {
  const gradeLabel = grade === 'SEE Prep' ? 'SEE Preparation' : `Class ${grade}`

  return `You are a Nepal exam question generator for ${gradeLabel} ${subject.name} on topic: "${topic}".

Generate exactly 5 MCQs. Return ONLY a valid JSON array — no other text, no markdown fences:
[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct":0,"explanation":"..."}]

QUESTION RULES:
- "correct" is the 0-based index of the correct answer
- Questions must test real understanding, not just memorization
- Include scenario-based and application questions, not just definition questions
- Use Nepal-relevant contexts where natural: NPR amounts, local distances, familiar objects, school/farm/kitchen situations
- Difficulty must match CDC Nepal ${gradeLabel} curriculum level
- Only use topics present in the syllabus context below

EXPLANATION RULES (this is the most important part):
Each explanation must make the concept memorable and clear, not just confirm the answer.
Structure every explanation like this:

1. State WHY the correct answer is right — explain the concept it tests, not just "A is correct because..."
2. Explain the most tempting wrong answer — what faulty logic leads a student there, and why it breaks down
3. Give ONE visual anchor, real-world Nepal example, or memory trick that makes this concept stick
   Examples of good anchors:
   - "Think of a battery like a water pump — it pushes current around the circuit the same way a pump pushes water through pipes."
   - "SOH-CAH-TOA: Sine = Opposite/Hypotenuse. The O in SOH gives you Opposite."
   - "In Nepal, a shopkeeper charges 13% VAT — that is a percentage of the base price, same as how percentage increase works here."
   - "The nucleus controls the cell the way a headmaster controls a school — it stores all the instructions."
4. ${grade === 'SEE Prep' ? 'Add an exam note: how this concept appears in SEE, how many marks it typically carries, and what the examiner expects to see in a written answer.' : ''}

Tone: Write like a patient senior student who wants the reader to understand, not a textbook printing an answer key.
Never use: em dashes (—), "Certainly!", "Great question!", "It is worth noting", "I hope this helps".

Language for questions and explanations:
${lang === 'english'
  ? 'English only'
  : lang === 'nepali'
  ? 'Nepali (Devanagari script); formulas and mathematical notation stay in standard form'
  : 'Nepali-English mix: explanations in Nepali, technical terms and formulas in English'
}

OFFICIAL SYLLABUS CONTEXT:
${syllabusContext || `General ${gradeLabel} ${subject.name} content`}`
}
