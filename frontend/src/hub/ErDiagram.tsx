/**
 * The warehouse's tables and relations as an entity–relationship diagram, one subject area at a
 * time. Everything comes from schema/er.json (platform/publish/export_er.py, rebuilt with each
 * public-data release and read live from R2), so a new model or relation appears without a code
 * change. Referring tables stand on the left, the tables they refer to on the right; tables from
 * another area are drawn faint. A line is solid when the relation was checked in the data, dashed
 * when it comes from dbt's relationships tests only. Each table shows its key columns.
 */
import { useMemo, useState } from 'react'
import { l } from '../i18n'
import { ok, useJson } from '../useJson'

type Table = {
  id: string
  domain: string
  kind: string
  rows: number | null
  description: string
  pk: string[]
}
type Relation = {
  from: string
  from_cols: string[]
  to: string
  to_cols: string[]
  basis: string[]
}
type Er = {
  domains: { key: string; en: string; sv: string }[]
  tables: Table[]
  relations: Relation[]
}
type Box = { t: Table; x: number; y: number; keys: string[]; faint: boolean }

const W = 250
const HEAD = 30
const ROW = 18
const GAP = 16
const SPAN = 260

function layout(er: Er, domain: string) {
  const byId = new Map(er.tables.map((t) => [t.id, t]))
  const own = er.tables.filter((t) => t.domain === domain)
  const ids = new Set(own.map((t) => t.id))
  const rels = er.relations.filter((r) => ids.has(r.from) || ids.has(r.to))
  const keys = new Map<string, Set<string>>()
  const add = (id: string, cols: string[]) => {
    const set = keys.get(id) ?? new Set(byId.get(id)?.pk ?? [])
    cols.forEach((c) => set.add(c))
    keys.set(id, set)
  }
  for (const t of own) add(t.id, [])
  for (const r of rels) {
    add(r.from, r.from_cols)
    add(r.to, r.to_cols)
  }
  const referring = new Set(rels.map((r) => r.from))
  const all = [...keys.keys()]
    .map((id) => byId.get(id))
    .filter((t) => t != null)
  const left = all.filter((t) => referring.has(t.id))
  const right = all.filter((t) => !referring.has(t.id))
  const boxes = new Map<string, Box>()
  const column = (list: Table[], x: number) => {
    let y = 0
    for (const t of list.sort((a, b) => a.id.localeCompare(b.id))) {
      const k = [...keys.get(t.id)!]
      boxes.set(t.id, { t, x, y, keys: k, faint: t.domain !== domain })
      y += HEAD + k.length * ROW + 8 + GAP
    }
    return y
  }
  const height = Math.max(column(left, 0), column(right, W + SPAN), 40)
  return { boxes, rels, height, own: own.length }
}

const rowY = (b: Box, col: string) =>
  b.y + HEAD + Math.max(0, b.keys.indexOf(col)) * ROW + ROW / 2

export default function ErDiagram() {
  const er = useJson<Er>('schema/er.json')
  const [domain, setDomain] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const areas = useMemo(
    () =>
      ok(er)
        ? er.domains
            .map((d) => ({
              ...d,
              n: er.tables.filter((t) => t.domain === d.key).length,
            }))
            .filter((d) => d.n > 0)
        : [],
    [er],
  )
  // The shared dimensions are the biggest area; a subject area reads better first.
  const shown =
    domain ?? areas.find((d) => d.key !== 'shared')?.key ?? areas[0]?.key
  const view = useMemo(
    () => (ok(er) && shown ? layout(er, shown) : null),
    [er, shown],
  )
  if (!ok(er) || !view) return null
  const width = W * 2 + SPAN
  const lit = (r: Relation) => hover === r.from || hover === r.to
  return (
    <figure className="hub-er">
      <div
        className="hub-er-tabs"
        role="group"
        aria-label={l('Subject area', 'Område')}
      >
        {areas.map((d) => (
          <button
            key={d.key}
            type="button"
            aria-pressed={d.key === shown}
            onClick={() => setDomain(d.key)}
          >
            {l(d.en, d.sv)} <span>{d.n}</span>
          </button>
        ))}
      </div>
      <div
        className="hub-er-scroll"
        tabIndex={0}
        role="region"
        aria-label={l('Diagram, scrollable', 'Diagram, går att scrolla')}
      >
        <svg
          viewBox={`-2 -2 ${width + 4} ${view.height + 4}`}
          width={width + 4}
          role="img"
          aria-label={l(
            `${view.own} tables and ${view.rels.length} relations in this area.`,
            `${view.own} tabeller och ${view.rels.length} relationer i området.`,
          )}
        >
          {view.rels.map((r, i) => {
            const a = view.boxes.get(r.from)
            const b = view.boxes.get(r.to)
            if (!a || !b) return null
            const x1 = a.x + W
            const y1 = rowY(a, r.from_cols[0])
            const same = a.x === b.x
            const x2 = same ? b.x + W : b.x
            const y2 = rowY(b, r.to_cols[0])
            const bend = same ? 70 : SPAN / 2
            return (
              <g
                key={i}
                className={`hub-er-rel${r.basis.includes('data') ? '' : ' is-tested'}${lit(r) ? ' is-lit' : ''}`}
              >
                <path
                  d={`M${x1} ${y1} C${x1 + bend} ${y1} ${x2 + (same ? bend : -bend)} ${y2} ${x2} ${y2}`}
                />
                {/* Many at the referring table, one at the referred table. */}
                <path
                  d={`M${x1} ${y1 - 6} L${x1 + 10} ${y1} L${x1} ${y1 + 6}`}
                />
                <path d={`M${x2 + (same ? 8 : -8)} ${y2 - 6} V${y2 + 6}`} />
              </g>
            )
          })}
          {[...view.boxes.values()].map((b) => (
            <g
              key={b.t.id}
              className={`hub-er-table${b.faint ? ' is-faint' : ''}${hover === b.t.id ? ' is-lit' : ''}`}
              transform={`translate(${b.x} ${b.y})`}
              onPointerEnter={() => setHover(b.t.id)}
              onPointerLeave={() => setHover(null)}
            >
              <title>{b.t.description}</title>
              <rect width={W} height={HEAD + b.keys.length * ROW + 8} rx="2" />
              <text x="10" y="20" className="hub-er-name">
                {b.t.id}
              </text>
              {b.t.rows != null && (
                <text
                  x={W - 10}
                  y="20"
                  textAnchor="end"
                  className="hub-er-rows"
                >
                  {b.t.rows.toLocaleString(l('en-GB', 'sv-SE'))}
                </text>
              )}
              {b.keys.map((k, i) => (
                <text
                  key={k}
                  x="10"
                  y={HEAD + i * ROW + 13}
                  className="hub-er-col"
                >
                  {b.t.pk.includes(k) ? 'PK ' : 'FK '}
                  {k}
                </text>
              ))}
            </g>
          ))}
        </svg>
      </div>
      <figcaption>
        {l(
          `${er.tables.length} tables and ${er.relations.length} relations across the warehouse, from the platform's own export. Solid lines were checked in the data, dashed ones come from dbt tests. Hover a table to follow its relations.`,
          `${er.tables.length} tabeller och ${er.relations.length} relationer i hela lagret, ur plattformens egen export. Heldragna linjer är kontrollerade i datan, streckade kommer från dbt-tester. Hovra över en tabell för att följa dess relationer.`,
        )}
      </figcaption>
    </figure>
  )
}
