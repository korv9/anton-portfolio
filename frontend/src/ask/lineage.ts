/**
 * The five-step path of a node through architecture/graph.json: where its data comes from, the raw
 * store, silver, gold and the published file. Each step is the nearest node of that layer along
 * lineage and delivery edges, upstream for a layer before the node's own and downstream for one
 * after it; the node fills its own layer. A step the path does not pass through is null. From a
 * source or a fetch script the downstream steps are one path of several, the nearest.
 */
export type GraphNode = {
  id: string
  label: string
  layer: string
  path?: string
}
export type Graph = {
  nodes: GraphNode[]
  edges: { source: string; target: string; type: string }[]
}
export type Step = { key: StepKey; node: GraphNode | null; self: boolean }
export type StepKey = 'origin' | 'raw' | 'silver' | 'gold' | 'published'

const STEPS: [StepKey, string][] = [
  ['origin', 'source'],
  ['raw', 'raw'],
  ['silver', 'silver'],
  ['gold', 'gold'],
  ['published', 'delivery'],
]
// The graph's own layer order (graph.json `layers`).
const LAYERS = [
  'source',
  'ingestion',
  'raw',
  'bronze',
  'silver',
  'ml',
  'gold',
  'delivery',
]
const FLOW = new Set(['lineage', 'delivery'])

/** Nodes in breadth-first order from `start`, nearest first, following edges one way. */
function walk(graph: Graph, start: string, way: 'up' | 'down') {
  const next = new Map<string, string[]>()
  for (const e of graph.edges) {
    if (!FLOW.has(e.type)) continue
    const [from, to] =
      way === 'up' ? [e.target, e.source] : [e.source, e.target]
    next.set(from, [...(next.get(from) ?? []), to])
  }
  const seen = new Set([start])
  const order: string[] = []
  for (let queue = [start]; queue.length;) {
    const id = queue.shift()!
    for (const n of next.get(id) ?? [])
      if (!seen.has(n)) {
        seen.add(n)
        order.push(n)
        queue.push(n)
      }
  }
  return order
}

/** The five steps for a node id, or null when the graph does not hold it or it is not on the data path. */
export function lineage(graph: Graph, id: string): Step[] | null {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const start = byId.get(id)
  const at = LAYERS.indexOf(start?.layer ?? '')
  // A node outside the five steps (a fetch script, bronze, ML) would draw no step of its own.
  if (!start || at < 0 || !STEPS.some(([, layer]) => layer === start.layer))
    return null
  const order = { up: walk(graph, id, 'up'), down: walk(graph, id, 'down') }
  return STEPS.map(([key, layer]) => {
    if (start.layer === layer) return { key, node: start, self: true }
    const way = LAYERS.indexOf(layer) < at ? 'up' : 'down'
    const found = order[way]
      .map((n) => byId.get(n))
      .find((n) => n?.layer === layer)
    return { key, node: found ?? null, self: false }
  })
}
