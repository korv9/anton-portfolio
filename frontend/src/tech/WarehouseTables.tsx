import { useMemo, useState } from 'react'
import { Stacked } from '../charts/Compare'
import { num } from './techData'

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
  run: { evaluated_at: string; checks: number; dbt: string }
}

export function Checks({ quality }: { quality: Quality }) {
  const rows = quality.products.map((p) => {
    const own = quality.product_dimensions.filter(
      (d) => d.product_id === p.product_id,
    )
    const sum = (k: keyof (typeof own)[number]) =>
      own.reduce((s, d) => s + (d[k] as number), 0)
    const values = [
      sum('pass_count'),
      sum('warning_count'),
      sum('fail_count'),
      sum('not_measured_count') + sum('not_applicable_count'),
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
        { label: 'Passed', colour: 'var(--color-chart-neutral)' },
        { label: 'Warning', colour: 'var(--color-chart-muted)' },
        { label: 'Failed', colour: 'var(--negative)' },
        { label: 'Not measured', colour: 'var(--color-panel)' },
      ]}
      format={(v) => String(v)}
      label="Quality checks per product, by outcome"
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
          Search tables and columns
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="fct_, party, region_code…"
          />
        </label>
        <label>
          Layer
          <select value={layer} onChange={(e) => setLayer(e.target.value)}>
            <option value="">All ({models.nodes.length})</option>
            {Object.entries(models.layers).map(([key, count]) => (
              <option key={key} value={key}>
                {key} ({count})
              </option>
            ))}
          </select>
        </label>
        <p className="tech-meta" aria-live="polite">
          {shown.length} tables
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
                  {n.columns.length ? ` · ${n.columns.length} columns` : ''}
                  {n.rows != null ? ` · ${num(n.rows)} rows` : ''}
                  {n.tests.length ? ` · ${n.tests.length} tests` : ''}
                </span>
              </summary>
              {n.description && <p>{n.description}</p>}
              <p className="tech-meta">
                {n.path ?? 'declared source'}
                {n.reads.length
                  ? ` · reads ${n.reads.map(short).join(', ')}`
                  : ''}
                {n.read_by.length
                  ? ` · read by ${n.read_by.map(short).join(', ')}`
                  : ''}
              </p>
              {n.columns.length > 0 && (
                <table className="tech-table">
                  <thead>
                    <tr>
                      <th scope="col">Column</th>
                      <th scope="col">Type</th>
                      <th scope="col">Tests</th>
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
