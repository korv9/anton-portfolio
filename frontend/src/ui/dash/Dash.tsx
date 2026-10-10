/**
 * The dashboard kit every project page is built from (docs/mockups/SPEC.md): a header with a
 * status taken from the data, at most three key figures, cards in a 12-column grid, a gauge,
 * ranked bars and a list, and the "Fördjupning" section under them. Numbers come from the
 * caller, which reads them from public/data; nothing here knows a value.
 */
import { useId, type ReactNode } from 'react'
import { l } from '../../i18n'
import RankBars, { type RankRow } from '../../charts/RankBars'
import './dash.css'

export type Tone = 'ok' | 'warn' | 'idle'

export function DashHeader({
  crumbs,
  title,
  lead,
  status,
  code,
}: {
  crumbs: { label: string; href?: string }[]
  title: string
  lead: string
  /** What the data says about itself: the latest session, a failed run, a paused pipeline. */
  status?: { text: string; tone: Tone }
  code?: string
}) {
  return (
    <header className="dk-head">
      <nav aria-label={l('Breadcrumb', 'Brödsmulor')}>
        <ol className="dk-crumbs">
          {crumbs.map((c) => (
            <li key={c.label}>
              {c.href ? <a href={c.href}>{c.label}</a> : c.label}
            </li>
          ))}
        </ol>
      </nav>
      <h1>{title}</h1>
      <p className="dk-lead">{lead}</p>
      {(status || code) && (
        <div className="dk-head-row">
          {status && (
            <p className={`dk-pill dk-${status.tone}`}>
              <i aria-hidden="true" />
              {status.text}
            </p>
          )}
          {code && (
            <a
              className="dk-button"
              href={code}
              target="_blank"
              rel="noreferrer"
            >
              {l('See the code on GitHub', 'Se koden på GitHub')}
            </a>
          )}
        </div>
      )}
    </header>
  )
}

export type Kpi = { label: string; value: string; note?: string }

export function KpiRow({
  items,
  className,
}: {
  items: Kpi[]
  className?: string
}) {
  return (
    <dl className={`dk-kpis${className ? ` ${className}` : ''}`}>
      {items.slice(0, 3).map((k) => (
        <div key={k.label} className="dk-kpi">
          <dt>{k.label}</dt>
          <dd>{k.value}</dd>
          {k.note && <dd className="dk-note">{k.note}</dd>}
        </div>
      ))}
    </dl>
  )
}

export type Slicer = {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

export function SlicerSelect({ slicer }: { slicer: Slicer }) {
  // The label names the select alone; wrapped, its name would include the chosen option.
  const id = useId()
  return (
    <label className="dk-slicer">
      <span id={id}>{slicer.label}</span>
      <select
        aria-labelledby={id}
        value={slicer.value}
        onChange={(e) => slicer.onChange(e.target.value)}
      >
        {slicer.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** A card: title, one line under it, an optional slicer to the right, and a footnote. */
export function ChartCard({
  title,
  sub,
  slicer,
  span = 12,
  foot,
  children,
  className,
}: {
  title: string
  sub?: ReactNode
  slicer?: Slicer
  /** Columns of the 12-column grid. */
  span?: number
  foot?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`dk-card${span <= 6 ? ' dk-part' : ''}${className ? ` ${className}` : ''}`}
      style={{ ['--span' as string]: span }}
    >
      <div className="dk-card-head">
        <div>
          <h2>{title}</h2>
          {sub && <p className="dk-sub">{sub}</p>}
        </div>
        {slicer && <SlicerSelect slicer={slicer} />}
      </div>
      <div className="dk-card-body">{children}</div>
      {foot && <p className="dk-foot">{foot}</p>}
    </section>
  )
}

export type GaugeSegment = {
  key: string
  label: string
  value: number
  color: string
}

/** A half ring split into segments, with the total in the middle and a legend under it. */
export function GaugeCard({
  title,
  sub,
  segments,
  center,
  centerLabel,
  foot,
  format = String,
  span = 4,
}: {
  title: string
  sub?: string
  segments: GaugeSegment[]
  center: string
  centerLabel: string
  foot?: ReactNode
  format?: (value: number) => string
  span?: number
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  const r = 80
  const gap = segments.length > 1 ? 0.012 : 0
  let at = 0
  const arcs = segments.map((s) => {
    const from = at + gap / 2
    at += s.value / total
    const to = Math.max(from, at - gap / 2)
    const point = (t: number) => {
      const angle = Math.PI * (1 - t)
      return `${100 + r * Math.cos(angle)},${100 - r * Math.sin(angle)}`
    }
    return {
      ...s,
      d: `M${point(from)} A${r},${r} 0 0 1 ${point(to)}`,
    }
  })
  const description = segments
    .map((s) => `${s.label} ${format(s.value)}`)
    .join(', ')
  return (
    <ChartCard
      title={title}
      sub={sub}
      span={span}
      foot={foot}
      className="dk-gauge"
    >
      <svg
        viewBox="0 0 200 112"
        role="img"
        aria-label={`${title}: ${description}`}
      >
        <path
          d="M20,100 A80,80 0 0 1 180,100"
          fill="none"
          stroke="var(--line)"
          strokeWidth="18"
        />
        {arcs.map((a) => (
          <path
            key={a.key}
            d={a.d}
            fill="none"
            stroke={a.color}
            strokeWidth="18"
          >
            <title>{`${a.label}: ${format(a.value)}`}</title>
          </path>
        ))}
        <text x="100" y="92" textAnchor="middle" className="dk-gauge-center">
          {center}
        </text>
        <text x="100" y="108" textAnchor="middle" className="dk-gauge-label">
          {centerLabel}
        </text>
      </svg>
      <ul className="dk-legend">
        {segments.map((s) => (
          <li key={s.key}>
            <i style={{ background: s.color }} aria-hidden="true" />
            <span>{s.label}</span>
            <b>{format(s.value)}</b>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

/** Ranked bars in a card; they diverge around zero when a value is negative. */
export function BarsCard({
  title,
  sub,
  rows,
  format,
  foot,
  slicer,
  max,
  limit,
  span = 4,
}: {
  title: string
  sub?: string
  rows: RankRow[]
  format: (value: number) => string
  foot?: ReactNode
  slicer?: Slicer
  max?: number
  limit?: number
  span?: number
}) {
  return (
    <ChartCard title={title} sub={sub} foot={foot} slicer={slicer} span={span}>
      {rows.length ? (
        <RankBars
          rows={rows}
          format={format}
          label={sub ? `${title}. ${sub}` : title}
          max={max}
          limit={limit}
        />
      ) : (
        <Empty />
      )}
    </ChartCard>
  )
}

export type ListItem = {
  key: string
  title: ReactNode
  meta?: ReactNode
  value?: ReactNode
  href?: string
}

export function ListCard({
  title,
  sub,
  items,
  badge,
  span = 12,
}: {
  title: string
  sub?: string
  items: ListItem[]
  badge?: string
  span?: number
}) {
  return (
    <ChartCard title={title} sub={sub} span={span} className="dk-list">
      {badge && <p className="dk-badge">{badge}</p>}
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <span className="dk-list-title">
              {item.href ? (
                <a href={item.href} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </span>
            {item.meta && <span className="dk-list-meta">{item.meta}</span>}
            {item.value != null && (
              <span className="dk-list-value">{item.value}</span>
            )}
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

/** The grid the cards sit in. */
export function DashGrid({ children }: { children: ReactNode }) {
  return <div className="dk-grid">{children}</div>
}

/** Everything else: the lead, a grid of key figures, more cards and the Explorer. */
export function DeepSection({
  lead,
  kpis,
  children,
}: {
  lead: string
  kpis: Kpi[]
  children: ReactNode
}) {
  return (
    <section className="dk-deep" aria-labelledby="dk-deep-title">
      <h2 id="dk-deep-title">{l('In depth', 'Fördjupning')}</h2>
      <p className="dk-lead">{lead}</p>
      <dl className="dk-tiles">
        {kpis.map((k) => (
          <div key={k.label}>
            <dt>{k.label}</dt>
            <dd>{k.value}</dd>
            {k.note && <dd className="dk-note">{k.note}</dd>}
          </div>
        ))}
      </dl>
      <div className="dk-grid">{children}</div>
    </section>
  )
}

export function Empty({ text }: { text?: string }) {
  return (
    <p className="dk-empty">
      {text ?? l('No data for this selection.', 'Ingen data för urvalet.')}
    </p>
  )
}

export function Loading() {
  return (
    <p className="dk-empty" role="status">
      {l('Loading…', 'Laddar…')}
    </p>
  )
}
