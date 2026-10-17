import { test, expect } from './test'
test.use({ language: null })
test('the site is in English, with no language switch', async ({ page }) => {
  await page.goto('/#politik')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.po-header')).toContainText(
    'Swedish elections, governments and parliamentary evidence',
  )
  await expect(page.locator('.language-switch')).toHaveCount(0)
})
