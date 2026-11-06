/**
 * A few real rows of one dbt model or seed, from schema/samples (export_schema.py writes them with
 * models.json on every publish). Fetched when opened; a model without published rows says so.
 */
import { useEffect, useState } from 'react'
import { fetchJson } from '../dataSource'
import { l } from '../i18n'

type Sample = { columns: string[]; rows: unknown[][] }

const cell = (v: unknown) =>
  v == null ? '–' : typeof v === 'object' ? JSON.stringify(v) : String(v)

export default function NodeSample({ name }: { name: string }) {
  const [sample, setSample] = useState<Sample | 'none' | null>(null)
  useEffect(() => {
    let live = true
    fetchJson<Sample>(`schema/samples/portfolio.${name}.json`).then(
      (s) => live && setSample(s.rows.length ? s : 'none'),
      () => live && setSample('none'),
    )
    return () => {
      live = false
    }
  }, [name])
  if (!sample)
    return (
      <p className="hub-sample-note">{l('Loading rows…', 'Hämtar rader…')}</p>
    )
  if (sample === 'none')
    return (
      <p className="hub-sample-note">
        {l(
          'No example rows are published for this one.',
          'Inga exempelrader är publicerade för den här.',
        )}
      </p>
    )
  return (
    <div className="dk-table-wrap hub-sample">
      <table className="dk-table">
        <caption>
          {l(
            `${sample.rows.length} example rows of ${name}`,
            `${sample.rows.length} exempelrader ur ${name}`,
          )}
        </caption>
        <thead>
          <tr>
            {sample.columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sample.rows.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j}>{cell(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
