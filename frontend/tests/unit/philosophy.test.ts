/**
 * The Philosophy Atlas's published files: balanced sample, every point's work and cluster exist,
 * no generated labels, evaluation present for both maps, tensions complete.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../public/data/philosophy/${name}`, import.meta.url),
      'utf8',
    ),
  )
const summary = read('summary.json')
const atlas = read('atlas.json')
const clusters = read('clusters.json')
const tensions = read('tensions.json')

test('both maps hold the same balanced sample', () => {
  for (const variant of ['baseline', 'author_centered']) {
    const points = atlas[variant] as [string, number, number, number, number][]
    assert.equal(points.length, summary.run.passages_sampled)
    const perWork = new Map<number, number>()
    for (const p of points) perWork.set(p[1], (perWork.get(p[1]) ?? 0) + 1)
    for (const n of perWork.values()) assert.ok(n <= summary.run.per_document)
    assert.equal(perWork.size, summary.works.length)
  }
})

test('clusters on the map exist in the cluster list, and none has a generated label', () => {
  for (const variant of ['baseline', 'author_centered']) {
    const ids = new Set(
      clusters
        .filter((c: { variant: string }) => c.variant === variant)
        .map((c: { cluster_id: number }) => c.cluster_id),
    )
    for (const p of atlas[variant]) if (p[4] >= 0) assert.ok(ids.has(p[4]))
  }
  for (const c of clusters)
    if (c.review_status === 'unreviewed') assert.equal(c.review_label, null)
})

test('centring per work reduces how much neighbours share a work', () => {
  const e = summary.run.evaluation
  assert.ok(
    e.author_centered.same_work_neighbours < e.baseline.same_work_neighbours,
  )
  assert.ok(e.baseline.same_work_neighbours > e.baseline.same_work_chance)
})

test('every tension has a distribution for every work', () => {
  for (const t of summary.tensions) {
    const rows = tensions.distribution.filter(
      (d: { tension_id: string }) => d.tension_id === t.tension_id,
    )
    assert.equal(rows.length, summary.works.length, t.tension_id)
  }
})

test('every translated work names its translator or says why not', () => {
  for (const w of summary.works)
    if (w.original_language !== 'en')
      assert.ok(w.translator || w.translator_note, w.document_id)
})
