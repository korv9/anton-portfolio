import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './test'
import { fixtureCompanies } from './fixtures/companies'
import { fixtureWorkspace } from './fixtures/job-intelligence'
import { fixtureProfile } from './fixtures/job-profile'
import { envelope, fixturePayload } from './fixtures/compliance'
import type { Page } from '@playwright/test'

async function prepare(page: Page) {
  const data = fixtureCompanies(),
    content = fixtureWorkspace(data)
  await page.route('**/data/jobs/company-intelligence.json', (r) =>
    r.fulfill({ json: data }),
  )
  await page.route('**/data/jobs/workspace.json', (r) =>
    r.fulfill({ json: content }),
  )
  await page.route('**/data/compliance/release.json', (r) =>
    r.fulfill({
      json: { schema_version: 1, state: 'unavailable', reason: 'not_approved' },
    }),
  )
  return { data, content }
}

test(
  'private local profile ranks live candidates automatically and all evidence sections are already rendered',
  { tag: '@mobile' },
  async ({ page }) => {
    const { data, content } = await prepare(page)
    data.jobs[0].title = 'Senior Data Engineer'
    data.jobs[1].title = 'Junior Analytics Engineer'
    data.jobs[2].title = 'Junior Python Developer'
    content.jobs[0].description_text += '\nMinst 5 års erfarenhet krävs.'
    content.jobs[0].analysis.requirements.push({
      label: '5 years',
      category: 'experience',
      strength: 'required',
      source_field: 'description',
      line: 4,
      quote: 'Minst 5 års erfarenhet krävs.',
    })
    await page.route('**/data/jobs/company-intelligence.json', (r) =>
      r.fulfill({ json: data }),
    )
    await page.route('**/data/jobs/workspace.json', (r) =>
      r.fulfill({ json: content }),
    )
    await page.route('**/data/jobs/workspace-remaining.json', (r) =>
      r.fulfill({ json: { ...content, jobs: [] } }),
    )
    await page.route('**/__local/job-intelligence-profile', (r) =>
      r.fulfill({ json: { state: 'local', profile: fixtureProfile() } }),
    )
    await page.goto('/#jobb-it')
    await expect(page.locator('.ji-job-item')).toHaveCount(2)
    await expect(page.locator('.ji-explorer')).toContainText('best match first')
    await expect(page).toHaveURL(/job=1/)
    await expect(page.locator('#ji-cv')).toContainText(
      'Local relevance estimate',
    )
    await expect(page.locator('#ji-cv')).toContainText('Synthetic CV page 1')
    await expect(page.locator('#ji-company')).toContainText(
      'No reviewed financial history',
    )
    await expect(
      page
        .locator('#ji-company')
        .getByRole('heading', { name: 'Stock Market', exact: true }),
    ).toHaveCount(1)
    await expect(
      page.locator('.job-intelligence details,.ji-company-tabs'),
    ).toHaveCount(0)
    await page
      .getByRole('combobox', { name: 'Sort', exact: true })
      .selectOption('newest')
    await page
      .locator('.ji-job-item button')
      .filter({ hasText: 'Junior Python Developer' })
      .click()
    await expect(page).toHaveURL(/job=2/)
    await expect(page.locator('#ji-company')).toContainText('ambiguous')
    await expect(page.locator('#ji-company')).not.toContainText('9990000003')
    await expect(page.locator('#ji-cv')).toContainText(
      'Local relevance estimate',
    )
    await page.goBack()
    await expect(page).toHaveURL(/job=1/)
    await expect(page.locator('#ji-company')).toContainText('9990000003')
  },
)

test('older related advertisements load their full source text on demand once', async ({
  page,
}) => {
  const data = fixtureCompanies()
  data.jobs = Array.from({ length: 53 }, (_, i) => ({
    ...data.jobs[0],
    job_id: String(i).padStart(3, '0'),
    title: `Synthetic extended job ${i}`,
  }))
  data.links = data.jobs.map((j) => ({ ...data.links[0], job_id: j.job_id }))
  data.metrics.total_active_it_ads = 53
  data.metrics.verified_company_links = 53
  data.metrics.ambiguous_matches = 0
  data.metrics.match_coverage_percentage = 100
  let remainingRequests = 0
  await page.route('**/data/jobs/company-intelligence.json', (r) =>
    r.fulfill({ json: data }),
  )
  await page.route('**/data/jobs/workspace.json', (r) =>
    r.fulfill({ json: fixtureWorkspace(data) }),
  )
  await page.route('**/data/jobs/workspace-remaining.json', (r) => {
    remainingRequests++
    return r.fulfill({
      json: fixtureWorkspace({ ...data, jobs: data.jobs.slice(50) }),
    })
  })
  await page.goto('/#jobb-it?job=051')
  await expect(page.locator('.ji-job-item')).toHaveCount(50)
  await expect(
    page.getByRole('heading', {
      name: 'Synthetic extended job 51',
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.locator('.ji-advertisement')).toContainText(
    'Du har Python.',
  )
  await page.locator('.ji-job-item button').first().click()
  await expect(page.locator('.ji-advertisement')).toContainText(
    'Du har Python.',
  )
  await page.goBack()
  await expect(
    page.getByRole('heading', {
      name: 'Synthetic extended job 51',
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.locator('.ji-advertisement')).toContainText(
    'Du har Python.',
  )
  expect(remainingRequests).toBe(1)
})

test(
  'job research uses URL selection, original text, application links and source-bound analysis',
  { tag: '@mobile' },
  async ({ page }) => {
    await prepare(page)
    await page.goto('/#jobb-it?job=1')
    await expect(
      page.getByRole('heading', { name: 'Job Intelligence', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Synthetic developer 1', exact: true }),
    ).toBeVisible()
    await expect(page.locator('.ji-advertisement')).toHaveText(
      'Du har Python.\nSQL är meriterande.\nArbetet omfattar systemutveckling.',
    )
    await expect(
      page.getByRole('link', { name: 'Apply at source ↗' }),
    ).toHaveAttribute('href', 'https://example.invalid/apply/1')
    const required = page.locator('.ji-requirements > div').first()
    await expect(required).toContainText('Python')
    await expect(required.locator('q')).toHaveText('Du har Python.')
    await expect(page.locator('#ji-cv')).toContainText('no CV is uploaded')
    await expect(page.locator('input[type=file]')).toHaveCount(0)
    await expect(page.locator('#ji-company')).toContainText('9990000003')
    await expect(page.locator('#ji-company')).toContainText(
      'No reviewed financial history',
    )
    await expect(page.locator('#ji-company')).toContainText(
      'No verified repository ownership',
    )
    await expect(page.locator('#ji-company')).toContainText(
      'has not been assessed here',
    )
    for (const name of [
      'Company Snapshot',
      'Financial Health',
      'Workforce',
      'Hiring Activity',
      'Technology',
      'Clients & Contracts',
      'Corporate Events',
      'Compliance & Legal History',
      'Stock Market',
    ]) {
      await expect(
        page.locator('#ji-company').getByRole('heading', { name, exact: true }),
      ).toHaveCount(1)
    }
    await expect(
      page.locator('.job-intelligence details,.ji-company-tabs'),
    ).toHaveCount(0)
  },
)

test('company legal history withdraws expired or unapproved releases', async ({
  page,
}) => {
  const { data } = await prepare(page)
  const payload = fixturePayload(),
    id = data.companies[0].company_id
  payload.companies[0].company_id = id
  for (const family of payload.families.filter(
    (f) => f.company_id === 'synthetic:0',
  )) {
    family.company_id = id
    for (const d of family.decisions) {
      d.company_id = id
      d.legal_entity = data.companies[0].registered_legal_name
    }
  }
  let published: unknown = envelope(payload)
  await page.route('**/data/compliance/release.json', (r) =>
    r.fulfill({ json: published }),
  )
  await page.goto('/#jobb-it?job=0')
  await expect(page.locator('#ji-company')).toContainText('SYNTHETIC-0')
  published = { schema_version: 1, state: 'unavailable', reason: 'withdrawn' }
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('#ji-company')).not.toContainText('SYNTHETIC-0')
  await expect(page.locator('#ji-company')).toContainText(
    'has not been assessed here',
  )
  published = envelope(payload, Date.now() - 1000)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('#ji-company')).toContainText('review has expired')
  await expect(page.locator('#ji-company')).not.toContainText('SYNTHETIC-0')
})

test('filters retain selection and browser back/forward restores jobs without refetching company content', async ({
  page,
}) => {
  await prepare(page)
  let loads = 0
  page.on('request', (r) => {
    if (r.url().endsWith('/jobs/workspace.json')) loads++
  })
  await page.goto('/#jobb-it?job=0')
  await page.locator('.ji-job-item button').nth(1).click()
  await expect(page).toHaveURL(/job=1/)
  await page
    .getByRole('searchbox', { name: 'Search jobs' })
    .fill('no such vacancy')
  await expect(
    page.getByRole('heading', { name: 'Synthetic developer 1', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.ji-job-list')).toContainText(
    'No advertisements match',
  )
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await page.goBack()
  await expect(page).toHaveURL(/job=0/)
  await page.goForward()
  await expect(page).toHaveURL(/job=1/)
  expect(loads).toBe(1)
  await page
    .getByRole('combobox', { name: 'Skill', exact: true })
    .selectOption('Python')
  await expect(page.locator('.ji-result-count')).toContainText(
    '3 matching results',
  )
  await page
    .getByRole('combobox', { name: 'Verified company', exact: true })
    .selectOption('se:orgnr:9990000003')
  await expect(page.locator('.ji-result-count')).toContainText(
    '2 matching results',
  )
})

test('unresolved employer cannot open company facts and unknown deep links do not substitute jobs', async ({
  page,
}) => {
  await prepare(page)
  await page.goto('/#jobb-it?job=2')
  await expect(page.locator('#ji-company')).toContainText('ambiguous')
  await expect(page.locator('.company-deep-dive')).toHaveCount(0)
  await page.goto('/#jobb-it?job=absent')
  await expect(page.locator('.ji-research')).toContainText(
    'unavailable, expired or removed',
  )
  await expect(page.locator('.ji-advertisement')).toHaveCount(0)
})

test('untrusted fulltext is rendered literally and mismatched source versions are withheld', async ({
  page,
}) => {
  const { data, content } = await prepare(page)
  content.jobs[0].description_text +=
    '\n<img src=x onerror="window.injected=true"><script>alert(1)</script>'
  await page.route('**/data/jobs/workspace.json', (r) =>
    r.fulfill({ json: content }),
  )
  await page.goto('/#jobb-it?job=0')
  await expect(page.locator('.ji-advertisement')).toContainText('<img src=x')
  await expect(
    page.locator('.ji-advertisement img,.ji-advertisement script'),
  ).toHaveCount(0)
  expect(await page.evaluate(() => 'injected' in window)).toBe(false)
  content.jobs[0].document_hash = 'f'.repeat(64)
  await page.reload()
  await expect(page.locator('#ji-advertisement')).toContainText(
    'could not be loaded or verified',
  )
  await expect(page.locator('.ji-advertisement')).toHaveCount(0)
  expect(data.jobs.length).toBe(3)
})

test('missing fulltext has retry and source links while expired jobs disappear', async ({
  page,
}) => {
  const { data } = await prepare(page)
  data.jobs[2].application_deadline = '2000-01-01'
  await page.route('**/data/jobs/company-intelligence.json', (r) =>
    r.fulfill({ json: data }),
  )
  await page.route('**/data/jobs/workspace.json', (r) =>
    r.fulfill({ status: 503, body: 'Unavailable' }),
  )
  await page.goto('/#jobb-it?job=0')
  await expect(page.locator('.ji-job-item')).toHaveCount(2)
  await expect(page.locator('#ji-advertisement')).toContainText(
    'could not be loaded or verified',
  )
  await expect(
    page.getByRole('button', { name: 'Retry full advertisement' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Original advertisement ↗' }),
  ).toHaveAttribute('href', 'https://example.invalid/ad/0')
})

test(
  'workspace layout, keyboard focus and accessible mobile reading',
  { tag: '@mobile' },
  async ({ page, isMobile }) => {
    const { data, content } = await prepare(page)
    if (!isMobile) {
      data.jobs = Array.from({ length: 50 }, (_, i) => ({
        ...data.jobs[0],
        job_id: String(i).padStart(2, '0'),
        title: `Synthetic long list ${i}`,
      }))
      data.links = data.jobs.map((j) => ({
        ...data.links[0],
        job_id: j.job_id,
      }))
      data.metrics.total_active_it_ads = 50
      data.metrics.verified_company_links = 50
      data.metrics.ambiguous_matches = 0
      data.metrics.match_coverage_percentage = 100
      Object.assign(content, fixtureWorkspace(data))
      await page.route('**/data/jobs/company-intelligence.json', (r) =>
        r.fulfill({ json: data }),
      )
      await page.route('**/data/jobs/workspace.json', (r) =>
        r.fulfill({ json: content }),
      )
    }
    await page.goto('/#jobb-it')
    await expect(page.locator('.ji-advertisement')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    if (!isMobile) {
      const list = page.locator('.ji-job-list'),
        right = page.locator('.ji-research')
      const a = await list.boundingBox(),
        b = await right.boundingBox()
      expect(a!.x + a!.width).toBeLessThan(b!.x + 2)
      const sidebar = await page.locator('.ji-explorer').boundingBox(),
        split = await page.locator('.ji-split').boundingBox()
      expect(sidebar!.width / split!.width).toBeGreaterThanOrEqual(0.2)
      expect(sidebar!.width / split!.width).toBeLessThanOrEqual(0.24)
      expect(sidebar!.width).toBeLessThanOrEqual(270)
      await list.evaluate((el) => {
        el.scrollTop = 200
      })
      expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
      expect(await right.evaluate((el) => el.scrollTop)).toBe(0)
    }
    await page.getByRole('searchbox', { name: 'Search jobs' }).focus()
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
      'SELECT',
    )
    const audit = await new AxeBuilder({ page })
      .include('.job-intelligence')
      .analyze()
    expect(audit.violations).toEqual([])
    await page.screenshot({
      path: `tmp/job-intelligence-${isMobile ? 'mobile' : 'desktop'}.png`,
      fullPage: true,
    })
  },
)
