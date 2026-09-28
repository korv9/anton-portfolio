/**
 * The one template every politics theme follows: a question, why it matters, at most three
 * key figures, one large chart, "Vad betyder det här?", the Graf / Tabell / Källor switch, and
 * a way further in (Fördjupa, or Bygg egen vy where the data allows its own view).
 */
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { l } from '../i18n'

export type Kpi = { value: string; label: string }
export type Source = { name: string; url?: string }

type Props = {
  question: string
  why: string
  kpis: Kpi[]
  /** Quick filters above the chart: period, party, issue. At most two or three. */
  filters?: ReactNode
  chartTitle: string
  /** Unit and period, e.g. "Procent av väljarna · maj 1973–maj 2026". */
  chartMeta: string
  chart: ReactNode
  /** The main result in one sentence, under the chart. */
  takeaway: string
  meaning: ReactNode
  table: ReactNode
  sources: Source[]
  updated?: string | null
  method?: ReactNode
  deepLinks: { href: string; label: string }[]
  /** Opens the view builder; left out where a theme has nothing to build. */
  onBuild?: () => void
  loading?: boolean
  error?: string | null
}

const TABS = ['graph', 'table', 'sources'] as const
type Tab = (typeof TABS)[number]

export default function ThemeLayout(props: Props) {
  const [tab, setTab] = useState<Tab>('graph')
  const id = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const labels: Record<Tab, string> = {
    graph: l('Chart', 'Graf'),
    table: l('Table', 'Tabell'),
    sources: l('Sources', 'Källor'),
  }
  const onKey = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + TABS.length) % TABS.length
    setTab(TABS[next])
    tabRefs.current[next]?.focus()
  }

  return (
    <article className="theme">
      <header className="theme-head">
        <h1 className="theme-question">{props.question}</h1>
        <p className="theme-why">{props.why}</p>
      </header>

      {props.error ? (
        <p role="alert" className="theme-error">
          {props.error}
        </p>
      ) : props.loading ? (
        <p className="theme-loading" role="status">
          {l('Loading data…', 'Hämtar data…')}
        </p>
      ) : (
        <>
          {props.kpis.length > 0 && (
            <dl className="theme-kpis">
              {props.kpis.slice(0, 3).map((kpi) => (
                <div key={kpi.label}>
                  <dt>{kpi.label}</dt>
                  <dd>{kpi.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <section className="theme-figure" aria-labelledby={`${id}-title`}>
            <div className="theme-figure-head">
              <div>
                <h2 id={`${id}-title`} className="theme-chart-title">
                  {props.chartTitle}
                </h2>
                <p className="theme-chart-meta">{props.chartMeta}</p>
              </div>
              <div
                className="theme-tabs"
                role="tablist"
                aria-label={l('Show as', 'Visa som')}
              >
                {TABS.map((key, index) => (
                  <button
                    key={key}
                    ref={(el) => {
                      tabRefs.current[index] = el
                    }}
                    type="button"
                    role="tab"
                    id={`${id}-tab-${key}`}
                    aria-selected={tab === key}
                    aria-controls={`${id}-panel`}
                    tabIndex={tab === key ? 0 : -1}
                    onClick={() => setTab(key)}
                    onKeyDown={(event) => onKey(event, index)}
                  >
                    {labels[key]}
                  </button>
                ))}
              </div>
            </div>
            {props.filters && tab !== 'sources' && (
              <div className="theme-filters">{props.filters}</div>
            )}
            <div
              id={`${id}-panel`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${tab}`}
              className="theme-panel"
            >
              {tab === 'graph' && props.chart}
              {tab === 'table' && (
                <div className="table-scroll theme-table">{props.table}</div>
              )}
              {tab === 'sources' && (
                <div className="theme-sources">
                  <ul>
                    {props.sources.map((source) => (
                      <li key={source.name}>
                        {source.url ? (
                          <a href={source.url} target="_blank" rel="noreferrer">
                            {source.name} ↗
                          </a>
                        ) : (
                          source.name
                        )}
                      </li>
                    ))}
                  </ul>
                  {props.method && (
                    <div className="theme-method">{props.method}</div>
                  )}
                </div>
              )}
            </div>
            <p className="theme-takeaway">{props.takeaway}</p>
            <p className="theme-source-line">
              {l('Source', 'Källa')}:{' '}
              {props.sources.map((s) => s.name).join(', ')}
              {props.updated &&
                ` · ${l('Updated', 'Uppdaterad')} ${props.updated}`}
            </p>
          </section>

          <section className="theme-meaning" aria-labelledby={`${id}-meaning`}>
            <h2 id={`${id}-meaning`}>
              {l('What does this mean?', 'Vad betyder det här?')}
            </h2>
            <div>{props.meaning}</div>
          </section>

          <nav
            className="theme-further"
            aria-label={l('Go further', 'Gå vidare')}
          >
            {props.onBuild && (
              <button
                type="button"
                className="ds-button"
                onClick={props.onBuild}
                aria-haspopup="dialog"
              >
                {l('Build your own view', 'Bygg egen vy')}
              </button>
            )}
            {props.deepLinks.length > 0 && (
              <div className="theme-deep">
                <p className="ds-label">{l('Go deeper', 'Fördjupa')}</p>
                <ul>
                  {props.deepLinks.map((link) => (
                    <li key={link.href}>
                      <a href={link.href}>{link.label} →</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </nav>
        </>
      )}
    </article>
  )
}
