/**
 * The concept layer: layout and helpers, and the published files' guarantees (every passage has
 * provenance, relation types are the declared ones, profiles cover every concept × corpus,
 * cross-corpus pairs are above their baseline, no vector is published).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  conceptFromPath,
  corpusPositions,
  profileOf,
  prominent,
  radialLayout,
  relationsOf,
} from '../../src/concepts/logic.ts'

const read = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../public/data/concepts/${name}`, import.meta.url),
      'utf8',
    ),
  )
const summary = read('summary.json')
const profiles = read('profiles.json')
const relations = read('relations.json')
const passages = read('passages.json')
const pairs = read('pairs.json')

test('concept addresses', () => {
  assert.equal(conceptFromPath('#concept-autonomy'), 'autonomy')
  assert.equal(conceptFromPath('#concept-constellation'), null)
  assert.equal(conceptFromPath('#concepts-profiles'), null)
  assert.equal(conceptFromPath('#philosophy-atlas'), null)
})

test('the radial layout puts every concept on the circle, grouped by family', () => {
  const placed = radialLayout(summary.concepts, 38)
  assert.equal(placed.length, summary.concepts.length)
  for (const p of placed)
    assert.ok(Math.abs(Math.hypot(p.x - 50, p.y - 50) - 38) < 1e-9)
  const families = placed.map((p) => p.family)
  const runs = families.filter((f, i) => i === 0 || f !== families[i - 1])
  assert.equal(runs.length, new Set(families).size, 'each family is contiguous')
  const corpora = corpusPositions(['myth', 'philosophy', 'politics', 'law'])
  assert.equal(Object.keys(corpora).length, 4)
})

test('profiles cover every concept × corpus, in chain order', () => {
  assert.equal(
    profiles.length,
    summary.concepts.length * summary.corpora.length,
  )
  const p = profileOf(profiles, 'risk')
  assert.deepEqual(
    p.map((x) => x.corpus_id),
    ['myth', 'philosophy', 'politics', 'law'],
  )
  for (const x of profiles) {
    assert.ok(x.rank1_share >= 0 && x.rank1_share <= 1)
    assert.ok(x.top3_share >= x.rank1_share)
  }
  assert.ok(prominent(profiles, 2).every((x) => x.rank1_lift >= 2))
})

test('relations have declared types and touch known concepts', () => {
  const ids = new Set(
    summary.concepts.map((c: { concept_id: string }) => c.concept_id),
  )
  const declared = new Set(
    summary.relation_types.map((r: { id: string }) => r.id),
  )
  for (const r of relations.concepts) {
    assert.ok(ids.has(r.concept_a) && ids.has(r.concept_b))
    assert.ok(declared.has(r.relation_type))
  }
  for (const r of relations.corpora) assert.ok(declared.has(r.relation_type))
  assert.ok(
    relationsOf(relations.concepts, 'freedom').some(
      (r) => r.other === 'control',
    ),
  )
})

test('every published passage carries its provenance', () => {
  let n = 0
  for (const byCorpus of Object.values(passages) as Record<string, unknown[]>[])
    for (const list of Object.values(byCorpus))
      for (const p of list as Record<string, string>[]) {
        n++
        for (const key of [
          'source_url',
          'source_version',
          'retrieved_at',
          'location',
          'text',
        ])
          assert.ok(p[key], `${p.chunk_id} lacks ${key}`)
        assert.match(p.source_url, /^https:\/\//)
      }
  assert.ok(n > 100)
})

test('cross-corpus pairs are above their random baseline, and no vector is published', () => {
  assert.ok(pairs.length > 0)
  for (const p of pairs) assert.ok(p.similarity > p.baseline_p95)
  const all = JSON.stringify([summary, profiles, relations, passages, pairs])
  assert.ok(!/"embedding"|"vector"/.test(all))
})
