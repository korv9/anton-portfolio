import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { test, expect } from './test'
import { fixtureCompanies } from './fixtures/companies'
import { latestJobs } from '../src/job-intelligence/model'
import { envelope, fixturePayload } from './fixtures/compliance'

test('reviewed end employer remains distinct from the advertising recruiter', async ({
  page,
}) => {
  const d = fixtureCompanies(),
    id = 'se:orgnr:9990000011'
  d.companies.push({
    ...d.companies[0],
    company_id: id,
    organization_number: '9990000011',
    registry_number: '9990000011',
    registered_legal_name: 'Synthetic Client AB',
  })
  d.links.push({
    ...d.links[0],
    company_id: id,
    relationship_type: 'actual_employer',
    match_method: 'human_review',
  })
  await page.route('**/data/jobs/company-intelligence.json', (r) =>
    r.fulfill({ json: d }),
  )
  await page.route('**/data/compliance/release.json', (r) =>
    r.fulfill({
      json: { schema_version: 1, state: 'unavailable', reason: 'not_approved' },
    }),
  )
  await page.goto('/#jobb-it')
  const card = page.locator('#ji-company')
  await expect(card).toContainText('Documented actual employer:')
  await expect(
    card.getByRole('link', { name: 'Synthetic Company AB', exact: true }),
  ).toBeVisible()
  await card
    .getByRole('link', { name: 'Synthetic Client AB', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Synthetic Client AB', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.company-job')).toHaveCount(1)
})

test(
  'committed source projection renders real ads or its explicit freshness hold',
  { tag: '@mobile' },
  async ({ page }) => {
    const d = JSON.parse(
      readFileSync(
        new URL(
          '../public/data/jobs/company-intelligence.json',
          import.meta.url,
        ),
        'utf8',
      ),
    )
    await page.goto('/#jobb-it')
    if (d.state !== 'available' || Date.parse(d.valid_until) <= Date.now()) {
      await expect(page.getByRole('status')).toContainText(
        /unavailable|expired|No current/,
      )
      await expect(page.locator('.company-job')).toHaveCount(0)
      return
    }
    await expect(page.locator('.ji-result-count')).toContainText(
      `${Math.min(50, d.jobs.length)} matching results`,
    )
    const verifiedJob = latestJobs(d).find((j) =>
      d.links.some(
        (l: {
          job_id: string
          match_status: string
          relationship_type: string
        }) =>
          l.job_id === j.job_id &&
          l.match_status === 'verified' &&
          l.relationship_type === 'advertised_employer',
      ),
    )!
    await page
      .locator('.ji-job-item button')
      .filter({ hasText: verifiedJob.title })
      .first()
      .click()
    const link = page.locator('#ji-company a[href^="/companies/"]').first()
    const href = await link.getAttribute('href')
    const id = decodeURIComponent(href!.slice('/companies/'.length))
    const company = d.companies.find(
      (c: { company_id: string }) => c.company_id === id,
    )
    await link.click()
    await expect(
      page.getByRole('heading', {
        name: company.registered_legal_name,
        exact: true,
      }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
  },
)

test('approved decisions join only the exact verified legal identity and show finality', async ({
  page,
}) => {
  const jobs = fixtureCompanies(),
    legal = fixturePayload(),
    id = jobs.companies[0].company_id
  legal.companies[0].company_id = id
  for (const f of legal.families.filter(
    (f) => f.company_id === 'synthetic:0',
  )) {
    f.company_id = id
    for (const d of f.decisions) {
      d.company_id = id
      d.legal_entity = jobs.companies[0].registered_legal_name
    }
  }
  await page.route('**/data/jobs/company-intelligence.json', (r) =>
    r.fulfill({ json: jobs }),
  )
  await page.route('**/data/compliance/release.json', (r) =>
    r.fulfill({ json: envelope(legal) }),
  )
  await page.goto('/companies/' + encodeURIComponent(id))
  const section = page.locator('.company-section').filter({
    has: page.getByRole('heading', {
      name: 'Documented compliance decisions',
      exact: true,
    }),
  })
  await expect(section).toContainText('SYNTHETIC-0')
  await expect(section).toContainText('finality: final')
  await expect(section).not.toContainText('SYNTHETIC-1')
  await expect(section.getByRole('link', { name: 'Source ↗' })).toHaveCount(1)
})

test(
  'job to canonical company and back preserves identity and sources',
  { tag: '@mobile' },
  async ({ page, isMobile }) => {
    const d = fixtureCompanies()
    await page.route('**/data/jobs/company-intelligence.json', (route) =>
      route.fulfill({ json: d }),
    )
    await page.route('**/data/compliance/release.json', (route) =>
      route.fulfill({
        json: {
          schema_version: 1,
          state: 'unavailable',
          reason: 'not_approved',
        },
      }),
    )
    await page.goto('/#jobb-it')
    await expect(
      page.getByRole('heading', { name: 'Job Intelligence', exact: true }),
    ).toBeVisible()
    await expect(page.locator('.ji-job-item')).toHaveCount(3)
    await page.locator('.ji-job-item button').last().click()
    await expect(page.locator('#ji-company')).toContainText('ambiguous')
    await expect(
      page.locator('#ji-company a[href^="/companies/"]'),
    ).toHaveCount(0)
    await page.locator('.ji-job-item button').first().click()
    await page
      .getByRole('link', { name: 'Synthetic Company AB', exact: true })
      .first()
      .click()
    await expect(page).toHaveURL(/\/companies\/se%3Aorgnr%3A9990000003$/)
    await expect(
      page.getByRole('heading', { name: 'Synthetic Company AB', exact: true }),
    ).toBeVisible()
    await expect(page.locator('.company-intelligence').first()).toContainText(
      'No reviewed financial history',
    )
    await expect(page.locator('.company-intelligence').first()).toContainText(
      'has not been assessed here',
    )
    await expect(page.locator('.company-job')).toHaveCount(2)
    await page.reload()
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
      'href',
      '/favicon.svg',
    )
    await expect(
      page.getByRole('heading', { name: 'Synthetic Company AB', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Original job advertisement ↗' }).first(),
    ).toHaveAttribute('href', 'https://example.invalid/ad/0')
    await expect(
      page.locator('.company-intelligence').first(),
    ).not.toContainText('zero violations')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    const audit = await new AxeBuilder({ page })
      .include('.company-intelligence')
      .analyze()
    expect(audit.violations).toEqual([])
    await page.screenshot({
      path: `tmp/company-profile-${isMobile ? 'mobile' : 'desktop'}.png`,
      fullPage: true,
    })
    await page.getByRole('link', { name: 'Open filtered job list →' }).click()
    await expect(page.locator('.ji-job-item')).toHaveCount(2)
    await page.goBack()
    await expect(
      page.getByRole('heading', { name: 'Synthetic Company AB', exact: true }),
    ).toBeVisible()
    await page.getByRole('link', { name: '← Job Intelligence' }).click()
    await expect(page.locator('.ji-job-item')).toHaveCount(3)
  },
)
test('missing profiles and datasets are explicit and names do not substitute', async ({
  page,
}) => {
  await page.route('**/data/jobs/company-intelligence.json', (route) =>
    route.fulfill({ json: fixtureCompanies() }),
  )
  await page.goto('/companies/unknown')
  await expect(
    page.getByRole('heading', { name: 'Company profile unavailable' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Return to Job Intelligence' }).click()
  await expect(
    page.getByRole('heading', { name: 'Job Intelligence', exact: true }),
  ).toBeVisible()
  await page.route('**/data/jobs/company-intelligence.json', (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        state: 'unavailable',
        reason: 'not_collected',
      },
    }),
  )
  await page.reload()
  await expect(page.getByRole('status')).toContainText(
    'No current verified job/company release',
  )
})
test('unsafe evidence and stale jobs never render a company preview', async ({
  page,
}) => {
  const d = fixtureCompanies()
  d.links[0].evidence[0].source_url = 'javascript:alert(1)'
  await page.route('**/data/jobs/company-intelligence.json', (route) =>
    route.fulfill({ json: d }),
  )
  await page.goto('/#jobb-it')
  await expect(page.getByRole('status')).toContainText('Unsafe match evidence')
  await expect(page.locator('.company-job')).toHaveCount(0)
})
