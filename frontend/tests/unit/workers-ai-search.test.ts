/**
 * The browser search behind the Workers AI demos: PCA projection, int8 kNN and placement on the
 * map.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { knn, place, project, type Pca } from '../../src/workersAi/search.ts'

const pca: Pca = {
  model: 'test',
  dims_in: 3,
  dims: 2,
  mean: [1, 1, 1],
  components: [
    [1, 0, 0],
    [0, 0, 1],
  ],
  scale: [0.01, 0.02],
}

test('project centres, projects and L2-normalises', () => {
  const v = project([4, 9, 5], pca)
  assert.deepEqual(
    [...v].map((n) => +n.toFixed(6)),
    [0.6, 0.8],
  )
  assert.deepEqual([...project([1, 1, 1], pca)], [0, 0])
})

test('int8 kNN ranks by dequantised cosine and keeps k', () => {
  // Rows dequantise to (0.6, 0.8), (1, 0), (-1, 0) and (0.6, 0.78).
  const vectors = Int8Array.from([60, 40, 100, 0, -100, 0, 60, 39])
  const hits = knn(Float32Array.from([0.6, 0.8]), vectors, pca.scale, 3)
  assert.deepEqual(
    hits.map((h) => h.index),
    [0, 3, 1],
  )
  assert.ok(Math.abs(hits[0].score - 1) < 1e-6)
  assert.equal(knn(Float32Array.from([1, 0]), vectors, pca.scale, 10).length, 4)
})

test('place weights positions by closeness and takes the majority cluster', () => {
  const near = { score: 0.9, x: 0, y: 0, cluster: 2 }
  const far = { score: 0.5, x: 10, y: 10, cluster: 5 }
  const p = place([near, near, far])
  // Weights 10, 10 and 2: the point sits close to the near pair.
  assert.ok(Math.abs(p.x - 20 / 22) < 1e-9)
  assert.equal(p.cluster, 2)
  const noise = { ...near, cluster: -1 }
  assert.equal(place([noise, noise, far]).cluster, -1)
  // A tie in count goes to the closer group.
  assert.equal(place([near, far]).cluster, 2)
})
