import { test, expect } from './test'
test('wellbeing separates work, sick leave and regional comparisons', async ({
  page,
}) => {
  await page.goto('/#sweden')
  await expect(page.locator('.overview-topics > a')).toHaveCount(4)
  await page.goto('/#sweden-work')
  await expect(page.locator('#lanen')).toContainText('Unemployment by county')
  await expect(page.locator('.welfare-page')).toContainText(
    'total-population-weighted county mean',
  )
  await page.goto('/#sweden-sick-leave')
  await expect(page.locator('#lanen')).toContainText(
    'Sickness benefit days by county',
  )
  await page.goto('/#sweden-counties')
  await expect(page.locator('.welfare-table tbody tr')).toHaveCount(21)
  await page
    .getByRole('button', { name: 'Sick-pay days', exact: false })
    .click()
  await expect(page.locator('th[aria-sort="descending"]')).toContainText(
    'Sick-pay days',
  )
})

test(
  'wellbeing explorer plots source observations',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#sweden-mental-health')
    await expect(page.locator('.multi-chart polyline').first()).toBeVisible({
      timeout: 30000,
    })
    await expect(page.locator('.download-button')).toContainText('CSV')
    await expect(page.locator('.welfare-page .dk-kpis')).toHaveCount(0)
  },
)
