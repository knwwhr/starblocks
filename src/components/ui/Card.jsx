export function Card({ as: Tag = 'div', accentBar, hoverable = false, className = '', children, ...props }) {
  const base = 'relative bg-[var(--color-surface)] rounded-xl border border-[var(--color-surface-border)] shadow-[var(--shadow-card)] overflow-hidden'
  const hover = hoverable
    ? 'transition-all duration-150 hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--color-surface-border-strong)] hover:-translate-y-0.5 cursor-pointer'
    : ''
  return (
    <Tag className={`${base} ${hover} ${className}`} {...props}>
      {accentBar && <span className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar}`} aria-hidden />}
      {children}
    </Tag>
  )
}
