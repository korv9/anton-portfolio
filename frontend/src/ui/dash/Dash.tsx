/**
 * The dashboard card and grid project pages are built from (docs/mockups/SPEC.md): cards in a
 * 12-column grid, each with an optional slicer. Numbers come from the caller, which reads them
 * from public/data; nothing here knows a value.
 */
import { useId, type ReactNode } from 'react'
import './dash.css'

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

/** The grid the cards sit in. */
export function DashGrid({ children }: { children: ReactNode }) {
  return <div className="dk-grid">{children}</div>
}
