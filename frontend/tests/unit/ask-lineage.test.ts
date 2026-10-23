import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lineage, type Graph } from '../../src/ask/lineage.ts'

const graph = JSON.parse(
  readFileSync('frontend/public/data/architecture/graph.json', 'utf-8'),
) as Graph

const ids = (id: string) =>
  lineage(graph, id)?.map((s) => [s.key, s.node?.id ?? null, s.self])

test('a gold model: source and raw upstream, no silver on its path, its published files downstream', () => {
  assert.deepEqual(ids('dbt:fct_election'), [
    ['origin', 'src:scb', false],
    ['raw', 'raw:scb_elections', false],
    ['silver', null, false],
    ['gold', 'dbt:fct_election', true],
    ['published', 'out:parliament/*.json', false],
  ])
})

test('a source: itself as origin, the nearest raw, gold and published files downstream', () => {
  const steps = lineage(graph, 'src:valmyndigheten')!
  assert.deepEqual(steps[0], {
    key: 'origin',
    node: steps[0].node,
    self: true,
  })
  assert.equal(steps[0].node?.id, 'src:valmyndigheten')
  assert.equal(steps[1].node?.layer, 'raw')
  assert.equal(steps[4].node?.layer, 'delivery')
})

test('a fetch script or a bronze model has no step of its own, so no path', () => {
  assert.equal(lineage(graph, 'ingest:elections'), null)
  assert.equal(lineage(graph, 'dbt:stg_scb_elections'), null)
})

test('a node the graph does not hold, or one off the data path, has no lineage', () => {
  assert.equal(lineage(graph, 'dbt:not_a_model'), null)
  assert.equal(lineage(graph, 'infra:catalog'), null)
})

test('a silver model finds its gold model downstream', () => {
  const tiny: Graph = {
    nodes: [
      { id: 's', label: 's', layer: 'source' },
      { id: 'r', label: 'r', layer: 'raw' },
      { id: 'm', label: 'm', layer: 'silver' },
      { id: 'g', label: 'g', layer: 'gold' },
      { id: 'o', label: 'o', layer: 'delivery' },
    ],
    edges: [
      { source: 's', target: 'r', type: 'lineage' },
      { source: 'r', target: 'm', type: 'lineage' },
      { source: 'm', target: 'g', type: 'lineage' },
      { source: 'g', target: 'o', type: 'delivery' },
      { source: 'o', target: 's', type: 'infrastructure' },
    ],
  }
  assert.deepEqual(
    lineage(tiny, 'm')?.map((s) => s.node?.id),
    ['s', 'r', 'm', 'g', 'o'],
  )
})
