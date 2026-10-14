/**
 * Places the tables of one subject for the ER diagram, from schema/er.json alone, so a new
 * table or relation in the export is drawn without anyone touching the page.
 *
 * A table that others refer to and that refers to nothing sits at the right; a table sits one
 * column left of the furthest table it refers to. Tables without a relation go in a row below.
 * Within a column the order follows the tables each one is joined to, to keep lines short.
 */
export type ErColumn = { name: string; type: string | null }
export type ErTable = {
  id: string
  layer: string
  domain: string
  kind: string
  built: boolean
  rows: number | null
  description: string
  columns: ErColumn[]
  pk: string[]
  pk_basis?: string
}
export type ErRelation = {
  from: string
  from_cols: string[]
  to: string
  to_cols: string[]
  cardinality: string
  basis: string[]
  coverage: number | null
}
export type ErModel = {
  generated: string
  method: Record<string, string>
  domains: { key: string; en: string }[]
  tables: ErTable[]
  relations: ErRelation[]
}

export const BOX_W = 232
export const HEAD_H = 30
export const ROW_H = 20
const GAP_X = 96
const GAP_Y = 22
const PAD = 16

export type Box = {
  table: ErTable
  /** From another subject: drawn so the relation has somewhere to end. */
  foreign: boolean
  /** The columns drawn: the key and every column a relation uses. */
  shown: ErColumn[]
  hidden: number
  x: number
  y: number
  h: number
}
export type Line = { relation: ErRelation; path: string }

/** The tables of a subject, and the tables elsewhere that they refer to. */
export function tablesOf(model: ErModel, domain: string) {
  const own = model.tables.filter((t) => t.domain === domain)
  const ids = new Set(own.map((t) => t.id))
  const relations = model.relations.filter(
    (r) => ids.has(r.from) || (ids.has(r.to) && ids.has(r.from)),
  )
  const foreign = [...new Set(relations.map((r) => r.to))]
    .filter((id) => !ids.has(id))
    .map((id) => model.tables.find((t) => t.id === id))
    .filter((t): t is ErTable => !!t)
  return { own, foreign, relations }
}

export function layout(model: ErModel, domain: string) {
  const { own, foreign, relations } = tablesOf(model, domain)
  const tables = [...own, ...foreign]
  const foreignIds = new Set(foreign.map((t) => t.id))
  const used = new Map<string, Set<string>>()
  const use = (id: string, cols: string[]) => {
    const set = used.get(id) ?? new Set<string>()
    cols.forEach((c) => set.add(c))
    used.set(id, set)
  }
  for (const r of relations) {
    use(r.from, r.from_cols)
    use(r.to, r.to_cols)
  }
  const out = new Map<string, string[]>()
  for (const r of relations)
    if (r.from !== r.to) out.set(r.from, [...(out.get(r.from) ?? []), r.to])

  // Depth: how many steps a table is from one that refers to nothing. A cycle stops at 0.
  const depth = new Map<string, number>()
  const walk = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!
    if (seen.has(id)) return 0
    seen.add(id)
    const d = Math.max(
      0,
      ...(out.get(id) ?? []).map((to) => 1 + walk(to, seen)),
    )
    depth.set(id, d)
    return d
  }
  tables.forEach((t) => walk(t.id, new Set()))
  const related = new Set(relations.flatMap((r) => [r.from, r.to]))
  const deepest = Math.max(0, ...[...related].map((id) => depth.get(id) ?? 0))

  const boxOf = (table: ErTable): Box => {
    const keep = new Set([...table.pk, ...(used.get(table.id) ?? [])])
    const shown = table.columns.filter((c) => keep.has(c.name))
    return {
      table,
      foreign: foreignIds.has(table.id),
      shown,
      hidden: table.columns.length - shown.length,
      x: 0,
      y: 0,
      h:
        HEAD_H +
        (shown.length + (shown.length < table.columns.length ? 1 : 0)) * ROW_H +
        6,
    }
  }
  const boxes = new Map(tables.map((t) => [t.id, boxOf(t)]))

  // Columns from the left: the deepest tables first, the ones referred to last.
  const columns: Box[][] = Array.from({ length: deepest + 1 }, () => [])
  for (const t of tables)
    if (related.has(t.id))
      columns[deepest - (depth.get(t.id) ?? 0)].push(boxes.get(t.id)!)
  const place = (column: Box[], x: number) => {
    let y = PAD
    for (const b of column) {
      b.x = x
      b.y = y
      y += b.h + GAP_Y
    }
    return y
  }
  columns.forEach((c, i) => place(c, PAD + i * (BOX_W + GAP_X)))
  // One pass from the right: order a column by where its tables' targets ended up.
  for (let i = columns.length - 2; i >= 0; i--) {
    const centre = (b: Box) => {
      const targets = (out.get(b.table.id) ?? []).map((id) => boxes.get(id)!)
      return targets.length
        ? targets.reduce((s, t) => s + t.y + t.h / 2, 0) / targets.length
        : Infinity
    }
    columns[i].sort((a, b) => centre(a) - centre(b))
    place(columns[i], PAD + i * (BOX_W + GAP_X))
  }
  let height = Math.max(PAD, ...columns.map((c) => place(c, c[0]?.x ?? PAD)))

  // Tables no relation touches: a row of their own under the diagram.
  const alone = tables
    .filter((t) => !related.has(t.id))
    .map((t) => boxes.get(t.id)!)
  const perRow = Math.max(1, columns.length)
  let rowTop = height + (alone.length && related.size ? GAP_Y : 0)
  for (let i = 0; i < alone.length; i += perRow) {
    const row = alone.slice(i, i + perRow)
    row.forEach((b, j) => {
      b.x = PAD + j * (BOX_W + GAP_X)
      b.y = rowTop
    })
    rowTop += Math.max(...row.map((b) => b.h)) + GAP_Y
  }
  if (alone.length) height = rowTop

  const rowY = (b: Box, col: string) => {
    const i = b.shown.findIndex((c) => c.name === col)
    return b.y + HEAD_H + (Math.max(0, i) + 0.5) * ROW_H
  }
  // Each line leaves the right edge of its column row and enters the left edge of the key,
  // turning in the gap at a place of its own so two lines never share a vertical run.
  const lanes = new Map<number, number>()
  const lines: Line[] = relations
    .filter((r) => r.from !== r.to)
    .map((relation) => {
      const a = boxes.get(relation.from)!
      const b = boxes.get(relation.to)!
      const y1 = rowY(a, relation.from_cols[0])
      const y2 = rowY(b, relation.to_cols[0])
      const x1 = a.x + BOX_W
      const lane = lanes.get(a.x) ?? 0
      lanes.set(a.x, lane + 1)
      const turn = x1 + 14 + (lane % 12) * 6
      // A relation inside a cycle ends on the near side of a table in the same column.
      const x2 = b.x > a.x ? b.x : b.x + BOX_W
      return { relation, path: `M${x1} ${y1}H${turn}V${y2}H${x2}` }
    })
  return {
    boxes: [...boxes.values()],
    lines,
    width:
      PAD * 2 +
      Math.max(1, columns.length, Math.min(alone.length, perRow)) *
        (BOX_W + GAP_X) -
      GAP_X,
    height: height + PAD - GAP_Y,
  }
}
