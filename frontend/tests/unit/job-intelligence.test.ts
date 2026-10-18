import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureCompanies } from '../fixtures/companies.ts'
import { fixtureWorkspace } from '../fixtures/job-intelligence.ts'
import {
  cvMatch,
  filterJobs,
  jobInstant,
  latestJobs,
  parseWorkspace,
} from '../../src/job-intelligence/model.ts'

test('latest 50 use publication instant and stable ID, excluding expiry', () => {
  const d = fixtureCompanies()
  d.jobs = Array.from({ length: 60 }, (_, i) => ({
    ...d.jobs[0],
    job_id: String(i).padStart(3, '0'),
  })).reverse()
  d.jobs[0].application_deadline = '2000-01-01'
  assert.equal(latestJobs(d).length, 50)
  assert.equal(latestJobs(d)[0].job_id, '000')
  assert.equal(latestJobs(d)[49].job_id, '049')
  assert.equal(
    jobInstant('2026-10-17T14:00:00'),
    Date.parse('2026-10-17T12:00:00Z'),
  )
  assert.equal(
    jobInstant('2026-01-17T14:00:00'),
    Date.parse('2026-01-17T13:00:00Z'),
  )
})
test('filters combine without changing the selected job parameter', () => {
  const d = fixtureCompanies(),
    p = new URLSearchParams({
      job: '0',
      q: 'developer',
      skill: 'Python',
      company: d.companies[0].company_id,
    })
  assert.equal(filterJobs(d.jobs, d, p).length, 2)
  p.set('location', 'elsewhere')
  assert.equal(filterJobs(d.jobs, d, p).length, 0)
  assert.equal(p.get('job'), '0')
})
test('full text is hash-bound and requirement quotes are checked', () => {
  const d = fixtureCompanies(),
    w = fixtureWorkspace(d)
  assert.equal(
    parseWorkspace(w, d).jobs[0].description_text,
    w.jobs[0].description_text,
  )
  const bad = structuredClone(w)
  bad.jobs[0].document_hash = 'd'.repeat(64)
  assert.throws(() => parseWorkspace(bad, d), /source/)
  const quote = structuredClone(w)
  quote.jobs[0].analysis.requirements[0].quote = 'invented'
  assert.throws(() => parseWorkspace(quote, d), /evidence/)
  const separators = structuredClone(w)
  separators.jobs[0].description_text =
    separators.jobs[0].description_text.replaceAll('\n', '\r')
  assert.doesNotThrow(() => parseWorkspace(separators, d))
})
test('stale, mixed and unsafe fulltext releases are held', () => {
  const d = fixtureCompanies(),
    w = fixtureWorkspace(d)
  for (const mutate of [
    () => {
      w.valid_until = '2000-01-01'
    },
    () => {
      w.registry_hash = 'f'.repeat(64)
    },
    () => {
      w.jobs[0].application_url = 'javascript:alert(1)'
    },
  ]) {
    const fresh = fixtureWorkspace(d)
    mutate()
    assert.throws(() => parseWorkspace(w, d))
    Object.assign(w, fresh)
  }
})
test('CV capability performs no processing and fabricates no score', () => {
  assert.equal(cvMatch.state, 'disabled')
  assert.equal(cvMatch.processing, 'none')
  assert.equal('score' in cvMatch, false)
})
