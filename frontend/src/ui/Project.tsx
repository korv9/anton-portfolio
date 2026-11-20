/** Project introductions and report sections. Topic navigation lives in ProjectStructure. */
import type { ReactNode } from 'react'
import './project.css'

export function ProjectSection({
  id,
  title,
  children,
  className,
}: {
  id?: string
  title: string
  children: ReactNode
  className?: string
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section
      className={`project-section${className ? ` ${className}` : ''}`}
      id={id}
      aria-labelledby={headingId}
    >
      <h2 id={headingId}>{title}</h2>
      {children}
    </section>
  )
}
