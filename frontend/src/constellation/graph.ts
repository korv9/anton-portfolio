/**
 * The Data Constellation's data and the pure logic behind the map: types for graph.json
 * (platform/architecture/build_graph.py), the layered layout, lineage closure and filters.
 * No React and no DOM here, so it is unit-tested directly.
 *
 * Layout: x is the architecture stage (source → ingestion → raw → bronze → silver → ML → gold →
 * delivery → frontend), y the domain lane. Inside one lane and stage, nodes sit on a small
 * sunflower spiral around the cell's centre, so they read as a cluster of stars without leaving
 * their place in the hierarchy. Positions are deterministic: the same graph gives the same map.
 */

export type NodeType =
  | 'source'
  | 'ingestion'
  | 'raw'
  | 'seed'
  | 'bronze'
  | 'silver'
  | 'ml'
  | 'gold'
  | 'delivery'
  | 'frontend'
  | 'shared'

export type EdgeType =
  | 'lineage'
  | 'relationship'
  | 'delivery'
  | 'frontend-consumption'
  | 'infrastructure'

export type GraphNode = {
  id: string
  label: string
  type: NodeType
  layer: string
  domain: string
  path?: string
  url?: string
  href?: string
  description?: string
  materialized?: string | null
  kind?: string | null
  keys?: string[]
  rows?: number | null
  columns?: string[]
  column_count?: number
  enabled?: boolean
  tables?: string[]
  files?: number
  formats?: Record<string, number>
  published_by?: { path: string; legacy: boolean }[]
  examples?: string[]
}

export type GraphEdge = {
  source: string
  target: string
  type: EdgeType
  via?: string
  from_cols?: string[]
  to_cols?: string[]
  cardinality?: string | null
  basis?: string[] | null
}

export type Domain = {
  id: string
  label: string
  lane: number
  counts: Record<string, number>
}

export type Graph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  domains: Domain[]
  layers: string[]
  generated_at?: string
  dbt_version?: string
}

export type Mode = 'platform' | 'model' | 'lineage' | 'quality'

/** Edges that carry data forward; the ones lineage highlighting follows. */
export const FLOW: EdgeType[] = ['lineage', 'delivery', 'frontend-consumption']

export type Placed = GraphNode & { x: number; y: number }

/** A stable number in [0, 1) from a string, for deterministic offsets. */
export function hash01(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

/**
 * Where shared infrastructure sits: a stage (fraction of a stage index) and a vertical offset
 * within the shared lane (fraction of half its height), so neighbours do not overlap.
 */
const SHARED_PLACE: Record<string, [number, number]> = {
  'infra:rawstore': [1.6, -0.45],
  'infra:legal': [3.6, 0.45],
  'infra:warehouse': [4, -0.45],
  'infra:catalog': [6.8, -0.45],
  'infra:r2': [7.7, 0.45],
  'infra:quality': [6.2, 0.45],
}

/** In the data-model view, tables are grouped by kind from left to right. */
const KIND_STAGE: Record<string, number> = {
  seed: 0,
  dimension: 1,
  bridge: 2,
  fact: 2,
  intermediate: 3,
  model: 3,
  mart: 3,
}

/** Nodes shown in a mode: the data-model view keeps gold tables and seeds only. */
export function nodesFor(graph: Graph, mode: Mode): GraphNode[] {
  if (mode !== 'model') return graph.nodes
  return graph.nodes.filter((n) => n.type === 'gold' || n.type === 'seed')
}

/**
 * Positions in a unit box (0–1 both ways) for the nodes of a mode. Lanes are the domains in
 * their registry order; columns are the stages (or the table kinds in the data-model view).
 */
export function layout(graph: Graph, mode: Mode): Map<string, Placed> {
  const nodes = nodesFor(graph, mode)
  const lanes = [...graph.domains].sort((a, b) => a.lane - b.lane)
  const laneOf = new Map(lanes.map((d, i) => [d.id, i]))
  const stages = mode === 'model' ? 4 : graph.layers.length
  const stageOf = (n: GraphNode): number => {
    if (mode === 'model')
      return KIND_STAGE[n.kind ?? (n.type === 'seed' ? 'seed' : 'model')] ?? 3
    if (n.type === 'shared') return SHARED_PLACE[n.id]?.[0] ?? 4
    const i = graph.layers.indexOf(n.layer)
    return i < 0 ? 0 : i
  }
  const cells = new Map<string, GraphNode[]>()
  for (const n of nodes) {
    const key = `${laneOf.get(n.domain) ?? 0}:${stageOf(n)}`
    const list = cells.get(key) ?? []
    list.push(n)
    cells.set(key, list)
  }
  const laneH = 1 / lanes.length
  const colW = 1 / stages
  const placed = new Map<string, Placed>()
  for (const [key, list] of cells) {
    const [lane, stage] = key.split(':').map(Number)
    const cx = (stage + 0.5) * colW
    const cy = (lane + 0.5) * laneH
    list.sort((a, b) => a.id.localeCompare(b.id))
    const n = list.length
    // Sunflower spiral: even density, the first node at the centre.
    const rx = colW * 0.42
    const ry = laneH * 0.4
    list.forEach((node, i) => {
      if (n === 1) {
        const dy =
          node.type === 'shared' ? (SHARED_PLACE[node.id]?.[1] ?? 0) * ry : 0
        placed.set(node.id, { ...node, x: cx, y: cy + dy })
        return
      }
      const r = Math.sqrt((i + 0.5) / n)
      const a = i * 2.39996 + hash01(node.id) * 0.6
      placed.set(node.id, {
        ...node,
        x: cx + Math.cos(a) * r * rx,
        y: cy + Math.sin(a) * r * ry,
      })
    })
  }
  return placed
}

/** Every node upstream of `id` (what it is built from), following data-flow edges. */
export function upstream(graph: Graph, id: string): Set<string> {
  return walk(graph, id, 'up')
}

/** Every node downstream of `id` (what is built from it). */
export function downstream(graph: Graph, id: string): Set<string> {
  return walk(graph, id, 'down')
}

function walk(graph: Graph, id: string, dir: 'up' | 'down'): Set<string> {
  const next = new Map<string, string[]>()
  for (const e of graph.edges) {
    if (!FLOW.includes(e.type)) continue
    const [from, to] =
      dir === 'up' ? [e.target, e.source] : [e.source, e.target]
    const list = next.get(from) ?? []
    list.push(to)
    next.set(from, list)
  }
  const seen = new Set<string>()
  const stack = [id]
  while (stack.length) {
    for (const n of next.get(stack.pop()!) ?? []) {
      if (!seen.has(n)) {
        seen.add(n)
        stack.push(n)
      }
    }
  }
  return seen
}

/** The selected node with everything up- and downstream of it. */
export function lineageOf(graph: Graph, id: string): Set<string> {
  return new Set([id, ...upstream(graph, id), ...downstream(graph, id)])
}

/**
 * Nodes that stay prominent for a domain: the domain's own nodes, and shared-platform nodes
 * that lie on one of their data paths (a shared dimension a mart reads, the warehouse).
 */
export function domainFocus(graph: Graph, domain: string): Set<string> {
  const own = graph.nodes.filter((n) => n.domain === domain).map((n) => n.id)
  const keep = new Set(own)
  for (const id of own)
    for (const n of [...upstream(graph, id), ...downstream(graph, id)]) {
      const node = graph.nodes.find((x) => x.id === n)
      if (node && (node.domain === 'shared' || node.type === 'source'))
        keep.add(n)
    }
  for (const e of graph.edges)
    if (e.type === 'infrastructure' && keep.has(e.source)) keep.add(e.target)
  return keep
}

/** Nodes whose label, id or path contains the query (case-insensitive), best matches first. */
export function search(graph: Graph, query: string, limit = 8): GraphNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const score = (n: GraphNode) =>
    n.label.toLowerCase().startsWith(q)
      ? 0
      : n.label.toLowerCase().includes(q)
        ? 1
        : 2
  return graph.nodes
    .filter((n) =>
      [n.label, n.id, n.path ?? ''].some((s) => s.toLowerCase().includes(q)),
    )
    .sort((a, b) => score(a) - score(b) || a.label.localeCompare(b.label))
    .slice(0, limit)
}

/** Direct neighbours of a node along data-flow edges. */
export function neighbours(graph: Graph, id: string) {
  const up: string[] = []
  const down: string[] = []
  for (const e of graph.edges) {
    if (!FLOW.includes(e.type)) continue
    if (e.target === id) up.push(e.source)
    if (e.source === id) down.push(e.target)
  }
  return { up, down }
}

/** The stages a result passes through, from what the reader sees back to the source. */
export const TRACE_ORDER: NodeType[] = [
  'frontend',
  'delivery',
  'gold',
  'ml',
  'silver',
  'bronze',
  'seed',
  'raw',
  'ingestion',
  'source',
]

/**
 * "Where does this come from?": the node, the products that read it, and everything upstream
 * of it, grouped by stage in reading order (frontend → … → source). Shared infrastructure that
 * is not data (the warehouse, R2) is left out.
 */
export function tracePath(
  graph: Graph,
  id: string,
): { type: NodeType; nodes: GraphNode[] }[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const start = byId.get(id)
  if (!start) return []
  const consumers = [...downstream(graph, id)]
    .map((n) => byId.get(n)!)
    .filter((n) => n.type === 'frontend')
  const nodes = [
    start,
    ...consumers,
    ...[...upstream(graph, id)].map((n) => byId.get(n)!),
  ]
  return TRACE_ORDER.map((type) => ({
    type,
    nodes: nodes
      .filter((n) => n.type === type)
      .sort((a, b) => a.label.localeCompare(b.label)),
  })).filter((g) => g.nodes.length)
}
