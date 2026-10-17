import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { fixtureCompanies } from './fixtures/companies'

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
  await expect(page.locator('.company-intelligence')).toContainText(
    'has not been assessed here',
  )
  expect(errors).toEqual([])
})
