import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { fixtureCompanies } from './fixtures/companies'
import { fixtureWorkspace } from './fixtures/job-intelligence'
import { fixtureProfile } from './fixtures/job-profile'

test.afterEach(async ({ page }) =>
  page.unrouteAll({ behavior: 'ignoreErrors' }),
)
test('canonical company route loads under CSP and renders employer text safely', async ({
  page,
}) => {
  const rule = readFileSync(
    new URL('../../dist/_headers', import.meta.url),
    'utf8',
  )
    .replace(/\r\n/g, '\n')
    .split('/*\n')[1]
    .split('\n\n')[0]
  const headers = Object.fromEntries(
    rule
      .split('\n')
      .filter((s) => s.trim())
      .map((s) => {
        const i = s.indexOf(':')
        return [s.slice(0, i).trim(), s.slice(i + 1).trim()]
      }),
  )
  await page.route('http://127.0.0.1:4187/**', async (route) => {
    const response = await route.fetch()
    await route.fulfill({
      response,
      headers: { ...response.headers(), ...headers },
    })
  })
  await page.route('**/data/delivery.json', (route) =>
    route.fulfill({
      json: { bases: { json: 'data/', parquet: 'data/', shard: 'data/' } },
    }),
  )
  const data = fixtureCompanies()
  data.companies[0].registered_legal_name =
    '<img src=x onerror="window.injected=true">'
  await page.route('**/data/jobs/company-intelligence.json', (route) =>
    route.fulfill({ json: data }),
  )
  await page.route('**/data/compliance/release.json', (route) =>
    route.fulfill({
      json: { schema_version: 1, state: 'unavailable', reason: 'not_reviewed' },
    }),
  )
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(
    '/companies/' + encodeURIComponent(data.companies[0].company_id),
  )
  await expect(
    page.getByRole('heading', {
      name: data.companies[0].registered_legal_name,
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.locator('.company-intelligence img')).toHaveCount(0)
  expect(await page.evaluate(() => 'injected' in window)).toBe(false)
  await expect(page.locator('.company-intelligence').first()).toContainText(
    'has not been assessed here',
  )
  expect(errors).toEqual([])
  const content = fixtureWorkspace(data)
  content.jobs[0].description_text +=
    '\n<img src=x onerror="window.injected=true"><script>window.injected=true</script>'
  await page.route('**/data/jobs/workspace.json', (r) =>
    r.fulfill({ json: content }),
  )
  let privateProfileRequests = 0
  await page.route('**/__local/job-intelligence-profile', (r) => {
    privateProfileRequests++
    return r.fulfill({ json: { state: 'local', profile: fixtureProfile() } })
  })
  await page.goto('/#jobb-it?job=0')
  await expect(page.locator('.ji-advertisement')).toContainText('<img src=x')
  await expect(
    page.locator(
      '.ji-advertisement img,.ji-advertisement script,.ji-advertisement iframe',
    ),
  ).toHaveCount(0)
  expect(await page.evaluate(() => 'injected' in window)).toBe(false)
  await expect(page.locator('#ji-cv')).toContainText('Public mode')
  await expect(page.locator('#ji-cv')).not.toContainText(
    'Synthetic qualification evidence',
  )
  expect(privateProfileRequests).toBe(0)
  await expect(page.locator('input[type=file]')).toHaveCount(0)
  expect(errors).toEqual([])
})
