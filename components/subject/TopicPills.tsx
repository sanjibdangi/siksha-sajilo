'use client'

interface TopicPillsProps {
  topics: string[]
  selected: string | null
  onSelect: (topic: string | null) => void
}

export function TopicPills({ topics, selected, onSelect }: TopicPillsProps) {
  if (!topics.length) return null

  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-400">
        Focus on a specific topic{' '}
        <span className="text-stone-300">(optional — tap to select, tap again to clear)</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => {
          const isSelected = selected === topic
          return (
            <button
              key={topic}
              onClick={() => onSelect(isSelected ? null : topic)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                isSelected
                  ? 'bg-green-600 text-white border-green-600 shadow-sm'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:text-stone-900',
              ].join(' ')}
            >
              {topic}
            </button>
          )
        })}
      </div>
    </div>
  )
}
