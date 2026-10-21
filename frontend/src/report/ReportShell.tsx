/**
 * The frame every observatory report shares: the project's name and the data it shows, three
 * tabs with one question each, what the reader can follow (the slicer), the tab's charts, and
 * the ways further in. A tab is an address of its own.
 */
import type { ReactNode } from 'react'
import './theme.css'
import './longread.css'
import './report.css'

export type ReportTab = { path: string; label: string; question: string }
export type DeeperLink = { href: string; label: string; about: string }

/** A tab's address with the reader's choices kept, so they follow from tab to tab. */
export const withQuery = (path: string, params: URLSearchParams) =>
  params.size ? `${path}?${params}` : path

export default function ReportShell({
  name,
  intro,
  tabs,
  path,
  hrefOf = (p) => p,
  slicerLabel,
  slicer,
  deeper,
  children,
}: {
  name: string
  intro: string
  tabs: ReportTab[]
  /** The open tab's address. */
  path: string
  /** Adds what the reader has chosen to a link, so it follows them. */
  hrefOf?: (path: string) => string
  slicerLabel?: string
  slicer?: ReactNode
  deeper: DeeperLink[]
  children: ReactNode
}) {
  const tab = tabs.find((t) => t.path === path) ?? tabs[0]
  return (
    <div className="report">
      <header className="politik-intro">
        <p className="politik-intro-name">{name}</p>
        <p className="politik-intro-data">{intro}</p>
      </header>
      <nav className="report-tabs" aria-label="Report">
        {tabs.map((t) => (
          <a
            key={t.path}
            href={hrefOf(t.path)}
            aria-current={t === tab ? 'page' : undefined}
          >
            {t.label}
          </a>
        ))}
      </nav>
      <section className="report-tab" aria-labelledby="report-question">
        <header className="report-head">
          <h1 id="report-question">{tab.question}</h1>
          {slicer && (
            <div className="report-slicers">
              {slicerLabel && <p>{slicerLabel}</p>}
              {slicer}
            </div>
          )}
        </header>
        {children}
      </section>
      <nav className="report-deeper" aria-labelledby="report-deeper">
        <h2 id="report-deeper">Go deeper</h2>
        <ul>
          {deeper.map((d) => (
            <li key={d.href}>
              <a href={hrefOf(d.href)}>
                <b>{d.label}</b>
                <span>{d.about}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

/** The page frame for a report or deep dive outside the politics and jobs products. */
export function ReportFrame({ children }: { children: ReactNode }) {
  return (
    <div className="politik politik-long">
      <div className="politik-body">
        <div className="politik-main">{children}</div>
      </div>
    </div>
  )
}

/** A deep dive: one analysis on a page of its own, with the way back to its report. */
export function DeepPage({
  id,
  back,
  name,
  aside,
  children,
}: {
  id: string
  back: string
  name: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="politik-chapter" id={id}>
      <div className="politik-chapter-top">
        <a className="politik-back" href={back}>
          ← {name}
        </a>
        {aside}
      </div>
      {children}
    </section>
  )
}
