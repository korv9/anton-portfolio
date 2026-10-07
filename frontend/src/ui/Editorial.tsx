import type { ReactNode } from 'react'

export function SectionHeader({
  number,
  label,
  title,
}: {
  number?: string
  label: string
  title: string
}) {
  return (
    <div className="ds-section-head">
      <p className="ds-label">
        {number && <span className="ds-number">{number} / </span>}
        {label}
      </p>
      <h2 className="ds-h2">{title}</h2>
    </div>
  )
}
export function Tag({ children }: { children: ReactNode }) {
  return <span className="ds-tag">{children}</span>
}
export function Metric({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="ds-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
export function VisualizationFrame({
  children,
  caption,
}: {
  children: ReactNode
  caption?: string
}) {
  return (
    <figure className="ds-visualization">
      {children}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
