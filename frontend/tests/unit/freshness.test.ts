import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { freshness, SUBJECTS } from '../../src/meaning/freshness.ts'

const NOW = Date.parse('2026-10-22T12:00:00Z')

test('a subject is fresh within its SLA, stale past it and unknown without status', () => {
  const ok = { outcome: 'success', recorded_at: '2026-10-22T09:00:00Z' }
  assert.equal(freshness({ market: ok }, 'jobs', NOW), true)
  const old = { outcome: 'success', recorded_at: '2026-10-20T09:00:00Z' }
  assert.equal(freshness({ market: old }, 'jobs', NOW), false)
  // A failed run counts from the last success it carries.
  const failed = {
    outcome: 'failure',
    recorded_at: '2026-10-22T09:00:00Z',
    last_success_at: '2026-10-10T09:00:00Z',
  }
  assert.equal(freshness({ market: failed }, 'jobs', NOW), false)
  assert.equal(
    freshness({ market: { outcome: 'failure' } }, 'jobs', NOW),
    false,
  )
  assert.equal(freshness(null, 'jobs', NOW), undefined)
  assert.equal(freshness({}, 'jobs', NOW), undefined)
  assert.equal(freshness({ market: ok }, 'ml', NOW), undefined)
})

test('the SLA per subject matches platform/pipeline.yml', () => {
  const spec = readFileSync('platform/pipeline.yml', 'utf8')
  for (const [subject, hours] of Object.values(SUBJECTS)) {
    const m = spec.match(
      new RegExp(
        `\\n  ${subject}:\\n(?:    .*\\n)*?    sla: \\{fresh_within: (\\d+)([hd])\\}`,
      ),
    )
    assert.ok(m, `${subject} has no fresh_within`)
    assert.equal(Number(m[1]) * (m[2] === 'd' ? 24 : 1), hours, subject)
  }
})
