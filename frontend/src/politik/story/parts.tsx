/**
 * The pieces every section of the politics story is built from: a numbered section with its
 * question, a sentence of insight generated from the data, an explained term, a key figure,
 * labelled bars and a heatmap. Calm by design: few borders, type does the structuring.
 */
import { useId, useState, type ReactNode } from 'react'
import { l } from '../../i18n'
import { identity } from '../../parties/identity'

export function Section({
  id,
  kicker,
  question,
  lead,
  deeper,
  children,
}: {
  id: string
  kicker: string
  question: string
  lead?: ReactNode
  /** Links to the pages that go deeper. */
  deeper?: { href: string; label: string }[]
  children: ReactNode
}) {
  return (
    <section className="story-section" id={id} aria-labelledby={`${id}-q`}>
      <header className="story-section-head">
        <p className="story-kicker">{kicker}</p>
        <h2 id={`${id}-q`}>{question}</h2>
        {lead && <p className="story-lead">{lead}</p>}
      </header>
      {children}
      {deeper && deeper.length > 0 && (
        <nav
          className="story-deeper"
          aria-label={`${l('Go deeper', 'Fördjupa')}: ${question}`}
        >
          <span>{l('Go deeper', 'Fördjupa')}</span>
          {deeper.map((d) => (
            <a key={d.href} href={d.href}>
              {d.label}
            </a>
          ))}
        </nav>
      )}
    </section>
  )
}

/** A short finding generated from the data, shown with its chart. */
export function Insight({ children }: { children: ReactNode }) {
  return <p className="story-insight">{children}</p>
}

/** A measure's name with its exact definition, on hover, focus or tap. */
export function Info({
  term,
  children,
}: {
  term: string
  children: ReactNode
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <span className="story-info">
      {term}
      <button
        type="button"
        className="round"
        aria-label={l(`What is ${term}?`, `Vad är ${term.toLowerCase()}?`)}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      <span id={id} role="tooltip" className={open ? 'open' : ''}>
        {children}
      </span>
    </span>
  )
}

export function Kpi({
  value,
  label,
  note,
}: {
  value: string
  label: ReactNode
  note?: string
}) {
  return (
    <div className="story-kpi">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note && <dd className="story-kpi-note">{note}</dd>}
    </div>
  )
}

/** The story's bars are the site's one bar chart (charts/RankBars). */
export { default as Bars, type RankRow as BarRow } from '../../charts/RankBars'

/**
 * A matrix as a heatmap: one shade of ink, darker for higher values, every cell with its
 * number, so colour is never the only carrier. Scrolls sideways on narrow screens.
 */
export function Heatmap({
  rows,
  cols,
  value,
  format,
  label,
  min = 0,
  max = 100,
  rowLabel = (r) => r,
  colLabel = (c) => c,
  title,
  shade = (v) => v,
}: {
  rows: string[]
  cols: string[]
  value: (row: string, col: string) => number | null
  format: (v: number) => string
  label: string
  min?: number
  max?: number
  rowLabel?: (r: string) => ReactNode
  colLabel?: (c: string) => ReactNode
  title?: (row: string, col: string, v: number) => string
  /** The value the shade follows, when it is not the value itself (e.g. its size). */
  shade?: (v: number) => number
}) {
  return (
    <div
      className="story-heat-wrap"
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <table className="story-heat">
        <thead>
          <tr>
            <td />
            {cols.map((c) => (
              <th key={c} scope="col">
                {colLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th scope="row">{rowLabel(r)}</th>
              {cols.map((c) => {
                const v = value(r, c)
                const t =
                  v == null
                    ? 0
                    : Math.max(
                        0,
                        Math.min(1, (shade(v) - min) / (max - min || 1)),
                      )
                return (
                  <td
                    key={c}
                    title={v != null && title ? title(r, c, v) : undefined}
                    style={
                      v == null
                        ? undefined
                        : {
                            background: `rgb(${Array(3)
                              .fill(Math.round(245 - t * 220))
                              .join(', ')})`,
                            color:
                              Math.round(245 - t * 220) <= 118
                                ? '#fff'
                                : '#0a0a0a',
                          }
                    }
                  >
                    {v == null ? '' : format(v)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A party's short name on its colour, with its letters, so it never rests on colour alone. */
export function PartyMark({ party }: { party: string }) {
  const p = identity(party)
  return (
    <span className="story-party" title={l(p.nameEn, p.name)}>
      <i style={{ background: p.color }} aria-hidden="true" />
      {party}
    </span>
  )
}
