import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { envelope, fixturePayload } from './fixtures/compliance'

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
})

test('compliance text and PNG export work under the unchanged deployment CSP', async ({
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
  const data = fixturePayload()
  data.companies[0].registered_legal_name =
    '<img src=x onerror="window.injected=true">'
  const release = envelope(data)
  await page.route('**/data/compliance/release.json', (route) =>
    route.fulfill({ json: release }),
  )
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#compliance-rankings')
  await expect(page.locator('.compliance')).toContainText('<img src=x onerror=')
  await expect(page.locator('.compliance img')).toHaveCount(0)
  expect(await page.evaluate(() => 'injected' in window)).toBe(false)
  await page
    .getByRole('navigation', { name: 'Report' })
    .getByRole('link', { name: 'Research stories' })
    .click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click()
  expect(await (await download).failure()).toBeNull()
  expect(errors).toEqual([])
})
