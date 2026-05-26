export type GradeLevel = '9' | '10' | 'SEE Prep'
export type ConfidenceLevel = 'low' | 'mid' | 'high'
export type LearningMode = 'tutor' | 'practice' | 'solve' | 'memorize' | 'write'
export type LanguagePreference = 'nepali' | 'english' | 'mix'

export interface Subject {
  id: string
  name: string
  nameNepali: string
  icon: string
  topics: string[]
}

export const SUBJECTS: Subject[] = [
  { id: 'mathematics', name: 'Mathematics', nameNepali: 'गणित', icon: '📐', topics: [] },
  { id: 'science', name: 'Science', nameNepali: 'विज्ञान', icon: '🔬', topics: [] },
  { id: 'english', name: 'English', nameNepali: 'अंग्रेजी', icon: '📖', topics: [] },
  { id: 'nepali', name: 'Nepali', nameNepali: 'नेपाली', icon: '🇳🇵', topics: [] },
  { id: 'social', name: 'Social Studies', nameNepali: 'सामाजिक', icon: '🌏', topics: [] },
  { id: 'optmath', name: 'Optional Mathematics', nameNepali: 'ऐच्छिक गणित', icon: '∑', topics: [] },
]
