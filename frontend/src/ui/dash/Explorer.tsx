/**
 * The table at the bottom of every dashboard: one tab per dataset, a select per filter column,
 * free-text search, sortable columns and 25 rows a page. A dataset loads the first time its
 * tab opens.
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { l } from '../../i18n'
import { ChartCard, Loading } from './Dash'

export type Cell = string | number | boolean | null
export type Row = Record<string, Cell>
export type ExplorerColumn = {
  key: string
  label: string
  numeric?: boolean
  format?: (value: Cell, row: Row) => ReactNode
}
export type Dataset = {
  key: string
  label: string
  sub: string
  columns: ExplorerColumn[]
  /** Columns that get a select above the table. */
  filters?: string[]
  load: () => Promise<Row[]>
}

const PAGE = 25
const number = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))

export default function Explorer({
  title,
  datasets,
}: {
  title: string
  datasets: Dataset[]
}) {
  const baseId = useId()
  const [active, setActive] = useState(datasets[0].key)
  const [loaded, setLoaded] = useState<Record<string, Row[] | 'error'>>({})
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: string; up: boolean } | null>(null)
  const [shown, setShown] = useState(PAGE)
  const dataset = datasets.find((d) => d.key === active) ?? datasets[0]
  const rows = loaded[dataset.key]

  useEffect(() => {
    if (loaded[dataset.key]) return
    let live = true
    dataset.load().then(
      (r) => live && setLoaded((s) => ({ ...s, [dataset.key]: r })),
      () => live && setLoaded((s) => ({ ...s, [dataset.key]: 'error' })),
    )
    return () => {
      live = false
    }
  }, [dataset, loaded])

  const pick = (key: string) => {
    setActive(key)
    setFilters({})
    setQuery('')
    setSort(null)
    setShown(PAGE)
  }

  const options = useMemo(() => {
    if (!Array.isArray(rows)) return {}
    return Object.fromEntries(
      (dataset.filters ?? []).map((key) => [
        key,
        [...new Set(rows.map((r) => String(r[key] ?? '')))]
          .filter(Boolean)
          .sort((a, b) => b.localeCompare(a, 'sv', { numeric: true })),
      ]),
    )
  }, [rows, dataset])

  const visible = useMemo(() => {
    if (!Array.isArray(rows)) return []
    const q = query.trim().toLowerCase()
    const out = rows.filter(
      (r) =>
        Object.entries(filters).every(
          ([key, value]) => !value || String(r[key]) === value,
        ) &&
        (!q ||
          dataset.columns.some((c) =>
            String(r[c.key] ?? '')
              .toLowerCase()
              .includes(q),
          )),
    )
    if (sort) {
      const sign = sort.up ? 1 : -1
      out.sort((a, b) => {
        const x = a[sort.key]
        const y = b[sort.key]
        if (typeof x === 'number' && typeof y === 'number')
          return (x - y) * sign
        return String(x ?? '').localeCompare(String(y ?? ''), 'sv') * sign
      })
    }
    return out
  }, [rows, filters, query, sort, dataset])

  return (
    <ChartCard title={title} sub={dataset.sub} className="dk-explorer">
      <div
        className="dk-tabs"
        role="tablist"
        aria-label={l('Dataset', 'Dataset')}
      >
        {datasets.map((d) => (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={d.key === dataset.key}
            onClick={() => pick(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="dk-explorer-controls" role="tabpanel">
        {(dataset.filters ?? []).map((key) => (
          <label key={key} className="dk-slicer">
            <span id={`${baseId}-${key}`}>
              {dataset.columns.find((c) => c.key === key)?.label ?? key}
            </span>
            <select
              aria-labelledby={`${baseId}-${key}`}
              value={filters[key] ?? ''}
              onChange={(e) => {
                setFilters({ ...filters, [key]: e.target.value })
                setShown(PAGE)
              }}
            >
              <option value="">{l('All', 'Alla')}</option>
              {(options[key] ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="dk-slicer dk-search">
          <span>{l('Search', 'Sök')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShown(PAGE)
            }}
          />
        </label>
        {Array.isArray(rows) && (
          <p className="dk-count" aria-live="polite">
            {l(
              `${number(visible.length)} of ${number(rows.length)} rows`,
              `${number(visible.length)} av ${number(rows.length)} rader`,
            )}
          </p>
        )}
      </div>
      {rows === 'error' ? (
        <p className="dk-empty">
          {l('This dataset did not load.', 'Datasetet kunde inte läsas.')}
        </p>
      ) : !rows ? (
        <Loading />
      ) : (
        <>
          <div className="dk-table-wrap" tabIndex={0}>
            <table className="dk-table">
              <caption className="visually-hidden">{dataset.sub}</caption>
              <thead>
                <tr>
                  {dataset.columns.map((c) => {
                    const on = sort?.key === c.key
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        className={c.numeric ? 'num' : undefined}
                        aria-sort={
                          on
                            ? sort!.up
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSort({
                              key: c.key,
                              up: on ? !sort!.up : !c.numeric,
                            })
                          }
                        >
                          {c.label}
                          <span aria-hidden="true">
                            {on ? (sort!.up ? ' ↑' : ' ↓') : ''}
                          </span>
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, shown).map((r, i) => (
                  <tr key={i}>
                    {dataset.columns.map((c) => (
                      <td key={c.key} className={c.numeric ? 'num' : undefined}>
                        {c.format
                          ? c.format(r[c.key], r)
                          : typeof r[c.key] === 'number'
                            ? number(r[c.key] as number)
                            : (r[c.key] ?? '–')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length > shown && (
            <button
              type="button"
              className="dk-button dk-more-rows"
              onClick={() => setShown(shown + PAGE)}
            >
              {l(
                `Show ${Math.min(PAGE, visible.length - shown)} more`,
                `Visa ${Math.min(PAGE, visible.length - shown)} till`,
              )}
            </button>
          )}
        </>
      )}
    </ChartCard>
  )
}
