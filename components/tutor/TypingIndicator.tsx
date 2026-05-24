import { LoadingDots } from '@/components/ui/LoadingDots'

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0 text-green-700 text-xs font-black select-none">
        ✦
      </div>
      <div className="bg-white border border-stone-200 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
        <LoadingDots className="text-green-500" />
      </div>
    </div>
  )
}
