import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectClusterPoints } from '../../src/clusters/clusterGeometry.ts'
import { groupBackdropPoints } from '../../src/home/backdropGeometry.ts'

test('cluster projection preserves equal distances and keeps points inside narrow screens', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 },
  ]
  for (const [width, height] of [
    [1440, 900],
    [320, 900],
  ]) {
    const { sx, sy } = projectClusterPoints(points, width, height, 36)
    assert.ok(Math.abs(sx(10) - sx(0) - (sy(0) - sy(10))) < 1e-9)
    for (const p of points) {
      assert.ok(sx(p.x) >= 36 && sx(p.x) <= width - 36)
      assert.ok(sy(p.y) >= 36 && sy(p.y) <= height - 36)
    }
  }
  const collapsed = projectClusterPoints([{ x: 3, y: 3 }], 320, 900)
  assert.equal(collapsed.sx(3), 160)
  assert.equal(collapsed.sy(3), 450)
})

test('backdrop layers retain every point and its UMAP location while cropping empty canvas space', () => {
  const points = [
    { x: 0, y: 0, c: -1 },
    { x: 10, y: 10, c: 4 },
    { x: 9, y: 9, c: 4 },
    { x: 5, y: 1, c: 2 },
  ]
  const layers = groupBackdropPoints(points)
  const projection = projectClusterPoints(points, 1000, 1000, 48)
  assert.equal(layers.flatMap((layer) => layer.points).length, points.length)
  for (const original of points) {
    const layer = layers.find((layer) => layer.cluster === original.c)!
    const point = layer.points.find(
      (p) =>
        p.x === projection.sx(original.x) && p.y === projection.sy(original.y),
    )!
    assert.ok(point)
    assert.ok(point.x > layer.left && point.x < layer.left + layer.width)
    assert.ok(point.y > layer.top && point.y < layer.top + layer.height)
    assert.ok(layer.width > 0 && layer.height > 0)
  }
  assert.deepEqual(groupBackdropPoints([]), [])
})
