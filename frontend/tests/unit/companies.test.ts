import test from 'node:test'
import assert from 'node:assert/strict'
import { fixtureCompanies } from '../fixtures/companies.ts'
import {
  hiringDaily,
  parseCompanyData,
  relatedJobs,
} from '../../src/companies/model.ts'

test('verified company links reconcile and duplicate ads do not enter', () => {
  const d = fixtureCompanies()
  assert.ok(parseCompanyData(d))
  assert.equal(relatedJobs(d, d.companies[0].company_id).length, 2)
  assert.equal(hiringDaily(d, d.companies[0].company_id)[0].ads, 2)
  d.jobs.push(d.jobs[0])
  assert.throws(() => parseCompanyData(d), /Duplicate/)
})
test('ambiguous or dangling company links fail closed', () => {
  const d = fixtureCompanies()
  d.links[2].company_id = d.companies[0].company_id
  assert.throws(() => parseCompanyData(d), /Unverified/)
  const a = fixtureCompanies()
  a.links[0].company_id = 'absent'
  assert.throws(() => parseCompanyData(a), /lacks evidence|contradicts/)
})
test('unsafe sources, wrong hashes and expired snapshots fail closed', () => {
  const d = fixtureCompanies()
  d.jobs[0].source_url = 'javascript:alert(1)'
  assert.throws(() => parseCompanyData(d), /source/)
  const h = fixtureCompanies()
  h.links[0].job_payload_hash = 'd'.repeat(64)
  assert.throws(() => parseCompanyData(h), /relationship/)
  const e = fixtureCompanies()
  e.generated_at = new Date(Date.now() - 2 * 86400000).toISOString()
  e.valid_until = new Date(Date.now() - 86400000).toISOString()
  assert.throws(() => parseCompanyData(e), /expired/)
})
test('absent finance and compliance remain unassessed, groups do not transfer jobs', () => {
  const d = fixtureCompanies()
  assert.equal(d.context.length, 0)
  assert.equal(d.metrics.companies_with_reviewed_compliance_coverage, null)
  const parent = {
    ...d.companies[0],
    company_id: 'se:orgnr:9990000011',
    organization_number: '9990000011',
    registered_legal_name: 'Synthetic parent AB',
  }
  d.companies.push(parent)
  d.relationships.push({
    company_id: d.companies[0].company_id,
    related_company_id: parent.company_id,
    relationship_type: 'subsidiary_of',
    valid_from: '2020-01-01',
    valid_to: null,
    source_url: 'https://example.invalid/ownership',
    document_hash: 'e'.repeat(64),
  })
  assert.ok(parseCompanyData(d))
  assert.equal(relatedJobs(d, parent.company_id).length, 0)
})
