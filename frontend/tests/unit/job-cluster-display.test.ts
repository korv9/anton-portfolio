import test from 'node:test'
import assert from 'node:assert/strict'
import { largeJobClusters } from '../../src/home/jobClusterDisplay.ts'

test('keeps large connected islands and removes noise and small isolated groups', () => {
  const main = Array.from({ length: 300 }, (_, i) => ({
    x: (i % 20) * 0.1,
    y: Math.floor(i / 20) * 0.1,
    c: 2,
  }))
  const small = Array.from({ length: 40 }, (_, i) => ({
    x: 20 + (i % 10) * 0.1,
    y: Math.floor(i / 10) * 0.1,
    c: 2,
  }))
  const noise = main.map((p) => ({ ...p, c: -1 }))
  const displayed = largeJobClusters([...main, ...small, ...noise])
  assert.equal(displayed.length, main.length)
  assert.deepEqual(new Set(displayed), new Set(main))
  assert.deepEqual(largeJobClusters([]), [])
})
