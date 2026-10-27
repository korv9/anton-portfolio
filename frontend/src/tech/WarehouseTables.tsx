import { useMemo, useState } from 'react'
import { Stacked } from '../charts/Compare'
import { l } from '../i18n'
import { num } from './techData'

const plural = (n: number, one: string, many: string) =>
  `${num(n)} ${n === 1 ? one : many}`

export type Quality = {
  products: { product_id: string; label_en: string }[]
  product_dimensions: {
    product_id: string
    pass_count: number
    warning_count: number
    fail_count: number
    not_measured_count: number
    not_applicable_count: number
  }[]
  run: {
    evaluated_at: string
    checks: number
    dbt: string
    check_statuses?: Record<string, number>
  }
}

export function Checks({ quality }: { quality: Quality }) {
  const rows = quality.products.map((p) => {
    const own = quality.product_dimensions.filter(
      (d) => d.product_id === p.product_id,
    )
    const sum = (k: keyof (typeof own)[number]) =>
      own.reduce((s, d) => s + (d[k] as number), 0)
    // A check that does not apply to a product is not a gap in it, so it is left out.
    const values = [
      sum('pass_count'),
      sum('warning_count'),
      sum('fail_count'),
      sum('not_measured_count'),
    ]
    return {
      key: p.product_id,
      label: p.label_en,
      values,
      text: `${values[0]} / ${values.reduce((s, v) => s + v, 0)}`,
    }
  })
  return (
    <Stacked
      rows={rows.filter((r) => r.values.some(Boolean))}
      parts={[
        {
          label: l('Passed', 'Godkänd'),
          colour: 'var(--color-chart-neutral)',
        },
        {
          label: l('Warning', 'Varning'),
          colour: 'var(--color-chart-muted)',
        },
        { label: l('Failed', 'Underkänd'), colour: 'var(--negative)' },
        { label: l('Not measured', 'Ej mätt'), colour: 'var(--color-panel)' },
      ]}
      format={(v) => String(v)}
      label={l(
        'Quality checks per product, by outcome',
        'Kvalitetskontroller per produkt, efter utfall',
      )}
    />
  )
}

// ---------- Every table, with its columns ----------
type Model = {
  id: string
  name: string
  kind: string
  layer: string
  subject: string | null
  materialized: string | null
  description: string
  path: string | null
  reads: string[]
  read_by: string[]
  tests: string[]
  columns: { name: string; type: string | null; tests: string[] }[]
  rows: number | null
}
export type Models = {
  generated_at?: string
  dbt_version: string
  layers: Record<string, number>
  tests: number
  nodes: Model[]
}

const short = (id: string) => id.split('.').at(-1)!

export function Tables({ models }: { models: Models }) {
  const [query, setQuery] = useState('')
  const [layer, setLayer] = useState('')
  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () =>
      models.nodes
        .filter((n) => !layer || n.layer === layer)
        .filter(
          (n) =>
            !q ||
            n.name.toLowerCase().includes(q) ||
            n.columns.some((c) => c.name.toLowerCase().includes(q)),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [models, q, layer],
  )
  return (
    <>
      <div className="tech-filters">
        <label>
          {l('Search tables and columns', 'Sök tabeller och kolumner')}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="fct_, party, region_code…"
          />
        </label>
        <label>
          {l('Layer', 'Lager')}
          <select value={layer} onChange={(e) => setLayer(e.target.value)}>
            <option value="">
              {l('All', 'Alla')} ({models.nodes.length})
            </option>
            {Object.entries(models.layers).map(([key, count]) => (
              <option key={key} value={key}>
                {key} ({count})
              </option>
            ))}
          </select>
        </label>
        <p className="tech-meta" aria-live="polite">
          {plural(shown.length, l('table', 'tabell'), l('tables', 'tabeller'))}
        </p>
      </div>
      <ul className="tables">
        {shown.map((n) => (
          <li key={n.id}>
            <details>
              <summary>
                <b>{n.name}</b>
                <span className="tech-meta">
                  {n.layer}
                  {n.subject ? ` · ${n.subject}` : ''}
                  {n.columns.length
                    ? ` · ${plural(n.columns.length, l('column', 'kolumn'), l('columns', 'kolumner'))}`
                    : ''}
                  {n.rows != null
                    ? ` · ${plural(n.rows, l('row', 'rad'), l('rows', 'rader'))}`
                    : ''}
                  {n.tests.length
                    ? ` · ${plural(n.tests.length, l('test', 'test'), l('tests', 'tester'))}`
                    : ''}
                </span>
              </summary>
              {n.description && <p>{n.description}</p>}
              <p className="tech-meta">
                {n.path ?? l('declared source', 'deklarerad källa')}
                {n.reads.length
                  ? ` · ${l('reads', 'läser')} ${n.reads.map(short).join(', ')}`
                  : ''}
                {n.read_by.length
                  ? ` · ${l('read by', 'läses av')} ${n.read_by.map(short).join(', ')}`
                  : ''}
              </p>
              {n.columns.length > 0 && (
                <table className="tech-table">
                  <thead>
                    <tr>
                      <th scope="col">{l('Column', 'Kolumn')}</th>
                      <th scope="col">{l('Type', 'Typ')}</th>
                      <th scope="col">{l('Tests', 'Tester')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {n.columns.map((c) => (
                      <tr key={c.name}>
                        <th scope="row">{c.name}</th>
                        <td>{c.type ?? '–'}</td>
                        <td>{c.tests.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </details>
          </li>
        ))}
      </ul>
    </>
  )
}

// ---------- The page ----------
