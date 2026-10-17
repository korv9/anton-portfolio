import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fixturePayload,
  envelope,
  progressFixture,
} from '../fixtures/compliance.ts'
import { parseProgress } from '../../src/compliance/progress.ts'
import {
  filtersOf,
  summaries,
  selectedFamilies,
  orderSummaries,
  observedRank,
  parseRelease,
  groupRoot,
  safeSource,
  filterError,
  independentRankingScope,
} from '../../src/compliance/model.ts'
import {
  csv,
  decisionCsv,
  graphicSvg,
  methodology,
  plotRows,
} from '../../src/compliance/exports.ts'

test('blocked KKV coverage permits only explicit IMY comparisons and keeps competition unassessed', () => {
  const data = fixturePayload(),
    filters = filtersOf(new URLSearchParams(), data)
  assert.equal(independentRankingScope(filters), false)
  assert.equal(
    independentRankingScope({ ...filters, authority: 'Konkurrensverket' }),
    false,
  )
  assert.equal(
    independentRankingScope({
      ...filters,
      authority: 'Integritetsskyddsmyndigheten',
    }),
    true,
  )
  assert.equal(
    independentRankingScope({
      ...filters,
      authority: 'Integritetsskyddsmyndigheten',
      category: 'competition',
    }),
    false,
  )
  assert.equal(
    summaries(data, {
      ...filters,
      authority: 'Integritetsskyddsmyndigheten',
    })[0].competition,
    null,
  )
})

test('public gate refuses missing review, expired releases, corruption and false cohorts', async () => {
  assert.equal(
    await parseRelease({ schema_version: 1, state: 'unavailable' }),
    null,
  )
  for (const value of [
    { ...envelope(), state: 'pending' },
    envelope(undefined, Date.now() - 1000),
    { ...envelope(), payload_json: '{}' },
    envelope({ ...fixturePayload(), companies: [] }),
  ])
    await assert.rejects(parseRelease(value))
})
test('aggregate progress accepts dated metadata but refuses legal fields, unsafe sources and inconsistent counts', () => {
  assert.equal(parseProgress(progressFixture()).cohort.selected_count, 50)
  for (const mutate of [
    (p: any) => {
      p.companies = [{ name: 'Unreviewed' }]
    },
    (p: any) => {
      p.sources.imy.sanction_amount = 123
    },
    (p: any) => {
      p.sources.imy.source_url = 'javascript:alert(1)'
    },
    (p: any) => {
      delete p.sources.kkv
    },
    (p: any) => {
      p.cohort.as_of_date = '2026-02-30'
    },
    (p: any) => {
      p.observed_at = '2099-01-01T00:00:00Z'
    },
    (p: any) => {
      p.review.publication_eligible = 3
    },
    (p: any) => {
      p.approved_gold_records = 1
    },
    (p: any) => {
      p.sources.kkv.coverage_fraction = 1
    },
  ]) {
    const p = progressFixture()
    mutate(p)
    assert.throws(() => parseProgress(p))
  }
})
test('observed metrics keep unassessed entities null and currencies separate', () => {
  const data = fixturePayload(),
    filters = filtersOf(new URLSearchParams(), data)
  const rows = summaries(data, filters)
  assert.equal(rows.length, 50)
  assert.equal(rows[0].sanctions, 1)
  assert.equal(rows[1].sanctions, 2)
  assert.deepEqual(rows[1].finalAmounts, { EUR: '35000.00' })
  assert.equal(rows[2].sanctions, null)
  assert.equal(orderSummaries(rows, 'sanctions', 'SEK')[0].id, 'synthetic:1')
  assert.equal(observedRank(rows, rows[2], 'sanctions', 'SEK'), null)
  assert.equal(observedRank(rows, rows[0], 'money', 'SEK'), null)
})
test('URL filters apply to originating case date and preserve late appellate context', () => {
  const data = fixturePayload()
  data.families[0].decisions.push({
    ...data.families[0].decisions[0],
    decision_id: 'late-court',
    authority: 'Förvaltningsrätten i Stockholm',
    decision_date: '2026-10-16',
  })
  const f = filtersOf(
    new URLSearchParams('from=2025-01-01&to=2025-12-31&status=final'),
    data,
  )
  const fs = selectedFamilies(data, f)
  assert.equal(fs.length, 2)
  assert.ok(fs[0].decisions.some((d) => d.decision_id === 'late-court'))
  assert.ok(filterError({ ...f, from: '2025-02-30' }, data))
})
test('groups aggregate only dated cohort members without transferring case identity', () => {
  const data = fixturePayload()
  data.relationships = [
    {
      company_id: 'synthetic:1',
      related_company_id: 'synthetic:0',
      relationship_type: 'subsidiary_of',
      valid_from: '2020-01-01',
      valid_to: null,
      source_url: 'https://example.invalid/relationship',
      document_hash: 'a'.repeat(64),
    },
  ]
  const rows = summaries(data, {
    ...filtersOf(new URLSearchParams(), data),
    scope: 'corporate_group',
  })
  const group = rows.find((r) => r.id === 'synthetic:0')!
  assert.equal(group.members.length, 2)
  assert.equal(group.sanctions, 3)
  assert.equal(group.families[1].company_id, 'synthetic:1')
  data.relationships[0].valid_from = null
  assert.throws(() => groupRoot('synthetic:1', data), /Undated/)
})
test('allegations and investigations cannot enter confirmed totals', async () => {
  for (const status of ['alleged', 'investigation', 'annulled']) {
    const data = fixturePayload()
    data.families[0].legal_status = status
    await assert.rejects(parseRelease(envelope(data)), /Unconfirmed/)
  }
})
test('money sorting remains exact above JavaScript integer precision', () => {
  const data = fixturePayload()
  data.families[0].final_amounts = { SEK: '9007199254740991.02' }
  data.families[1].final_amounts = { SEK: '9007199254740991.01' }
  const rows = summaries(data, filtersOf(new URLSearchParams(), data))
  assert.equal(orderSummaries(rows, 'money', 'SEK')[0].id, 'synthetic:0')
})
test('structured CSV and SVG exports neutralize formulas and markup', async () => {
  assert.match(
    csv([{ name: '=HYPERLINK("evil")', other: '\n +CMD()' }]),
    /"'=HYPERLINK/,
  )
  assert.equal(safeSource('javascript:alert(1)'), null)
  const data = fixturePayload()
  data.families[0].decisions[0].authority = '<script>alert(1)</script>'
  const release = (await parseRelease(envelope(data)))!
  const filters = filtersOf(new URLSearchParams(), data)
  const svg = graphicSvg(
    release,
    filters,
    data.families,
    'authority',
    'SEK',
    1200,
    {
      paper: '#f1efe7',
      ink: '#363636',
      muted: '#57554e',
      accent: '#706c83',
      font: 'Helvetica',
    },
  )
  assert.ok(svg.includes('width="1200" height="1200"'))
  assert.ok(!svg.includes('<script>'))
  assert.ok(svg.includes('&lt;script&gt;'))
  assert.ok(svg.includes(data.context.membership_hash))
  assert.ok(
    methodology(release, filters, data.families).includes(
      data.families[0].documents[0].document_hash,
    ),
  )
  assert.ok(
    decisionCsv(data.families, release, filters).includes('release_sha256'),
  )
  assert.equal(
    plotRows(data.families, 'amounts', 'SEK').reduce((n, r) => n + r.value, 0),
    1,
  )
})
