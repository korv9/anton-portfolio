/**
 * The warehouse as an entity–relationship diagram. An overview shows the subject areas and how
 * many references run between them; each area opens as a diagram of its tables, with primary and
 * foreign keys and crow's-foot lines (many at the referring table, one at the referred table).
 * Tables from another area that an area's tables point at are drawn faint at the edge.
 *
 * The data is schema/er.json, written by platform/publish/export_er.py: keys and relations are
 * checked in the warehouse (the coverage is the share of a foreign key's values found in the
 * referred table) or, for tables not built locally, taken from dbt's relationships tests.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { PlatformNav } from './PlatformNav'
import { l } from '../i18n'
import { count } from '../format'
import { fetchData } from '../dataSource'
import type { Route } from '../router'
import { useViewParams } from '../politik/useViewParams'
import { Stage, StageBlock, StageFacts } from '../ui/Stage'
import './er.css'

type Column = { name: string; type: string | null }
type Table = {
  id: string
  schema: string
  layer: 'gold' | 'seed'
  domain: string
  kind: string
  built: boolean
  rows: number | null
  description: string
  columns: Column[]
  pk: string[]
}
type Relation = {
  from: string
  from_cols: string[]
  to: string
  to_cols: string[]
  cardinality: 'many-to-one' | 'one-to-one'
  basis: ('data' | 'tested')[]
  coverage: number | null
}
type Er = {
  generated: string
  domains: { key: string; en: string; sv: string }[]
  tables: Table[]
  relations: Relation[]
  shared_codes: { code: string; tables: string[]; values: string[] }[]
}

const HUE: Record<string, string> = {
  shared: '#d9d4c7',
  welfare: '#b8d8b0',
  parliament: '#a9cbe8',
  politics: '#d0c3ec',
  taxes: '#f3d9a4',
  news: '#e8b4b8',
  market: '#9fd6cf',
  jobs: '#f0c7a0',
}
const KIND: Record<string, [string, string]> = {
  dimension: ['dimension', 'dimension'],
  fact: ['fact', 'fakta'],
  bridge: ['bridge', 'brygga'],
  mart: ['mart', 'mart'],
  intermediate: ['intermediate', 'mellanled'],
  model: ['model', 'modell'],
  seed: ['seed', 'seed'],
}

const num = count
const pct = (v: number) =>
  `${(v * 100).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 1 })} %`

/* ── Layout ────────────────────────────────────────────────────────────────────────────── */

const BOX_W = 184
const HEAD = 28
const ROW = 17
const GAP_X = 84
const GAP_Y = 22
const PAD = 24

type Placed = {
  table: Table
  ghost: boolean
  rows: { name: string; mark: 'PK' | 'FK' | 'PK FK' | 'code' }[]
  more: number
  x: number
  y: number
  h: number
}

function boxRows(table: Table, fks: Set<string>) {
  const marked = table.columns
    .map((c) => {
      const pk = table.pk.includes(c.name)
      const fk = fks.has(c.name)
      const mark: Placed['rows'][number]['mark'] | null =
        pk && fk
          ? 'PK FK'
          : pk
            ? 'PK'
            : fk
              ? 'FK'
              : c.name === 'party'
                ? 'code'
                : null
      return mark ? { name: c.name, mark } : null
    })
    .filter((r): r is Placed['rows'][number] => r !== null)
  return { rows: marked, more: table.columns.length - marked.length }
}

function layout(ids: string[], ghosts: Set<string>, er: Er, rels: Relation[]) {
  const byId = new Map(er.tables.map((t) => [t.id, t]))
  const out = new Map<string, string[]>()
  for (const r of rels) out.set(r.from, [...(out.get(r.from) ?? []), r.to])
  // Level: 0 for a table that refers to nothing in view, else one more than what it refers to.
  const level = new Map<string, number>()
  const visit = (id: string, path: Set<string>): number => {
    if (level.has(id)) return level.get(id)!
    if (path.has(id)) return 0
    path.add(id)
    const parents = (out.get(id) ?? []).filter((p) => p !== id)
    const v = parents.length
      ? 1 + Math.max(...parents.map((p) => visit(p, path)))
      : 0
    path.delete(id)
    level.set(id, v)
    return v
  }
  ids.forEach((id) => visit(id, new Set()))
  const maxLevel = Math.max(0, ...level.values())
  const columns: string[][] = Array.from({ length: maxLevel + 1 }, () => [])
  ids
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .forEach((id) => columns[maxLevel - level.get(id)!].push(id))
  // Order each column by the mean position of its neighbours, a few sweeps each way.
  const neighbours = new Map<string, string[]>()
  for (const r of rels) {
    neighbours.set(r.from, [...(neighbours.get(r.from) ?? []), r.to])
    neighbours.set(r.to, [...(neighbours.get(r.to) ?? []), r.from])
  }
  const position = () => {
    const pos = new Map<string, number>()
    columns.forEach((col) =>
      col.forEach((id, i) => pos.set(id, i / Math.max(1, col.length - 1))),
    )
    return pos
  }
  for (let sweep = 0; sweep < 6; sweep++) {
    const pos = position()
    const order = sweep % 2 ? columns.slice().reverse() : columns
    for (const col of order) {
      const score = (id: string) => {
        const ns = (neighbours.get(id) ?? []).filter((n) => pos.has(n))
        return ns.length
          ? ns.reduce((s, n) => s + pos.get(n)!, 0) / ns.length
          : pos.get(id)!
      }
      const scored = new Map(col.map((id) => [id, score(id)]))
      col.sort((a, b) => scored.get(a)! - scored.get(b)!)
    }
  }
  const fkCols = new Map<string, Set<string>>()
  for (const r of rels)
    fkCols.set(r.from, new Set([...(fkCols.get(r.from) ?? []), ...r.from_cols]))
  const placed = new Map<string, Placed>()
  const heights = columns.map((col) =>
    col.reduce((sum, id) => {
      const t = byId.get(id)!
      const { rows, more } = ghosts.has(id)
        ? {
            rows: boxRows(t, new Set()).rows.filter((r) =>
              r.mark.startsWith('PK'),
            ),
            more: 0,
          }
        : boxRows(t, fkCols.get(id) ?? new Set())
      return sum + HEAD + rows.length * ROW + (more ? ROW : 0) + 8 + GAP_Y
    }, 0),
  )
  const tallest = Math.max(...heights)
  columns.forEach((col, c) => {
    let y = PAD + (tallest - heights[c]) / 2
    for (const id of col) {
      const t = byId.get(id)!
      const ghost = ghosts.has(id)
      const { rows, more } = ghost
        ? {
            rows: boxRows(t, new Set()).rows.filter((r) =>
              r.mark.startsWith('PK'),
            ),
            more: 0,
          }
        : boxRows(t, fkCols.get(id) ?? new Set())
      const h = HEAD + rows.length * ROW + (more ? ROW : 0) + 8
      placed.set(id, {
        table: t,
        ghost,
        rows,
        more,
        x: PAD + c * (BOX_W + GAP_X),
        y,
        h,
      })
      y += h + GAP_Y
    }
  })
  return {
    placed,
    width: PAD * 2 + columns.length * BOX_W + (columns.length - 1) * GAP_X,
    height: PAD * 2 + tallest - GAP_Y,
  }
}

function rowY(p: Placed, col: string) {
  const i = p.rows.findIndex((r) => r.name === col)
  return i < 0 ? p.y + HEAD / 2 : p.y + HEAD + i * ROW + ROW / 2 + 2
}

/* ── Domain diagram ─────────────────────────────────────────────────────────────────────── */

function DomainDiagram({
  er,
  domain,
  selected,
  onSelect,
}: {
  er: Er
  domain: string
  selected: string
  onSelect: (id: string, domain: string) => void
}) {
  const [hover, setHover] = useState<string | null>(null)
  const view = useMemo(() => {
    const own = er.tables.filter((t) => t.domain === domain).map((t) => t.id)
    const ownSet = new Set(own)
    const rels = er.relations.filter((r) => ownSet.has(r.from))
    const ghosts = new Set(
      rels.map((r) => r.to).filter((id) => !ownSet.has(id)),
    )
    const ids = [...own, ...ghosts]
    return { rels, ghosts, ...layout(ids, ghosts, er, rels) }
  }, [er, domain])
  const focus = hover ?? (view.placed.has(selected) ? selected : null)
  // Shrink a wide diagram to fit its frame, but never below 78 %: past that it scrolls.
  const frame = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState(0)
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => setRoom(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const scale = room ? Math.min(1, Math.max(0.78, (room - 2) / view.width)) : 1
  const lit = (r: Relation) => !focus || r.from === focus || r.to === focus

  return (
    <div className="er-scroll" ref={frame}>
      <svg
        className="er-svg"
        role="group"
        width={view.width * scale}
        height={view.height * scale}
        viewBox={`0 0 ${view.width} ${view.height}`}
        aria-label={l(
          `Entity–relationship diagram: ${view.placed.size} tables and ${view.rels.length} relations.`,
          `ER-diagram: ${view.placed.size} tabeller och ${view.rels.length} relationer.`,
        )}
      >
        <g className="er-lines">
          {view.rels.map((r) => {
            const a = view.placed.get(r.from)!
            const b = view.placed.get(r.to)!
            const x1 = a.x + BOX_W
            const y1 = rowY(a, r.from_cols[0])
            const x2 = b.x
            const y2 = rowY(b, r.to_cols[0])
            const back = x2 <= x1
            const dx = back ? 60 : Math.max(30, (x2 - x1) / 2)
            const path = back
              ? `M${x1},${y1} C${x1 + dx},${y1} ${b.x + BOX_W + dx},${y2} ${b.x + BOX_W},${y2}`
              : `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
            const tested = !r.basis.includes('data')
            const endX = back ? b.x + BOX_W : x2
            const dir = back ? 1 : -1
            return (
              <g
                key={`${r.from}-${r.from_cols.join()}-${r.to}`}
                className={`er-rel${lit(r) ? '' : ' is-dim'}${focus && lit(r) ? ' is-lit' : ''}`}
              >
                <path d={path} className={tested ? 'is-tested' : ''} />
                {/* Many at the referring table (crow's foot), one at the referred table. */}
                {r.cardinality === 'many-to-one' ? (
                  <path
                    className="er-foot"
                    d={`M${x1 + 12},${y1} L${x1},${y1 - 6} M${x1 + 12},${y1} L${x1},${y1} M${x1 + 12},${y1} L${x1},${y1 + 6}`}
                  />
                ) : (
                  <path
                    className="er-foot"
                    d={`M${x1 + 8},${y1 - 6} L${x1 + 8},${y1 + 6}`}
                  />
                )}
                <path
                  className="er-foot"
                  d={`M${endX + dir * 7},${y2 - 6} L${endX + dir * 7},${y2 + 6} M${endX + dir * 12},${y2 - 6} L${endX + dir * 12},${y2 + 6}`}
                />
              </g>
            )
          })}
        </g>
        {[...view.placed.values()].map((p) => {
          const t = p.table
          const on = focus === t.id
          const dim =
            focus &&
            !on &&
            !view.rels.some(
              (r) =>
                (r.from === focus && r.to === t.id) ||
                (r.to === focus && r.from === t.id),
            )
          return (
            <g
              key={t.id}
              className={`er-box${p.ghost ? ' is-ghost' : ''}${on ? ' is-on' : ''}${dim ? ' is-dim' : ''}`}
              transform={`translate(${p.x},${p.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${t.id}, ${KIND[t.kind] ? l(...KIND[t.kind]) : t.kind}${p.ghost ? l(', another area', ', annat område') : ''}`}
              aria-pressed={selected === t.id}
              onMouseEnter={() => setHover(t.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(t.id)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect(t.id, t.domain)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(t.id, t.domain)
                }
              }}
            >
              <rect className="er-card" width={BOX_W} height={p.h} rx={3} />
              <rect
                className="er-head"
                width={BOX_W}
                height={HEAD}
                rx={3}
                style={{ fill: HUE[t.domain] ?? HUE.shared }}
              />
              <text className="er-name" x={10} y={18}>
                {t.id.length > 25 ? `${t.id.slice(0, 24)}…` : t.id}
              </text>
              <text className="er-kind" x={BOX_W - 8} y={18} textAnchor="end">
                {t.layer === 'seed' ? 'seed' : t.kind.slice(0, 3)}
              </text>
              {p.rows.map((r, i) => (
                <g
                  key={r.name}
                  transform={`translate(0,${HEAD + i * ROW + 4})`}
                >
                  <text
                    className={`er-mark is-${r.mark.split(' ')[0].toLowerCase()}`}
                    x={10}
                    y={12}
                  >
                    {r.mark === 'PK FK'
                      ? 'PF'
                      : r.mark === 'code'
                        ? '◇'
                        : r.mark}
                  </text>
                  <text className="er-col" x={34} y={12}>
                    {r.name.length > 22 ? `${r.name.slice(0, 21)}…` : r.name}
                  </text>
                </g>
              ))}
              {p.more > 0 && (
                <text
                  className="er-more"
                  x={34}
                  y={HEAD + p.rows.length * ROW + 16}
                >
                  {l(`+ ${p.more} more`, `+ ${p.more} till`)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ── Overview ──────────────────────────────────────────────────────────────────────────── */

function Overview({
  er,
  onOpen,
}: {
  er: Er
  onOpen: (domain: string) => void
}) {
  const W = 900
  const H = 560
  const domains = er.domains.filter((d) =>
    er.tables.some((t) => t.domain === d.key),
  )
  const domainOf = new Map(er.tables.map((t) => [t.id, t.domain]))
  const others = domains.filter((d) => d.key !== 'shared')
  const at = new Map<string, { x: number; y: number }>()
  at.set('shared', { x: W / 2, y: H / 2 - 20 })
  others.forEach((d, i) => {
    const a = (i / others.length) * Math.PI * 2 - Math.PI / 2
    at.set(d.key, {
      x: W / 2 + Math.cos(a) * 320,
      y: H / 2 - 20 + Math.sin(a) * 190,
    })
  })
  const links = new Map<string, number>()
  for (const r of er.relations) {
    const a = domainOf.get(r.from)!
    const b = domainOf.get(r.to)!
    if (a === b) continue
    const key = [a, b].sort().join('|')
    links.set(key, (links.get(key) ?? 0) + 1)
  }
  const party = er.shared_codes.find((c) => c.code === 'party')
  const partyDomains = new Set(party?.tables.map((t) => domainOf.get(t)!) ?? [])
  const partyAt = { x: W / 2, y: H - 22 }
  return (
    <svg
      className="er-overview"
      role="group"
      viewBox={`0 0 ${W} ${H}`}
      aria-label={l(
        'The subject areas and how many references run between them.',
        'Områdena och hur många referenser som går mellan dem.',
      )}
    >
      {[...links].map(([key, n]) => {
        const [a, b] = key.split('|')
        const p = at.get(a)!
        const q = at.get(b)!
        return (
          <g key={key} className="er-ov-link">
            <line
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              strokeWidth={1 + Math.sqrt(n) * 1.4}
            />
            <text
              x={(p.x + q.x) / 2}
              y={(p.y + q.y) / 2 - 6}
              textAnchor="middle"
            >
              {n}
            </text>
          </g>
        )
      })}
      {party &&
        [...partyDomains].map((d) => {
          const p = at.get(d)!
          return (
            <line
              key={d}
              className="er-ov-code-link"
              x1={partyAt.x}
              y1={partyAt.y}
              x2={p.x}
              y2={p.y}
            />
          )
        })}
      {party && (
        <g
          className="er-ov-code"
          transform={`translate(${partyAt.x},${partyAt.y})`}
        >
          <rect x={-46} y={-16} width={92} height={32} rx={16} />
          <text y={4} textAnchor="middle">
            ◇ party
          </text>
        </g>
      )}
      {domains.map((d) => {
        const p = at.get(d.key)!
        const tables = er.tables.filter((t) => t.domain === d.key)
        const inside = er.relations.filter(
          (r) => domainOf.get(r.from) === d.key && domainOf.get(r.to) === d.key,
        ).length
        return (
          <g
            key={d.key}
            className="er-ov-node"
            transform={`translate(${p.x},${p.y})`}
            role="button"
            tabIndex={0}
            aria-label={`${l(d.en, d.sv)}: ${tables.length} ${l('tables', 'tabeller')}`}
            onClick={() => onOpen(d.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(d.key)
              }
            }}
          >
            <rect
              x={-112}
              y={-34}
              width={224}
              height={68}
              rx={4}
              style={{ stroke: HUE[d.key] }}
            />
            <rect
              x={-112}
              y={-34}
              width={6}
              height={68}
              style={{ fill: HUE[d.key] }}
            />
            <text className="er-ov-name" y={-6} textAnchor="middle">
              {l(d.en, d.sv)}
            </text>
            <text className="er-ov-meta" y={16} textAnchor="middle">
              {tables.length} {l('tables', 'tabeller')}, {inside}{' '}
              {inside === 1 ? 'relation' : l('relations', 'relationer')}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── Panels ────────────────────────────────────────────────────────────────────────────── */

function TablePanel({
  er,
  id,
  onSelect,
}: {
  er: Er
  id: string
  onSelect: (id: string, domain: string) => void
}) {
  const t = er.tables.find((x) => x.id === id)
  if (!t) return null
  const out = er.relations.filter((r) => r.from === id)
  const into = er.relations.filter((r) => r.to === id)
  const fks = new Set(out.flatMap((r) => r.from_cols))
  const domainName = er.domains.find((d) => d.key === t.domain)
  const link = (other: string) => {
    const o = er.tables.find((x) => x.id === other)!
    return (
      <button
        type="button"
        className="er-link"
        onClick={() => onSelect(o.id, o.domain)}
      >
        {o.id}
      </button>
    )
  }
  return (
    <>
      <StageBlock title={t.id}>
        <StageFacts
          rows={[
            [
              l('Area', 'Område'),
              domainName ? l(domainName.en, domainName.sv) : t.domain,
            ],
            [l('Kind', 'Typ'), KIND[t.kind] ? l(...KIND[t.kind]) : t.kind],
            [l('Schema', 'Schema'), t.schema],
            [
              l('Rows', 'Rader'),
              t.rows == null
                ? l('not built locally', 'inte byggd lokalt')
                : num(t.rows),
            ],
            [
              l('Primary key', 'Primärnyckel'),
              t.pk.length ? t.pk.join(' + ') : '–',
            ],
          ]}
        />
        {t.description && <p>{t.description}</p>}
      </StageBlock>
      {out.length > 0 && (
        <StageBlock title={l('Refers to', 'Pekar på')}>
          <ul className="er-rels">
            {out.map((r) => (
              <li key={`${r.to}-${r.from_cols.join()}`}>
                <code>{r.from_cols.join(', ')}</code> → {link(r.to)}
                <span>
                  {r.coverage != null
                    ? l(`${pct(r.coverage)} found`, `${pct(r.coverage)} finns`)
                    : l('dbt test', 'dbt-test')}
                  {r.basis.includes('data') && r.basis.includes('tested')
                    ? l(', also tested', ', även testad')
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </StageBlock>
      )}
      {into.length > 0 && (
        <StageBlock
          title={l(
            `Referred to by (${into.length})`,
            `Refereras av (${into.length})`,
          )}
        >
          <ul className="er-rels">
            {into.map((r) => (
              <li key={`${r.from}-${r.from_cols.join()}`}>
                {link(r.from)}
                <span>
                  <code>{r.from_cols.join(', ')}</code>
                </span>
              </li>
            ))}
          </ul>
        </StageBlock>
      )}
      <StageBlock
        title={l(
          `Columns (${t.columns.length})`,
          `Kolumner (${t.columns.length})`,
        )}
      >
        <ul className="er-columns">
          {t.columns.map((c) => (
            <li key={c.name}>
              <span className="er-col-mark">
                {t.pk.includes(c.name) ? 'PK' : ''}
                {fks.has(c.name) ? (t.pk.includes(c.name) ? ' FK' : 'FK') : ''}
              </span>
              <code>{c.name}</code>
              <span className="er-col-type">{c.type?.toLowerCase() ?? ''}</span>
            </li>
          ))}
        </ul>
      </StageBlock>
    </>
  )
}

function Legend() {
  return (
    <svg className="er-legend" viewBox="0 0 260 96" aria-hidden="true">
      <g className="er-rel">
        <path d="M10,14 L120,14" />
        <path
          className="er-foot"
          d="M22,14 L10,8 M22,14 L10,14 M22,14 L10,20"
        />
        <path className="er-foot" d="M113,8 L113,20 M108,8 L108,20" />
      </g>
      <text x={130} y={18}>
        {l('many → one', 'många → en')}
      </text>
      <g className="er-rel">
        <path d="M10,46 L120,46" />
      </g>
      <text x={130} y={50}>
        {l('checked in data', 'kontrollerad i data')}
      </text>
      <g className="er-rel">
        <path className="is-tested" d="M10,78 L120,78" />
      </g>
      <text x={130} y={82}>
        {l('dbt test only', 'bara dbt-test')}
      </text>
    </svg>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────────────────── */

export default function ErPage({ route }: { route: Route }) {
  const [er, setEr] = useState<Er | null>(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useViewParams(route, {
    omrade: 'oversikt',
    tabell: '',
  })
  useEffect(() => {
    let live = true
    fetchData('schema/er.json')
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((d: Er) => live && setEr(d))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [])

  if (failed)
    return (
      <p className="ds-container" role="alert">
        {l(
          'The data model could not be loaded.',
          'Datamodellen kunde inte laddas.',
        )}
      </p>
    )
  if (!er)
    return (
      <p className="ds-container" role="status">
        {l('Loading…', 'Laddar…')}
      </p>
    )

  const domains = er.domains.filter((d) =>
    er.tables.some((t) => t.domain === d.key),
  )
  const domain = domains.some((d) => d.key === view.omrade)
    ? view.omrade
    : 'oversikt'
  const select = (id: string, d: string) => setView({ omrade: d, tabell: id })
  const checked = er.relations.filter((r) => r.basis.includes('data')).length
  const testedOnly = er.relations.length - checked
  const current = domains.find((d) => d.key === domain)

  return (
    <div className="er-page">
      <div className="ds-container">
        <PlatformNav current="#er" />
      </div>
      <Stage
        id="er"
        level={1}
        kicker={l('Data model', 'Datamodell')}
        title={l('How the data connects', 'Hur datan hänger ihop')}
        figure={
          <div className="er-figure">
            <div
              className="er-tabs"
              role="group"
              aria-label={l('Subject area', 'Område')}
            >
              <button
                type="button"
                aria-pressed={domain === 'oversikt'}
                onClick={() => setView({ omrade: 'oversikt', tabell: '' })}
              >
                {l('Overview', 'Översikt')}
              </button>
              {domains.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={domain === d.key}
                  onClick={() => setView({ omrade: d.key, tabell: '' })}
                >
                  <i style={{ background: HUE[d.key] }} aria-hidden="true" />
                  {l(d.en, d.sv)}
                </button>
              ))}
            </div>
            {domain === 'oversikt' ? (
              <Overview
                er={er}
                onOpen={(d) => setView({ omrade: d, tabell: '' })}
              />
            ) : (
              <DomainDiagram
                er={er}
                domain={domain}
                selected={view.tabell}
                onSelect={select}
              />
            )}
          </div>
        }
        left={
          <>
            <h2 className="visually-hidden">
              {l('About the model', 'Om modellen')}
            </h2>
            <StageBlock title={l('The warehouse', 'Lagret')}>
              <StageFacts
                rows={[
                  [l('Tables', 'Tabeller'), num(er.tables.length)],
                  [l('Relations', 'Relationer'), num(er.relations.length)],
                  [l('Checked in data', 'Kontrollerade i data'), num(checked)],
                  [l('dbt test only', 'Bara dbt-test'), num(testedOnly)],
                  [l('Built', 'Byggd'), er.generated],
                ]}
              />
            </StageBlock>
            <StageBlock title={l('How to read', 'Så läser du')}>
              <Legend />
              <p>
                {l(
                  'PK primary key, FK foreign key, ◇ party code. Faint boxes belong to another area.',
                  'PK primärnyckel, FK främmande nyckel, ◇ partikod. Bleka rutor hör till ett annat område.',
                )}
              </p>
            </StageBlock>
            <StageBlock title={l('Method', 'Metod')}>
              <p>
                {l(
                  'Keys are the smallest set of key columns that are unique and never empty in the data. A relation is drawn when a table holds another table’s whole key and at least 90 % of its values exist there.',
                  'Nycklar är den minsta uppsättningen nyckelkolumner som är unika och aldrig tomma i datan. En relation ritas när en tabell har en annan tabells hela nyckel och minst 90 % av värdena finns där.',
                )}
              </p>
              <p>
                <a href="#data-model">
                  {l('Lineage and example rows', 'Härkomst och exempelrader')}
                </a>
              </p>
            </StageBlock>
          </>
        }
        right={
          view.tabell && er.tables.some((t) => t.id === view.tabell) ? (
            <TablePanel er={er} id={view.tabell} onSelect={select} />
          ) : current ? (
            <StageBlock title={l(current.en, current.sv)}>
              <ul className="er-rels">
                {er.tables
                  .filter((t) => t.domain === domain)
                  .map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="er-link"
                        onClick={() => select(t.id, domain)}
                      >
                        {t.id}
                      </button>
                      <span>{KIND[t.kind] ? l(...KIND[t.kind]) : t.kind}</span>
                    </li>
                  ))}
              </ul>
            </StageBlock>
          ) : (
            <StageBlock title={l('Party', 'Parti')}>
              <p>
                {l(
                  'No table lists the parties, but these tables carry the party code:',
                  'Ingen tabell listar partierna, men de här tabellerna bär partikoden:',
                )}
              </p>
              <ul className="er-rels">
                {er.shared_codes
                  .find((c) => c.code === 'party')
                  ?.tables.map((id) => {
                    const t = er.tables.find((x) => x.id === id)!
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className="er-link"
                          onClick={() => select(id, t.domain)}
                        >
                          {id}
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </StageBlock>
          )
        }
      />
    </div>
  )
}
