import { Subject, GradeLevel, LanguagePreference } from '@/types/subject'

const SUBJECT_CARD_TYPES: Record<string, string> = {
  mathematics: `Mix of:
- Formula cards: front = "Formula for [concept]?", back = the exact formula with what each variable means
- Theorem cards: front = "State [theorem name]", back = full statement + when to use it
- Procedure cards: front = "Steps to solve [problem type]?", back = numbered steps
- Common mistake cards: front = "What mistake do students make when [doing X]?", back = the error + the correct approach
- Nepal-context cards: front = problem using NPR/ropani/local context, back = worked answer`,

  science: `Mix of:
- Definition cards: front = "What is [scientific term]?", back = clear definition + real-life example
- Process cards: front = "How does [process] happen?", back = steps/stages in order
- Classification cards: front = "What type of [organism/substance] is X?", back = category + reason
- Cause-effect cards: front = "What happens when [condition]?", back = the effect + explanation
- Experiment cards: front = "What does [experiment] prove?", back = conclusion + observation`,

  english: `Mix of:
- Grammar rule cards: front = "When do you use [grammar concept]?", back = rule + example sentence
- Tense cards: front = "Structure of [tense name]?", back = formula + example
- Vocabulary cards: front = "[Word] — meaning?", back = definition + example sentence
- Writing technique cards: front = "What is [device/technique]?", back = definition + example from literature
- Common error cards: front = "Is this correct: '[sentence]'?", back = correction + rule`,

  nepali: `Mix of:
- Grammar cards: front = "[व्याकरण शब्द] को परिभाषा?", back = definition with example
- Vocabulary cards: front = "[शब्द] को अर्थ?", back = meaning + example sentence
- Literary term cards: front = "[साहित्यिक विधा] भनेको के हो?", back = definition + example
- Suffix/prefix cards: front = "[प्रत्यय/उपसर्ग] को प्रयोग?", back = rule + examples
- Lesson-based cards: key points from the textbook lessons`,

  social: `Mix of:
- Date/event cards: front = "When did [event] happen?", back = date + brief significance
- Definition cards: front = "What is [term/concept]?", back = definition + Nepal context
- Geography cards: front = "Where is [place]?" or "Capital of [country]?", back = answer + key fact
- Cause-effect cards: front = "Why did [historical event] happen?", back = main causes
- Person cards: front = "Who was [historical figure]?", back = role + contribution`,

  optmath: `Mix of:
- Formula cards: front = "Formula for [concept]?", back = formula with derivation hint
- Theorem cards: front = "State [theorem]", back = complete statement + proof approach
- Application cards: front = "When do you use [method/formula]?", back = condition + example
- Step cards: front = "How do you [solve type X]?", back = numbered procedure
- Shortcut cards: front = "Quick way to [calculation]?", back = shortcut + when it works`,
}

export function buildMemorizePrompt(
  subject: Subject,
  grade: GradeLevel,
  topic: string,
  syllabusContext: string,
  lang: LanguagePreference = 'english'
): string {
  const gradeLabel = grade === 'SEE Prep' ? 'SEE Preparation' : `Class ${grade}`
  const cardTypes = SUBJECT_CARD_TYPES[subject.id] ?? 'Mix of definition, application, and recall cards'

  return `You are a flashcard expert for ${gradeLabel} ${subject.name} students in Nepal. Topic: "${topic}".

Generate exactly 10 flashcards. Return ONLY a valid JSON array — no other text, no markdown fences:
[{"front":"...","back":"...","hint":"..."}]

FIELD RULES:
- "front" — the question (max 15 words, punchy, specific — not vague like "What is X?")
- "back" — the answer (clear, memorable, complete but concise — not a wall of text)
- "hint" — a memory trick, Nepal-relevant real-world anchor, or mnemonic (make it sticky and local)

CARD TYPE MIX FOR ${subject.name.toUpperCase()}:
${cardTypes}

QUALITY RULES:
- Every card must be about THIS specific topic: "${topic}" — NOT generic ${subject.name} content
- "front" must feel like a real exam question a student would face
- "back" must be the kind of answer that makes a student say "oh, THAT'S how I remember it"
- "hint" must connect to something a Nepal student genuinely relates to (NPR, festivals, local geography, school life, food, etc.)
- ${grade === 'SEE Prep' ? 'Focus heavily on SEE-tested concepts — things that come up in the actual NEB exam' : 'Focus on concepts students struggle most with at this grade level'}
- No filler cards. Every single card must earn its place.

LANGUAGE:
${lang === 'english'
  ? 'English only. Use simple, clear language a student in Nepal will immediately understand.'
  : lang === 'nepali'
  ? 'Nepali (Devanagari script). Mathematical and scientific notation stays in standard form.'
  : 'Mix: technical terms and formulas in English, explanations in Nepali.'}

OFFICIAL SYLLABUS CONTEXT:
${syllabusContext || `${gradeLabel} ${subject.name} — topic: ${topic}`}`
}
