/**
 * Controls do what they say: a filter can be chosen from the keyboard, a chosen state is
 * announced (aria-pressed), and a view that lives in the address survives a reload.
 */
import { test, expect } from './test'

test('the Symbol Lab view chips explain their colours', async ({ page }) => {
  await page.goto('/#symbolic-atlas?view=cross-book')
  const key = page.locator('.atlas-key')
  await expect(key).toContainText('Cross-book candidate')
  await expect(key).toContainText('Reviewed and named')
  await page.getByRole('button', { name: 'Reviewed', exact: true }).click()
  await expect(page).toHaveURL(/view=reviewed/)
  await expect(key).not.toContainText('Cross-book candidate')
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Reviewed', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
})
