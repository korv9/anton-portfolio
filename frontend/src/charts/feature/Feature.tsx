/**
 * The frame for the one chart each page opens with: a headline that says what the chart shows,
 * a line on how to read it, the chart (interactive, with a tooltip), a table of the same numbers
 * for anyone who would rather read than hover, and the source. Every feature chart on the site
 * uses it, so they read as one family.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { l } from '../../i18n'
import './feature.css'

export function Feature({
  id,
  title,
  lead,
  controls,
  table,
  source,
  children,
}: {
  id: string
  /** The finding, in a sentence. */
  title: ReactNode
  /** How to read the chart. */
  lead?: ReactNode
  controls?: ReactNode
  /** The same numbers as a table. */
  table?: ReactNode
  source: ReactNode
  children: ReactNode
}) {
  return (
    <section className="feature" id={id} aria-labelledby={`${id}-title`}>
      <header className="feature-head">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          {lead && <p className="feature-lead">{lead}</p>}
        </div>
        {controls && <div className="feature-controls">{controls}</div>}
      </header>
      <div className="feature-body">{children}</div>
      <footer className="feature-foot">
        {table && (
          <details className="feature-table">
            <summary>{l('Show as a table', 'Visa som tabell')}</summary>
            <div className="feature-table-wrap" tabIndex={0}>
              {table}
            </div>
          </details>
        )}
        <p className="feature-source">
          {l('Source', 'Källa')}: {source}
        </p>
      </footer>
    </section>
  )
}

/** A tooltip that follows the pointer inside a chart. Put `box` on the chart's wrapper
 * (position: relative) and render `tip` inside it. */
export function useTip() {
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{
    x: number
    y: number
    content: ReactNode
  } | null>(null)
  const show = useCallback((e: MouseEvent, content: ReactNode) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    setState({ x: e.clientX - r.left, y: e.clientY - r.top, content })
  }, [])
  const hide = useCallback(() => setState(null), [])
  const width = box.current?.clientWidth ?? 0
  const tip = state ? (
    <div
      className="feature-tip"
      role="status"
      style={{
        left: Math.min(Math.max(state.x, 90), Math.max(90, width - 90)),
        top: state.y,
      }}
    >
      {state.content}
    </div>
  ) : null
  return { box, show, hide, tip }
}

/** Buttons that pick one of a few options, as the feature charts' controls. */
export function Pick<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="feature-pick" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** The width of an element, kept up to date, so charts can draw at their real size and keep
 * their text readable on a phone. A callback ref, so it measures whenever the element mounts. */
export function useWidth<T extends HTMLElement>(fallback = 800) {
  const [el, setEl] = useState<T | null>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    if (!el) return
    const measure = () => setWidth(el.clientWidth || fallback)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [el, fallback])
  return [setEl, width] as const
}
