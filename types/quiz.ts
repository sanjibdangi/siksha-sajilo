export interface QuizQuestion {
  question: string
  options: string[]   // ["A. ...", "B. ...", "C. ...", "D. ..."]
  correct: number     // 0-based index
  explanation: string
}

export type PaperSection = 'mcq' | 'short' | 'long'

export interface PastPaperQuestion {
  id: string
  year_bs: number
  grade: number
  subject_id: string
  question_no: number
  section: PaperSection
  question: string
  options: string[] | null   // MCQ only
  correct: number | null     // MCQ only
  marks: number
  solution: string
  unit_title: string | null
  chapter_title: string | null
  topic: string | null
}

export interface MockAnswer {
  questionId: string
  selected: number | null    // MCQ: selected index; short/long: null (not auto-graded)
}

export interface MockResult {
  totalMarks: number
  scoredMarks: number
  answers: MockAnswer[]
  timeTakenSeconds: number
}
