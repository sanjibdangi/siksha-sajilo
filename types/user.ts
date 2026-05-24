import { GradeLevel } from './subject'

export interface UserProfile {
  id: string
  name: string | null
  grade: GradeLevel | null
  school: string | null
  district: string | null
  medium: 'english' | 'nepali' | null
  created_at: string
}
