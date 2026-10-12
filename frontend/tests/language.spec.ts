import { test, expect } from './test'
test.use({ language: null })
test('Swedish is the default language', async ({ page }) => {
  await page.goto('/#politik')
  await expect(page.locator('html')).toHaveAttribute('lang', 'sv')
  await expect(page.locator('.overview-topics')).toContainText(
    'Regering och riksdag',
  )
})
test(
  'the header language choice persists across pages and reloads',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#drugcomb')
    await expect(
      page.getByRole('heading', {
        name: 'Modellresultat per testuppdelning',
        exact: true,
      }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Byt till engelska', exact: true })
      .click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(
      page.getByRole('heading', {
        name: 'Performance by test split',
        exact: true,
      }),
    ).toBeVisible()
    await page.goto('/#jobb')
    await expect(page.locator('.overview-topics')).toContainText(
      'Demand over time',
    )
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  },
)
