import { Star } from 'lucide-react'

export function StrengthStars({ score = 0, size = 14, className = '' }) {
  const safe = Math.max(0, Math.min(5, Math.round(score)))
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`경험 강도 ${safe}/5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < safe
        return (
          <Star
            key={i}
            size={size}
            strokeWidth={1.5}
            className={filled ? 'fill-amber-400 text-amber-400' : 'fill-none text-slate-300'}
          />
        )
      })}
    </span>
  )
}
