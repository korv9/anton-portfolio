/**
 * The issue-debate measures on hand-made figures: shares, the comparison with the other
 * parties, change between periods, and distinctive terms.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  commonTerms,
  compareWithOthers,
  distinctiveTerms,
  othersTerms,
  sessionsIn,
  shares,
  topicChange,
  topicSeries,
  topicWeights,
  type SessionTerms,
  type SessionTopics,
} from '../../src/politik/analytics/issues.ts'

const t = (
  session: string,
  mp: Record<string, number>,
  s: Record<string, number>,
): SessionTopics => ({
  session,
  debates: 10,
  parties: {
    MP: {
      debates: 4,
      utterances: Object.values(mp).reduce((a, b) => a + b, 0),
      topics: mp,
    },
    S: {
      debates: 9,
      utterances: Object.values(s).reduce((a, b) => a + b, 0),
      topics: s,
    },
  },
})
const rows = [
  t('2022/23', { miljo: 30, ekonomi: 10 }, { miljo: 10, ekonomi: 30 }),
  t('2023/24', { miljo: 20, ekonomi: 20 }, { miljo: 10, ekonomi: 30 }),
]

test('shares and weights', () => {
  assert.deepEqual(shares({ a: 3, b: 1 }), [
    { key: 'a', pct: 75 },
    { key: 'b', pct: 25 },
  ])
  const w = topicWeights(rows, 'MP')
  assert.equal(w.utterances, 80)
  assert.equal(w.debates, 8)
  assert.equal(topicWeights(rows, null).debates, 20)
  assert.equal(sessionsIn(rows, 2023, 2023).length, 1)
})

test('the party against the other parties', () => {
  const c = compareWithOthers(rows, 'MP')
  const miljo = c.find((x) => x.key === 'miljo')!
  assert.equal(miljo.own, 62.5) // 50 of 80
  assert.equal(miljo.others, 25) // 20 of 80
  assert.equal(miljo.diff, 37.5)
  assert.equal(miljo.ratio, 2.5)
  assert.equal(c[0].key, 'miljo')
})

test('change between periods and the series', () => {
  const ch = topicChange([rows[0]], [rows[1]], 'MP')
  assert.equal(ch.find((x) => x.key === 'ekonomi')!.change, 25) // 25 % → 50 %
  const s = topicSeries(rows, 'MP', ['miljo'])
  assert.deepEqual(
    s.map((x) => x.shares.miljo),
    [75, 50],
  )
})

test('distinctive terms favour what the party uses relatively more', () => {
  const terms: SessionTerms[] = [
    {
      session: '2025/26',
      parties: {
        MP: { words: 10_000, stems: { klimat: 80, skatt: 20 } },
        S: { words: 30_000, stems: { klimat: 30, skatt: 300 } },
      },
      total: { words: 40_000, stems: { klimat: 110, skatt: 320 } },
    },
  ]
  const others = othersTerms(terms, 'MP')
  assert.equal(others.words, 30_000)
  assert.equal(others.stems.klimat, 30)
  const d = distinctiveTerms(terms[0].parties.MP, others)
  assert.equal(d[0].stem, 'klimat')
  assert.ok(!d.some((x) => x.stem === 'skatt')) // used relatively less by MP
  assert.equal(d[0].per10k, 80)
  assert.equal(commonTerms(terms[0].parties.MP)[0].stem, 'klimat')
})
