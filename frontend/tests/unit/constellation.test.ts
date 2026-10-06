/**
 * The Data Constellation (architecture/graph.json from platform/architecture/build_graph.py):
 * ids are unique, every edge has both ends, the layout keeps stages left to right and
 * domains in their lanes, and lineage from a product reaches its sources.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  domainFocus,
  layout,
  lineageOf,
  nodesFor,
  search,
  upstream,
  type Graph,
} from '../../src/constellation/graph.ts'

const graph: Graph = JSON.parse(
  readFileSync(
    new URL('../../public/data/architecture/graph.json', import.meta.url),
    'utf8',
  ),
)
const byId = new Map(graph.nodes.map((n) => [n.id, n]))

test('node ids are unique and every edge has both ends', () => {
  assert.equal(byId.size, graph.nodes.length)
  for (const e of graph.edges) {
    assert.ok(byId.has(e.source), `missing ${e.source}`)
    assert.ok(byId.has(e.target), `missing ${e.target}`)
  }
})

test('the layout keeps stages in order from left to right', () => {
  const placed = layout(graph, 'platform')
  const meanX = (layer: string) => {
    const xs = [...placed.values()]
      .filter((n) => n.layer === layer)
      .map((n) => n.x)
    return xs.reduce((a, b) => a + b, 0) / xs.length
  }
  const order = graph.layers.filter((l) =>
    graph.nodes.some((n) => n.layer === l),
  )
  for (let i = 1; i < order.length; i++)
    assert.ok(
      meanX(order[i - 1]) < meanX(order[i]),
      `${order[i - 1]} < ${order[i]}`,
    )
  for (const n of placed.values()) {
    assert.ok(n.x > 0 && n.x < 1 && n.y > 0 && n.y < 1, n.id)
  }
})

test('each domain keeps to its own lane', () => {
  const placed = layout(graph, 'platform')
  const lanes = [...graph.domains].sort((a, b) => a.lane - b.lane)
  const h = 1 / lanes.length
  for (const n of placed.values()) {
    const lane = lanes.findIndex((d) => d.id === n.domain)
    assert.ok(n.y >= lane * h && n.y <= (lane + 1) * h, n.id)
  }
})

test('the layout is deterministic', () => {
  const a = layout(graph, 'platform').get('dbt:mart_symbol_atlas')
  const b = layout(graph, 'platform').get('dbt:mart_symbol_atlas')
  assert.deepEqual(a, b)
})

test('Symbolic Atlas traces back to Project Gutenberg through the warehouse', () => {
  const up = upstream(graph, 'app:symbolic')
  for (const id of [
    'src:gutenberg',
    'ingest:symbolic',
    'raw:symbolic',
    'dbt:stg_symbolic_documents',
    'dbt:int_symbol_occurrences',
    'dbt:mart_symbol_atlas',
    'out:symbolic/v4/atlas.parquet',
  ])
    assert.ok(up.has(id), id)
})

test('a gold mart shows what feeds it and what it feeds', () => {
  const path = lineageOf(graph, 'dbt:mart_symbol_atlas')
  assert.ok(path.has('dbt:int_symbol_occurrences'))
  assert.ok(path.has('app:symbolic'))
  assert.ok(!path.has('app:politics'))
})

test('the data-model view holds tables and seeds only', () => {
  const kinds = new Set(nodesFor(graph, 'model').map((n) => n.type))
  assert.deepEqual([...kinds].sort(), ['gold', 'seed'])
})

test('a domain focus keeps its own nodes and the shared ones on its path', () => {
  const focus = domainFocus(graph, 'politics')
  assert.ok(focus.has('app:politics') && focus.has('src:riksdagen'))
  assert.ok(!focus.has('app:symbolic'))
})

test('search finds the symbol models and files', () => {
  const found = search(graph, 'symbol', 20).map((n) => n.id)
  assert.ok(found.includes('dbt:int_symbol_occurrences'))
  assert.ok(found.includes('dbt:mart_symbol_atlas'))
})
