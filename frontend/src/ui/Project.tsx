/**
 * The project page shell: one first screen, then numbered sections. Every flagship opens the
 * same way, so a visitor knows where to look before reading anything.
 *
 * - ProjectHero: the project's name (h1), its question, one or two sentences, one finding or
 *   status, and a short row of links into the project. Name, number, descriptor, question and
 *   finding default to the registry (projects/projectRegistry.ts); a page passes live values
 *   (a computed finding, today's status) where it has them.
 * - ProjectSubnav: that short row of links; scrolls sideways on a phone.
 * - ProjectSection: a numbered section with a label and a title (h2).
 *
 * The evidence, explore and method pieces (FindingHero, ChartSection, ExploreSection,
 * MethodSummary, SourceCaption) are in ui/Story.tsx.
 */
import type { ReactNode } from 'react'
import { l } from '../i18n'
import { PROJECTS } from '../projects/projectRegistry'
import './project.css'

export type SubnavItem = {
  href: string
  label: string
  /** true for the page the reader is on, 'location' for a section of it. */
  current?: boolean | 'location'
}

export function ProjectSubnav({
  items,
  label,
}: {
  items: SubnavItem[]
  label: string
}) {
  return (
    <nav className="project-subnav" aria-label={label}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={
                item.current === true ? 'page' : item.current || undefined
              }
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function ProjectHero({
  project,
  eyebrow,
  title,
  question,
  children,
  finding,
  findingLabel,
  status,
  nav,
  dark = false,
}: {
  /** Registry id: name, number, descriptor, question and finding come from it by default. */
  project?: string
  /** For a page outside the registry (Data Constellation, Quality). */
  eyebrow?: string
  title?: string
  question?: string
  /** One or two sentences on what this is. */
  children?: ReactNode
  /** The one result or use to read first; defaults to the registry's finding. */
  finding?: ReactNode
  findingLabel?: string
  /** A live line in place of a finding (the AI Act's today and next). */
  status?: ReactNode
  nav?: SubnavItem[]
  /** On a dark plate (Symbolic Atlas, the constellations). */
  dark?: boolean
}) {
  const entry = PROJECTS.find((p) => p.id === project)
  const b = (text?: { en: string; sv: string }) =>
    text ? l(text.en, text.sv) : undefined
  const shownFinding = status ? null : (finding ?? b(entry?.home?.finding))
  return (
    <header className={`project-hero${dark ? ' plate' : ''}`}>
      <p className="project-hero-eyebrow">
        {entry?.number && <span>{entry.number}</span>}
        {eyebrow ?? b(entry?.descriptor)}
      </p>
      <h1 className="project-hero-title">{title ?? b(entry?.title)}</h1>
      <p className="project-hero-question">
        {question ?? b(entry?.home?.question)}
      </p>
      {children && <div className="project-hero-summary">{children}</div>}
      {shownFinding && (
        <div className="project-hero-finding">
          <p className="project-hero-label">
            {findingLabel ?? l('Main finding', 'Huvudfynd')}
          </p>
          <p>{shownFinding}</p>
        </div>
      )}
      {status && <div className="project-hero-status">{status}</div>}
      {nav && nav.length > 0 && (
        <ProjectSubnav
          items={nav}
          label={l('In this project', 'I projektet')}
        />
      )}
    </header>
  )
}

export function ProjectSection({
  id,
  number,
  label,
  title,
  children,
  className,
}: {
  id?: string
  number?: string
  label?: string
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
      {(number || label) && (
        <p className="project-section-label">
          {number && <span>{number}</span>}
          {label}
        </p>
      )}
      <h2 id={headingId}>{title}</h2>
      {children}
    </section>
  )
}
