import { test, expect } from './test'

test('welfare leads with a question, one county comparison, then headlines and a working explorer', async ({
  page,
}) => {
  await page.goto('/#sweden')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'How is Sweden doing?',
  )
  await expect(page.locator('.project-hero-question')).toHaveText(
    'Which parts of Sweden do well or poorly, measure by measure?',
  )
  // One regional comparison first, with what it means and does not mean; sources come later.
  await expect(page.locator('#lanen .multiple')).toHaveCount(21)
  await expect(page.locator('.interpretation-not')).toContainText(
    'margin of about',
  )
  await expect(page.locator('.welfare-tile')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Explore: the latest national values' })
    .click()
  await expect(page.locator('.welfare-tile').first()).toBeVisible()
  await expect(page.locator('.welfare-tile strong').first()).toContainText('%')

  // Every county, each with an unemployment figure for the default year.
  await page.locator('.project-subnav a[href="#sweden-counties"]').click()
  await expect(page.locator('.welfare-table tbody tr')).toHaveCount(21)

  // The explorer reads Parquet in the browser and draws the selection.
  await page.locator('.topic-tabs a[href="#sweden-explorer"]').click()
  const explorer = page.locator('.welfare-explorer')
  await explorer.scrollIntoViewIfNeeded()
  await expect(explorer.locator('.multi-chart polyline').first()).toBeVisible({
    timeout: 15000,
  })
  await explorer.locator('.slicers select').nth(0).selectOption('jobb')
  await explorer.locator('.slicers select').nth(2).selectOption('county')
  // Another source's Parquet loads from object storage after the switch; give it the same
  // time as the first load, not the default five seconds.
  await expect(explorer.locator('.region-chip')).toHaveCount(3, {
    timeout: 15000,
  })
  await expect(explorer.locator('.multi-chart polyline')).toHaveCount(3, {
    timeout: 15000,
  })
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
