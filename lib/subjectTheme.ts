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
  hpe: {
    gradient:    'from-lime-400 via-green-500 to-emerald-600',
    gradientFrom:'from-lime-400',
    glow:        'shadow-lime-200',
    ghost1:      'bg-lime-100',
    ghost2:      'bg-lime-200',
    accent:      'text-lime-600',
    accentBg:    'bg-lime-50',
    pill:        'bg-lime-100 text-lime-700',
    bar:         'bg-lime-500',
    ring:        'ring-lime-400',
    border:      'border-lime-200',
    hoverBorder: 'hover:border-lime-400',
  },
  computer: {
    gradient:    'from-slate-500 via-slate-600 to-gray-800',
    gradientFrom:'from-slate-500',
    glow:        'shadow-slate-200',
    ghost1:      'bg-slate-100',
    ghost2:      'bg-slate-200',
    accent:      'text-slate-600',
    accentBg:    'bg-slate-50',
    pill:        'bg-slate-100 text-slate-700',
    bar:         'bg-slate-500',
    ring:        'ring-slate-400',
    border:      'border-slate-200',
    hoverBorder: 'hover:border-slate-400',
  },
  account: {
    gradient:    'from-amber-400 via-amber-500 to-yellow-600',
    gradientFrom:'from-amber-400',
    glow:        'shadow-amber-200',
    ghost1:      'bg-amber-100',
    ghost2:      'bg-amber-200',
    accent:      'text-amber-600',
    accentBg:    'bg-amber-50',
    pill:        'bg-amber-100 text-amber-700',
    bar:         'bg-amber-500',
    ring:        'ring-amber-400',
    border:      'border-amber-200',
    hoverBorder: 'hover:border-amber-400',
  },
  economics: {
    gradient:    'from-emerald-500 via-emerald-600 to-green-800',
    gradientFrom:'from-emerald-500',
    glow:        'shadow-emerald-200',
    ghost1:      'bg-emerald-100',
    ghost2:      'bg-emerald-200',
    accent:      'text-emerald-600',
    accentBg:    'bg-emerald-50',
    pill:        'bg-emerald-100 text-emerald-700',
    bar:         'bg-emerald-500',
    ring:        'ring-emerald-400',
    border:      'border-emerald-200',
    hoverBorder: 'hover:border-emerald-400',
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
