import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('language choice persists across project pages and keeps data controls stable', async ({ page, isMobile }) => {
  await page.goto('/#start')
  await page.getByRole('button', { name: 'SV', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'sv')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dataingenjör')
  await expect(page.getByRole('button', { name: 'SV', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await page.goto('/#data-explorer')
  await expect(page.getByRole('heading', { name: 'Vad sa de egentligen?' })).toBeVisible()
  await page.locator('.politics-controls select').first().selectOption('All')
  await expect(page.getByText(/tal hittade/)).toBeVisible()
  await page.locator('.speech-card').first().click()
  await expect(page.locator('.source-text[lang="sv"]')).toBeVisible()

  await page.goto('/#budget-comparison')
  await expect(page.getByRole('heading', { name: 'Vad innehåller budgetförslagen?' })).toBeVisible()
  await expect(page.locator('.budget-ledger')).toContainText('Budgetförslag')
  await page.goto('/#drugcomb')
  await expect(page.getByRole('heading', { name: 'Håller prediktionen för något nytt?' })).toBeVisible()
  await page.setViewportSize({ width: 320, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(accessibility.violations).toEqual([])

  if (isMobile) await page.getByRole('button', { name: 'Meny' }).click()
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Does the prediction hold up on something new?' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'EN', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
