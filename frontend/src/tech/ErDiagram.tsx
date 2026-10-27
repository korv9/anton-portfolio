/**
 * One subject's tables as an ER diagram, drawn from schema/er.json: a box per table with its
 * key and the columns a relation uses, a line per relation. Press a table to see every column
 * and to keep only its relations lit.
 */
import { l } from '../i18n'
import { useMemo, useState } from 'react'
import {
  BOX_W,
  HEAD_H,
  ROW_H,
  layout,
  type ErModel,
  type ErTable,
} from './erLayout'

const num = (n: number) => n.toLocaleString('en-GB')

export default function ErDiagram({
  model,
  domain,
}: {
  model: ErModel
  domain: string
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const { boxes, lines, width, height } = useMemo(
    () => layout(model, domain),
    [model, domain],
  )
  const table = boxes.find((b) => b.table.id === picked)?.table ?? null
  const joined = new Set(
    lines
      .filter((l) => l.relation.from === picked || l.relation.to === picked)
      .flatMap((l) => [l.relation.from, l.relation.to]),
  )
  const lit = (id: string) => !picked || id === picked || joined.has(id)
  return (
    <div className="er">
      <div
        className="er-scroll"
        tabIndex={0}
        role="group"
        aria-label={`ER diagram, ${domain}`}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <g className="er-lines">
            {lines.map((l) => {
              const on =
                !picked ||
                l.relation.from === picked ||
                l.relation.to === picked
              return (
                <path
                  key={`${l.relation.from}.${l.relation.from_cols}-${l.relation.to}`}
                  d={l.path}
                  className={on ? (picked ? 'lit' : undefined) : 'dim'}
                >
                  <title>
                    {`${l.relation.from}.${l.relation.from_cols.join(', ')} → ${l.relation.to}.${l.relation.to_cols.join(', ')} (${l.relation.cardinality}, ${l.relation.basis.join(' and ')})`}
                  </title>
                </path>
              )
            })}
          </g>
          {boxes.map((b) => (
            <g
              key={b.table.id}
              className={[
                'er-box',
                b.table.kind,
                b.foreign && 'foreign',
                b.table.id === picked && 'picked',
                !lit(b.table.id) && 'dim',
              ]
                .filter(Boolean)
                .join(' ')}
              transform={`translate(${b.x} ${b.y})`}
              tabIndex={0}
              role="button"
              aria-pressed={b.table.id === picked}
              aria-label={`${b.table.id}, ${b.table.kind}, ${b.table.columns.length} columns`}
              onClick={() =>
                setPicked(b.table.id === picked ? null : b.table.id)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setPicked(b.table.id === picked ? null : b.table.id)
                }
              }}
            >
              <rect className="er-frame" width={BOX_W} height={b.h} rx={4} />
              <rect className="er-head" width={BOX_W} height={HEAD_H} rx={4} />
              <text className="er-name" x={10} y={19}>
                {b.table.id.length > 30
                  ? `${b.table.id.slice(0, 29)}…`
                  : b.table.id}
              </text>
              {b.shown.map((c, i) => (
                <g
                  key={c.name}
                  transform={`translate(0 ${HEAD_H + i * ROW_H})`}
                >
                  <text
                    className={
                      b.table.pk.includes(c.name) ? 'er-col key' : 'er-col'
                    }
                    x={10}
                    y={14}
                  >
                    {c.name.length > 22 ? `${c.name.slice(0, 21)}…` : c.name}
                  </text>
                  <text className="er-type" x={BOX_W - 10} y={14}>
                    {b.table.pk.includes(c.name) ? 'PK' : 'FK'}
                  </text>
                </g>
              ))}
              {b.hidden > 0 && (
                <text
                  className="er-more"
                  x={10}
                  y={HEAD_H + b.shown.length * ROW_H + 14}
                >
                  + {b.hidden} more
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      {table ? (
        <TableCard table={table} model={model} />
      ) : (
        <p className="tech-note">
          {l(
            'Press a table for all its columns. A box shows the key (PK) and the columns a relation uses (FK); dashed boxes belong to another subject.',
            'Tryck på en tabell för att se alla dess kolumner. En ruta visar nyckeln (PK) och kolumnerna som en relation använder (FK); streckade rutor hör till ett annat ämne.',
          )}
        </p>
      )}
    </div>
  )
}

function TableCard({ table, model }: { table: ErTable; model: ErModel }) {
  const relations = model.relations.filter(
    (r) => r.from === table.id || r.to === table.id,
  )
  return (
    <section className="er-card" aria-label={table.id}>
      <header>
        <h3>{table.id}</h3>
        <p className="tech-meta">
          {table.kind} · {table.layer} ·{' '}
          {table.rows == null ? 'not built locally' : `${num(table.rows)} rows`}{' '}
          · key {table.pk.join(', ') || 'none'}
          {table.pk_basis ? ` (${table.pk_basis})` : ''}
        </p>
        {table.description && <p>{table.description}</p>}
      </header>
      <div className="er-card-body">
        <table className="tech-table">
          <thead>
            <tr>
              <th scope="col">Column</th>
              <th scope="col">Type</th>
              <th scope="col">Role</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((c) => {
              const to = relations.find(
                (r) => r.from === table.id && r.from_cols.includes(c.name),
              )
              return (
                <tr key={c.name}>
                  <th scope="row">{c.name}</th>
                  <td>{c.type ?? '–'}</td>
                  <td>
                    {[
                      table.pk.includes(c.name) && 'PK',
                      to && `→ ${to.to}.${to.to_cols.join(', ')}`,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {relations.length > 0 && (
          <table className="tech-table">
            <thead>
              <tr>
                <th scope="col">Relation</th>
                <th scope="col">Kind</th>
                <th scope="col">Rests on</th>
              </tr>
            </thead>
            <tbody>
              {relations.map((r) => (
                <tr key={`${r.from}.${r.from_cols}-${r.to}`}>
                  <th scope="row">
                    {r.from}.{r.from_cols.join(', ')} → {r.to}.
                    {r.to_cols.join(', ')}
                  </th>
                  <td>{r.cardinality}</td>
                  <td>
                    {r.basis.join(', ')}
                    {r.coverage != null
                      ? `, ${Math.round(r.coverage * 100)} % matched`
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
