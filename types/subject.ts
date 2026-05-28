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
  // Compulsory subjects
  { id: 'mathematics', name: 'Mathematics',            nameNepali: 'गणित',                                    icon: '📐', topics: [] },
  { id: 'science',     name: 'Science',                nameNepali: 'विज्ञान तथा प्रविधि',                     icon: '🔬', topics: [] },
  { id: 'english',     name: 'English',                nameNepali: 'अंग्रेजी',                                icon: '📖', topics: [] },
  { id: 'nepali',      name: 'Nepali',                 nameNepali: 'नेपाली',                                  icon: '🇳🇵', topics: [] },
  { id: 'social',      name: 'Social Studies',         nameNepali: 'सामाजिक अध्ययन तथा जनसंख्या शिक्षा',     icon: '🌏', topics: [] },
  { id: 'hpe',         name: 'HPE',                    nameNepali: 'स्वास्थ्य, शारीरिक तथा सिर्जनात्मक शिक्षा', icon: '🏃', topics: [] },
  // Optional subjects
  { id: 'optmath',     name: 'Optional Mathematics',   nameNepali: 'ऐच्छिक गणित',                             icon: '∑',  topics: [] },
  { id: 'computer',    name: 'Computer Science',       nameNepali: 'सूचना तथा सञ्चार प्रविधि',               icon: '💻', topics: [] },
  { id: 'account',     name: 'Account',                nameNepali: 'लेखा',                                    icon: '📊', topics: [] },
  { id: 'economics',   name: 'Economics',              nameNepali: 'अर्थशास्त्र',                              icon: '📈', topics: [] },
]
