import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureProfile } from '../fixtures/job-profile.ts'
import { fixtureCompanies } from '../fixtures/companies.ts'
import { fixtureWorkspace } from '../fixtures/job-intelligence.ts'
import { parseProfile } from '../../src/job-intelligence/profile.ts'
import { rankJob, rankCandidates } from '../../src/job-intelligence/ranking.ts'
import { localProfileAllowed } from '../../jobProfilePlugin.ts'

test('junior data jobs outrank senior hard requirements without fabricated professional years', () => {
  const data = fixtureCompanies(),
    detail = fixtureWorkspace(data).jobs[0],
    profile = fixtureProfile()
  const junior = {
    ...data.jobs[0],
    title: 'Junior Data Engineer',
    location: 'Stockholm',
  }
  const senior = { ...junior, job_id: 'senior', title: 'Senior Data Engineer' }
  const hard = {
    ...detail,
    job_id: 'senior',
    analysis: {
      ...detail.analysis,
      requirements: [
        ...detail.analysis.requirements,
        {
          label: '5 years',
          category: 'experience',
          strength: 'required' as const,
          source_field: 'description',
          line: 1,
          quote: 'Minst 5 års erfarenhet krävs.',
        },
      ],
    },
  }
  const good = rankJob(junior, detail, profile),
    bad = rankJob(senior, hard, profile)
  assert.ok(good.score > bad.score && good.suitable && !bad.suitable)
  assert.ok(
    bad.blockers.some((b) => b.reason.includes('Internships and projects')),
  )
  assert.equal(profile.facts.professional_years, null)
  assert.equal(good.requirements[0].evidence?.source_ref, 'Synthetic CV page 1')
})
test('missing skill evidence remains unknown, partial evidence counts half, optional mentions do not become blockers', () => {
  const data = fixtureCompanies(),
    detail = fixtureWorkspace(data).jobs[0],
    profile = fixtureProfile()
  detail.analysis.requirements.push(
    {
      label: 'Azure',
      category: 'cloud',
      strength: 'required',
      source_field: 'description',
      line: 1,
      quote: 'Azure krävs.',
    },
    {
      label: 'Scala',
      category: 'language',
      strength: 'required',
      source_field: 'description',
      line: 1,
      quote: 'Scala krävs.',
    },
    {
      label: 'Rust',
      category: 'language',
      strength: 'ambiguous',
      source_field: 'description',
      line: 1,
      quote: 'Rust nämns.',
    },
  )
  const result = rankJob(
    { ...data.jobs[0], title: 'Data Engineer' },
    detail,
    profile,
  )
  assert.equal(
    result.requirements.find((r) => r.requirement.label === 'Azure')?.state,
    'partial',
  )
  assert.equal(
    result.requirements.find((r) => r.requirement.label === 'Scala')?.state,
    'not_evidenced',
  )
  assert.ok(result.blockers.some((b) => b.reason.includes('not evidenced')))
  assert.ok(!result.blockers.some((b) => b.quote.includes('Rust')))
  assert.ok(!JSON.stringify(result).includes('candidate lacks'))
})
test('title without junior is eligible, unknown working arrangements stay in consideration, preferences are configurable', () => {
  const data = fixtureCompanies(),
    detail = fixtureWorkspace(data).jobs[0],
    profile = fixtureProfile()
  const job = { ...data.jobs[0], title: 'Analytics Engineer', location: null }
  assert.ok(rankJob(job, detail, profile).suitable)
  const before = rankJob({ ...job, location: 'Stockholm' }, detail, profile)
  profile.preferences.locations = ['Elsewhere']
  assert.ok(
    rankJob({ ...job, location: 'Stockholm' }, detail, profile).score <
      before.score,
  )
  profile.preferences.role_weights.analytics_engineer = 0.1
  assert.ok(!rankJob(job, detail, profile).suitable)
})
test('PhD, management and Swedish number-word minimums remain explicit potential blockers', () => {
  const data = fixtureCompanies(),
    detail = fixtureWorkspace(data).jobs[0],
    profile = fixtureProfile()
  for (const [category, quote] of [
    ['education', 'PhD required.'],
    ['experience', 'Minst fem års erfarenhet krävs.'],
    ['conditions', 'Personalansvar krävs.'],
  ]) {
    const d = {
      ...detail,
      analysis: {
        ...detail.analysis,
        requirements: [
          {
            label: 'condition',
            category,
            strength: 'required' as const,
            source_field: 'description',
            line: 1,
            quote,
          },
        ],
      },
    }
    const result = rankJob(
      { ...data.jobs[0], title: 'Data Engineer' },
      d,
      profile,
    )
    assert.ok(
      !result.suitable && result.blockers.some((b) => b.quote === quote),
    )
  }
})
test('ranking is deterministic, normalised and separates all-unassessed weights', () => {
  const data = fixtureCompanies(),
    details = fixtureWorkspace(data).jobs,
    profile = fixtureProfile()
  data.jobs = data.jobs.map((j) => ({ ...j, title: 'Junior Data Engineer' }))
  const a = rankCandidates(data.jobs, details, profile),
    b = rankCandidates([...data.jobs].reverse(), details, profile)
  assert.deepEqual(a, b)
  assert.ok(
    a.every(
      (r) => r.score >= 0 && r.score <= 100 && r.version === 'relevance-v1',
    ),
  )
  profile.preferences.weights = {
    role: 0,
    required: 0,
    preferred: 0,
    experience: 0,
    location: 0,
    education: 1,
  }
  assert.equal(rankJob(data.jobs[0], details[0], profile).score, 0)
})
test('qualification profile rejects contact fields and local endpoint refuses remote and cross-origin access', () => {
  assert.ok(parseProfile(fixtureProfile()))
  assert.throws(() =>
    parseProfile({ ...fixtureProfile(), email: 'private@example.invalid' }),
  )
  const bad = fixtureProfile()
  bad.facts.skills[0].quote = 'Write private@example.invalid'
  assert.throws(() => parseProfile(bad))
  const malformed = fixtureProfile()
  malformed.facts.skills[0].quote = {
    text: 'not a schema-valid excerpt',
  } as unknown as string
  assert.throws(() => parseProfile(malformed))
  assert.ok(
    localProfileAllowed('127.0.0.1:5173', '127.0.0.1', 'http://127.0.0.1:5173'),
  )
  assert.ok(!localProfileAllowed('127.0.0.1:5173', '192.168.1.20', undefined))
  assert.ok(
    !localProfileAllowed('127.0.0.1:5173', '127.0.0.1', 'https://example.com'),
  )
  assert.ok(!localProfileAllowed('example.com', '127.0.0.1', undefined))
})

test('equivalent-experience alternatives and junior ranges remain uncertain rather than automatic exclusions', () => {
  const data = fixtureCompanies(),
    detail = fixtureWorkspace(data).jobs[0],
    profile = fixtureProfile()
  detail.analysis.requirements.push(
    {
      label: 'degree',
      category: 'education',
      strength: 'required',
      source_field: 'description',
      line: 1,
      quote: 'Bachelor or equivalent experience required.',
    },
    {
      label: 'experience',
      category: 'experience',
      strength: 'required',
      source_field: 'description',
      line: 1,
      quote: 'Required: 0–2 years experience.',
    },
  )
  const r = rankJob(
    { ...data.jobs[0], title: 'Junior Data Engineer' },
    detail,
    profile,
  )
  assert.ok(r.suitable)
  assert.equal(r.factors.find((f) => f.key === 'education')?.value, 0.5)
  assert.ok(r.blockers.some((b) => b.reason.includes('accepted alternatives')))
})
