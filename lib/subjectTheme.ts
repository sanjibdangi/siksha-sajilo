export interface SubjectTheme {
  gradient: string
  gradientFrom: string
  glow: string
  ghost1: string
  ghost2: string
  accent: string
  accentBg: string
  pill: string
  bar: string
  ring: string
  border: string
  hoverBorder: string
}

export const SUBJECT_THEME: Record<string, SubjectTheme> = {
  mathematics: {
    gradient:    'from-blue-500 via-blue-600 to-indigo-700',
    gradientFrom:'from-blue-500',
    glow:        'shadow-blue-200',
    ghost1:      'bg-blue-100',
    ghost2:      'bg-blue-200',
    accent:      'text-blue-600',
    accentBg:    'bg-blue-50',
    pill:        'bg-blue-100 text-blue-700',
    bar:         'bg-blue-500',
    ring:        'ring-blue-400',
    border:      'border-blue-200',
    hoverBorder: 'hover:border-blue-400',
  },
  science: {
    gradient:    'from-teal-400 via-emerald-500 to-green-700',
    gradientFrom:'from-teal-400',
    glow:        'shadow-teal-200',
    ghost1:      'bg-teal-100',
    ghost2:      'bg-teal-200',
    accent:      'text-teal-600',
    accentBg:    'bg-teal-50',
    pill:        'bg-teal-100 text-teal-700',
    bar:         'bg-teal-500',
    ring:        'ring-teal-400',
    border:      'border-teal-200',
    hoverBorder: 'hover:border-teal-400',
  },
  english: {
    gradient:    'from-violet-500 via-purple-600 to-purple-800',
    gradientFrom:'from-violet-500',
    glow:        'shadow-violet-200',
    ghost1:      'bg-violet-100',
    ghost2:      'bg-violet-200',
    accent:      'text-violet-600',
    accentBg:    'bg-violet-50',
    pill:        'bg-violet-100 text-violet-700',
    bar:         'bg-violet-500',
    ring:        'ring-violet-400',
    border:      'border-violet-200',
    hoverBorder: 'hover:border-violet-400',
  },
  nepali: {
    gradient:    'from-red-500 via-red-600 to-rose-700',
    gradientFrom:'from-red-500',
    glow:        'shadow-red-200',
    ghost1:      'bg-red-100',
    ghost2:      'bg-red-200',
    accent:      'text-red-600',
    accentBg:    'bg-red-50',
    pill:        'bg-red-100 text-red-700',
    bar:         'bg-red-500',
    ring:        'ring-red-400',
    border:      'border-red-200',
    hoverBorder: 'hover:border-red-400',
  },
  social: {
    gradient:    'from-orange-400 via-orange-500 to-amber-600',
    gradientFrom:'from-orange-400',
    glow:        'shadow-orange-200',
    ghost1:      'bg-orange-100',
    ghost2:      'bg-orange-200',
    accent:      'text-orange-600',
    accentBg:    'bg-orange-50',
    pill:        'bg-orange-100 text-orange-700',
    bar:         'bg-orange-500',
    ring:        'ring-orange-400',
    border:      'border-orange-200',
    hoverBorder: 'hover:border-orange-400',
  },
  optmath: {
    gradient:    'from-cyan-500 via-sky-500 to-blue-700',
    gradientFrom:'from-cyan-500',
    glow:        'shadow-cyan-200',
    ghost1:      'bg-cyan-100',
    ghost2:      'bg-cyan-200',
    accent:      'text-cyan-600',
    accentBg:    'bg-cyan-50',
    pill:        'bg-cyan-100 text-cyan-700',
    bar:         'bg-cyan-500',
    ring:        'ring-cyan-400',
    border:      'border-cyan-200',
    hoverBorder: 'hover:border-cyan-400',
  },
}

export const DEFAULT_THEME = SUBJECT_THEME.mathematics

export function getTheme(subjectId: string): SubjectTheme {
  return SUBJECT_THEME[subjectId] ?? DEFAULT_THEME
}

export function getStars(score: number, total: number): 1 | 2 | 3 {
  const pct = score / total
  if (pct === 1) return 3
  if (pct >= 0.7) return 2
  return 1
}
