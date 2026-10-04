import type { ReactNode } from 'react'

export function Container({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`ds-container ${className}`}>{children}</div>
}
export function Section({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="ds-section ds-container">
      {children}
    </section>
  )
}
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
export function ProjectRow({
  number,
  id,
  title,
  href,
  children,
  preview,
  backgroundPreview = false,
}: {
  number: string
  id: string
  title: string
  href: string
  children: ReactNode
  preview: ReactNode
  backgroundPreview?: boolean
}) {
  return (
    <article className="ds-project-row" aria-labelledby={`project-${id}`}>
      <p className="ds-number">{number}</p>
      <div className="ds-project-copy">
        <h3 id={`project-${id}`}>
          <a href={href}>
            {title}
            <span className="ds-project-arrow" aria-hidden="true">
              ⟶
            </span>
          </a>
        </h3>
        {children}
      </div>
      <div
        className="ds-project-preview"
        aria-hidden={backgroundPreview || undefined}
        inert={backgroundPreview || undefined}
      >
        {preview}
      </div>
    </article>
  )
}
