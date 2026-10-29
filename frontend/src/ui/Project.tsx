/** Project introductions and report sections. Topic navigation lives in ProjectStructure. */
import type { ReactNode } from 'react'
import { l } from '../i18n'
import { PROJECTS } from '../projects/projectRegistry'
import './project.css'

export function ProjectHero({
  project,
  title,
  question,
  children,
  status,
  dark = false,
}: {
  /** Registry id: name, descriptor, question and finding come from it by default. */
  project?: string
  title?: string
  question?: string
  /** One or two sentences on what this is. */
  children?: ReactNode
  /** A live line in place of a finding (the AI Act's today and next). */
  status?: ReactNode
  /** On a dark plate (Symbol Lab, the constellations). */
  dark?: boolean
}) {
  const entry = PROJECTS.find((p) => p.id === project)
  const b = (text?: { en: string; sv: string }) =>
    text ? l(text.en, text.sv) : undefined
  return (
    <header className={`project-hero${dark ? ' plate' : ''}`}>
      <h1 className="project-hero-title">{title ?? b(entry?.title)}</h1>
      <p className="project-hero-question">
        {question ?? b(entry?.home?.question)}
      </p>
      {children && <div className="project-hero-summary">{children}</div>}

      {status && <div className="project-hero-status">{status}</div>}
    </header>
  )
}

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
