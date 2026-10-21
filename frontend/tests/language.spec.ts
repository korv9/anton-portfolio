import { test, expect } from './test'
test.use({ language: null })
test('the site is in English, with no language switch', async ({ page }) => {
  await page.goto('/#symbolic-atlas')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('.language-switch')).toHaveCount(0)
})
