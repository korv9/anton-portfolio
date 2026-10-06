/**
 * Job ads and the AI governance timeline: yearly shares are sums, not averages; every published
 * series keeps numerator ≤ denominator; the job-ad dictionary is published verbatim with the
 * archives it was counted on; examples are masked.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { yearlyFromMonths } from '../../src/aiact/logic.ts'

const read = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../public/data/ai-act/${name}`, import.meta.url),
      'utf8',
    ),
  )

test('yearly shares are sums over the year, not averages of months', () => {
  const y = yearlyFromMonths([
    { month: '2024-01', numerator: 1, denominator: 10 },
    { month: '2024-02', numerator: 9, denominator: 90 },
    { month: '2025-01', numerator: 0, denominator: 5 },
  ])
  assert.deepEqual(
    y.map((r) => [r.year, r.numerator, r.denominator, r.share]),
    [
      ['2024', 10, 100, 0.1],
      ['2025', 0, 5, 0],
    ],
  )
})

test('every timeline series stays within its denominator and has its source model', () => {
  const signals = read('signals.json')
  assert.ok(signals.series.length >= 4)
  assert.match(signals.caveat_en, /does not prove causation/)
  for (const s of signals.series) {
    assert.ok(s.source_model.startsWith('mart_'))
    let previous = ''
    for (const [month, n, d, share] of s.rows) {
      assert.match(month, /^\d{4}-\d{2}$/)
      assert.ok(month > previous, `${s.series_id} months ascend`)
      previous = month
      assert.ok(n >= 0 && n <= d, `${s.series_id} ${month}`)
      assert.ok(share >= 0 && share <= 1)
    }
  }
})

test('the job-ad dictionary and archives are published, and examples are masked', () => {
  const summary = read('jobs/summary.json')
  assert.ok(summary.terms.length >= 10)
  for (const t of summary.terms) assert.ok(t.pattern.length > 0)
  for (const a of summary.archives) {
    assert.match(a.sha256, /^[0-9a-f]{64}$/)
    assert.match(a.source_url, /^https:\/\/data\.arbetsformedlingen\.se\//)
  }
  assert.equal(
    new Set(
      summary.archives.map(
        (a: { dictionary_sha256: string }) => a.dictionary_sha256,
      ),
    ).size,
    1,
  )
  const examples = read('jobs/examples.json')
  for (const e of examples) {
    assert.doesNotMatch(e.context, /[\w.+-]+@[\w-]+\.[\w.]+/)
    assert.doesNotMatch(e.context, /\b0\d{1,3}[- ]?\d{5,8}\b/)
  }
})
