import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { freshness, lastRun, SUBJECTS } from '../../src/meaning/freshness.ts'

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

test('a run length is measured only when the status records both ends', () => {
  const run = {
    started_at: '2026-10-22T09:30:44+00:00',
    recorded_at: '2026-10-22T09:34:10+00:00',
    github_run: 'https://github.com/korv9/anton-portfolio/actions/runs/1',
  }
  assert.deepEqual(lastRun(run), { seconds: 206, url: run.github_run })
  assert.equal(lastRun({ recorded_at: run.recorded_at }), undefined)
  assert.equal(lastRun({}), undefined)
})
