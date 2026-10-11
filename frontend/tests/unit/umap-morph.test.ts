import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  INTRO_HOLD,
  INTRO_MORPH,
  morphPosition,
  morphStageAt,
  prepareMorphFrame,
} from '../../src/home/umapMorph.ts'

test('UMAP morphs land exactly on the source and destination, with curved intermediate motion', () => {
  const a = { x: 25, y: 40, c: 1 }
  const b = { x: 200, y: 100, c: 3 }
  assert.deepEqual(morphPosition(a, b, 0, 0), { x: a.x, y: a.y, blend: 0 })
  const end = morphPosition(a, b, 1, 0)
  assert.ok(Math.abs(end.x - b.x) < 1e-9 && Math.abs(end.y - b.y) < 1e-9)
  assert.equal(end.blend, 1)
  const middle = morphPosition(a, b, 0.5, 0)
  assert.notEqual(middle.x, (a.x + b.x) / 2)
  assert.equal(middle.blend, 0.5)
})

test('the intro visits every map and finishes on the last without looping', () => {
  assert.ok(3 * (INTRO_HOLD + INTRO_MORPH) + INTRO_HOLD < 1000)
  for (let scene = 0; scene < 4; scene++) {
    const stage = morphStageAt(scene * (INTRO_HOLD + INTRO_MORPH), 4)
    assert.equal(stage.from, scene)
    assert.equal(stage.to, scene)
    assert.equal(stage.done, false)
  }
  const final = morphStageAt(3 * (INTRO_HOLD + INTRO_MORPH) + INTRO_HOLD, 4)
  assert.equal(final.from, 3)
  assert.equal(final.to, 3)
  assert.equal(final.done, true)
  assert.equal(morphStageAt(100000, 4).from, 3)
  const frames = prepareMorphFrame(
    [
      { x: 1, y: 2, c: 5 },
      { x: 3, y: 4, c: -1 },
    ],
    10,
  )
  assert.equal(frames.length, 10)
  assert.ok(
    frames.every(
      (p) =>
        Number.isFinite(p.x) && Number.isFinite(p.y) && [5, -1].includes(p.c),
    ),
  )
})
