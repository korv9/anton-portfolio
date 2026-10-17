import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregatePairs,
  aggregateCohesion,
  inContext,
  CONTEXT_DEFAULTS,
  workspaceHref,
} from '../../src/politik/workspace/logic.ts'
import { splitOnBreak } from '../../src/charts/scales.ts'
import type { Cohesion } from '../../src/politik/workspace/data.ts'

const pair = {
  session: '2024/25',
  government_key: null,
  issue_key: null,
  party_a: 'S',
  party_b: 'M',
}
test('similarity pools comparable counts, excludes zero denominators and canonicalizes pairs', () => {
  const rows = aggregatePairs([
    { ...pair, same: 1, compared: 2 },
    {
      ...pair,
      session: '2025/26',
      party_a: 'M',
      party_b: 'S',
      same: 9,
      compared: 10,
    },
    { ...pair, party_a: 'V', same: 0, compared: 0 },
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].pct, (100 * 10) / 12)
  assert.equal(rows[1].pct, null)
})
test('cohesion preserves independent member and roll-call denominators', () => {
  const row: Cohesion = {
    ...pair,
    party: 'S',
    roll_calls: 1,
    eligible: 10,
    present: 8,
    abstain_votes: 1,
    comparable_cast: 8,
    aligned_cast: 7,
    mixed_roll_calls: 1,
    pm_compared: 1,
    pm_same: 0,
  }
  const [sum] = aggregateCohesion([
    row,
    {
      ...row,
      eligible: 12,
      present: 10,
      comparable_cast: 10,
      aligned_cast: 10,
      pm_same: 1,
    },
  ])
  assert.equal(sum.eligible, 22)
  assert.equal(sum.aligned_cast, 17)
  assert.equal(sum.pm_compared, 2)
  assert.equal(sum.pm_same, 1)
})
test('context does not match missing issues or governments and treats years as session starts', () => {
  assert.ok(inContext({ ...pair }, CONTEXT_DEFAULTS))
  assert.ok(
    !inContext({ ...pair }, { ...CONTEXT_DEFAULTS, omrade: 'education' }),
  )
  assert.ok(
    !inContext({ ...pair }, { ...CONTEXT_DEFAULTS, regering: 'kristersson' }),
  )
  assert.ok(!inContext({ ...pair }, { ...CONTEXT_DEFAULTS, fran: '2025' }))
  assert.ok(
    !inContext({ ...pair }, { ...CONTEXT_DEFAULTS, riksmote: '2025/26' }),
  )
})
test('cross-dataset URLs retain context, remove local state and support explicit resets', () => {
  const url = workspaceHref(
    '#politik-tal',
    new URLSearchParams(
      'partier=S,M&omrade=education&rost=private&statsrost=2022&fran=2024',
    ),
    { riksmote: '2024/25', omrade: '' },
  )
  const params = new URLSearchParams(url.split('?')[1])
  assert.equal(params.get('partier'), 'S,M')
  assert.equal(params.get('riksmote'), '2024/25')
  assert.equal(params.get('fran'), '2024')
  assert.ok(
    !params.has('rost') && !params.has('statsrost') && !params.has('omrade'),
  )
})
test('missing scheduled observations produce separate line segments without losing markers', () => {
  const points = [
    { value: 1 },
    { value: 2, breakBefore: true },
    { value: 3 },
    { value: 4, breakBefore: true },
  ]
  assert.deepEqual(splitOnBreak(points), [
    [points[0]],
    [points[1], points[2]],
    [points[3]],
  ])
  assert.deepEqual(splitOnBreak([]), [])
})
