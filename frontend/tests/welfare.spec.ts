import { test, expect } from './test'
test('wellbeing separates work, health and regional comparisons', async ({
  page,
}) => {
  await page.goto('/#sweden-work')
  await expect(page).toHaveURL(/#wellbeing$/)
  await expect(page.locator('#arbetsloshet h2')).toContainText('Unemployment')
  await expect(page.locator('#arbetsloshet .feature-source')).toContainText(
    'population-weighted mean',
  )
  await page
    .getByRole('group', { name: 'Counties' })
    .getByRole('button', { name: 'Gotland', exact: true })
    .click()
  await expect(page).toHaveURL(/lan=09/)
  await expect(page.locator('#arbetsloshet .chart-legend')).toContainText(
    'Gotland',
  )
  await page.goto('/#sweden-sick-leave')
  await expect(page).toHaveURL(/#wellbeing-health$/)
  await expect(page.locator('#sjukpenning h2')).toContainText(
    'Sickness benefit days per county',
  )
  await page.goto('/#wellbeing-counties')
  const table = page.locator('.welfare-table')
  await expect(table.locator('tbody tr')).toHaveCount(21)
  await table.getByRole('button', { name: 'Sickness benefit days' }).click()
  await expect(page.locator('th[aria-sort="descending"]')).toContainText(
    'Sickness benefit days',
  )
})

test(
  'wellbeing explorer plots source observations',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#wellbeing-mental-health')
    await expect(page.locator('.multi-chart polyline').first()).toBeVisible({
      timeout: 30000,
    })
    await expect(page.locator('.download-button')).toContainText('CSV')
    await expect(page.locator('.welfare-page .dk-kpis')).toHaveCount(0)
  },
)
