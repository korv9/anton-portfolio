import { test, expect } from './test'

test('the tax theme carries a calculator that responds', async ({ page }) => {
  await page.goto('/#politik-skatter')
  const total = page.getByTestId('tax-total')
  await expect(total).toBeVisible()
  const before = await total.textContent()
  await page.locator('[data-field="salary"]').fill('60000')
  await expect(total).not.toHaveText(before ?? '')
  await expect(page.getByTestId('employer-contributions')).toContainText('kr')
  await expect(page.getByTestId('tax-wedge')).toContainText('%')
  // Capital: an ISK above the tax-free level adds capital tax to the breakdown.
  await page.locator('[data-field="iskCapital"]').fill('1000000')
  await expect(page.locator('.tax-lines')).toContainText('capital income')
})
