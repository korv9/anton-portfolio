import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compactClusters } from '../../src/home/backdropGeometry.ts'
import type { Xyc } from '../../src/clusters/clusterGeometry.ts'

test('the start-page maps keep compact, small clusters, thinned, without noise', () => {
  const ring = (c: number, n: number, cx: number, r: number): Xyc[] =>
    Array.from({ length: n }, (_, i) => [
      cx + r * Math.cos(i),
      r * Math.sin(i),
      c,
    ])
  const points = [
    ...ring(-1, 200, 0, 50), // noise
    ...ring(0, 300, 0, 1), // a blob: 30 % of the points
    ...Array.from({ length: 20 }, (_, c) =>
      ring(c + 1, 25, c * 10, 1 + c),
    ).flat(),
  ]
  const kept = compactClusters(points, { max: 16, maxShare: 0.12, cap: 20 })
  const clusters = new Set(kept.map((p) => p[2]))
  assert.ok(!clusters.has(-1) && !clusters.has(0))
  assert.equal(clusters.size, 16)
  // The loosest clusters (largest radius) are the ones left out.
  assert.ok(!clusters.has(20) && clusters.has(1))
  assert.equal(kept.filter((p) => p[2] === 1).length, 20)
})
