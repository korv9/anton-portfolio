import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('the constellation shows sources, platform and products at a glance', async ({
  page,
}) => {
  await page.goto('/#data-constellation')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /raw sources to analytical products/,
    }),
  ).toBeVisible()
  await expect(page.locator('.constellation-canvas')).toBeVisible()
  await expect(page.locator('.constellation-products li')).toHaveCount(7)
  await expect(page.locator('.project-context')).toContainText(
    'Data Constellation',
  )
  const axe = await new AxeBuilder({ page }).include('.constellation').analyze()
  expect(axe.violations).toEqual([])
})

test('a product traces back to its source and links to itself', async ({
  page,
}) => {
  await page.goto('/#data-constellation')
  await page
    .locator('.constellation-products button', { hasText: 'Symbolic Atlas' })
    .click()
  await expect(page).toHaveURL(/node=app%3Asymbolic|node=app:symbolic/)
  const panel = page.locator('.constellation-panel')
  await expect(panel.locator('.constellation-node-title')).toHaveText(
    'Symbolic Atlas',
  )
  await expect(panel).toContainText('symbolic/v4/atlas.parquet')
  await expect(
    panel.getByRole('link', { name: /Explore Symbolic Atlas/ }),
  ).toHaveAttribute('href', '#symbolic-atlas')
})

test('a gold mart shows what feeds it, what it feeds and where its code lives', async ({
  page,
}) => {
  await page.goto('/#data-constellation')
  await page.getByPlaceholder('Search models…').fill('mart_symbol')
  await page
    .locator('.constellation-results button', { hasText: 'mart_symbol_atlas' })
    .click()
  const panel = page.locator('.constellation-panel')
  await expect(panel).toContainText(
    'platform/models/gold/symbolic/mart_symbol_atlas.sql',
  )
  await expect(panel).toContainText('int_symbol_occurrences')
  await expect(panel).toContainText('symbolic/v4/atlas.parquet')
})

test('the data model view shows tables and their joins', async ({ page }) => {
  await page.goto('/#data-constellation?view=model&node=dbt:fct_indicator')
  const panel = page.locator('.constellation-panel')
  await expect(panel.locator('.constellation-node-title')).toHaveText(
    'fct_indicator',
  )
  await expect(panel).toContainText('Joins')
  await expect(
    panel.locator('.constellation-columns code').first(),
  ).toBeVisible()
})

test('a domain filter and the text list keep the map usable without a mouse', async ({
  page,
}) => {
  await page.goto('/#data-constellation')
  await page.locator('.constellation-select select').selectOption('politics')
  await expect(page).toHaveURL(/domain=politics/)
  const politics = page.locator('.constellation-fallback details').first()
  await politics.locator('summary').click()
  await politics.getByRole('button', { name: 'Riksdagen', exact: true }).click()
  await expect(page.locator('.constellation-node-title')).toHaveText(
    'Riksdagen',
  )
})

test('on a phone the map stands upright and fits the screen', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'phone layout only')
  await page.goto('/#data-constellation')
  const canvas = page.locator('.constellation-canvas')
  await expect(canvas).toBeVisible()
  const box = (await canvas.boundingBox())!
  expect(box.height).toBeGreaterThan(box.width * 1.5)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
