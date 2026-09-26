import { test, expect } from '@playwright/test'

test('welfare page shows headlines, the county comparison and a working explorer', async ({
  page,
}) => {
  await page.goto('/#sweden')
  await expect(
    page.getByRole('heading', { name: 'How is Sweden doing?' }),
  ).toBeVisible()
  await expect(page.locator('.welfare-tile').first()).toBeVisible()
  await expect(page.locator('.welfare-tile strong').first()).toContainText('%')

  // Every county, each with an unemployment figure for the default year.
  await expect(page.locator('.welfare-table tbody tr')).toHaveCount(21)

  // The explorer reads Parquet in the browser and draws the selection.
  const explorer = page.locator('.welfare-explorer')
  await explorer.scrollIntoViewIfNeeded()
  await expect(explorer.locator('.multi-chart polyline').first()).toBeVisible({
    timeout: 15000,
  })
  await explorer.locator('.slicers select').nth(0).selectOption('jobb')
  await explorer.locator('.slicers select').nth(2).selectOption('county')
  await expect(explorer.locator('.region-chip')).toHaveCount(3)
  await expect(explorer.locator('.multi-chart polyline')).toHaveCount(3)
  await explorer.locator('.region-chip').first().click()
  await expect(explorer.locator('.multi-chart polyline')).toHaveCount(2)
  await expect(explorer.locator('.download-button')).toContainText('CSV')
})

test('status page reports the last run, its tests and every source', async ({
  page,
}) => {
  await page.goto('/#status')
  await expect(
    page.getByRole('heading', { name: 'Pipeline status' }),
  ).toBeVisible()
  await expect(page.locator('.status-summary')).toContainText('passed')
  // Five welfare sources and the JobTech archives.
  await expect(
    page.locator('.status-page .welfare-table tbody tr'),
  ).toHaveCount(6)
})
