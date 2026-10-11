import { test, expect } from './test'
test('politics starts with five distinct topics', async ({ page }) => {
  await page.goto('/#politik')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Political Observatory',
  )
  await expect(page.locator('.overview-topics > a')).toHaveCount(5)
  await expect(page.locator('.dk-kpis')).toHaveCount(0)
  await page.locator('.overview-topics a[href="#politik-budget"]').click()
  await expect(page.locator('#budgetflode')).toBeVisible()
})
