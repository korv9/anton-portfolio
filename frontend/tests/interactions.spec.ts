/**
 * Controls do what they say: a filter can be chosen from the keyboard, a chosen state is
 * announced (aria-pressed), and a view that lives in the address survives a reload.
 */
import { test, expect } from './test'

test('the Symbol Lab view chips explain their colours', async ({ page }) => {
  await page.goto('/#symbolic-atlas?view=baseline')
  const key = page.locator('.atlas-key')
  // The empty review view stays hidden until a cluster has been reviewed.
  await expect(page.locator('main')).not.toContainText('Reviewed and named')
  await expect(
    page.getByRole('button', { name: 'Reviewed', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Cross-book', exact: true }).click()
  // Cross-book is the default view, so the address drops the view.
  await expect(page).not.toHaveURL(/view=baseline/)
  await expect(key).toContainText('Cross-book candidate')
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Cross-book', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
})
