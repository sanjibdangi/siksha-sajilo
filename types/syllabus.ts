export interface SyllabusChunk {
  id: string
  year_bs: number
  grade: number
  subject_id: string
  unit_no: number
  unit_title: string
  chapter_no: number
  chapter_title: string
  topic: string
  learning_objectives: string[]
  marks_weight: number
  embedding: number[]
}
