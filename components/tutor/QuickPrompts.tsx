'use client'

import type { GradeLevel } from '@/types/subject'

interface QuickPromptsProps {
  grade: GradeLevel
  onSelect: (prompt: string) => void
}

const PROMPTS: Record<GradeLevel, string[]> = {
  '9': [
    "I don't understand this topic at all — can you start from the very beginning?",
    "Can you explain this like I've never heard of it before?",
    "What are the most important concepts I need to understand in this subject?",
  ],
  '10': [
    "Which topics in this subject are most important for SEE?",
    "I understand the theory but can't solve problems — can you help?",
    "Can you explain this more simply than my textbook does?",
  ],
  'SEE Prep': [
    "I'm feeling overwhelmed about the exam — where should I focus first?",
    "What are the most common mistakes students make in the SEE exam?",
    "Can you give me the key things I absolutely must know for the exam?",
  ],
}

export function QuickPrompts({ grade, onSelect }: QuickPromptsProps) {
  return (
    <div className="flex flex-col gap-2 pl-11">
      {PROMPTS[grade].map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelect(prompt)}
          className="text-left text-sm px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-all"
        >
          {prompt}
        </button>
      ))}
    </div>
  )
}
