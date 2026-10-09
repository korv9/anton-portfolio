import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test.use({ language: null })

test('Swedish is the default language', async ({ page }) => {
  await page.goto('/#politik')
  await expect(page.locator('html')).toHaveAttribute('lang', 'sv')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Svensk politik i siffror',
  )
  await expect(page.locator('.dk-head .dk-lead')).toContainText(
    'Öppna data från riksdagen',
  )
})

test('language choice persists across project pages and keeps data controls stable', async ({
  page,
}) => {
  await page.goto('/#start')
  await page.getByRole('button', { name: 'SV', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'sv')
  await expect(
    page.getByRole('navigation', { name: 'Startsidan' }),
  ).toContainText('Erfarenhet')
  await expect(
    page.getByRole('button', { name: 'SV', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')

  await page.goto('/#politik-sok')
  await expect(
    page.getByRole('heading', { name: 'Vad sa de egentligen?' }),
  ).toBeVisible()
  await page.locator('.politics-controls select').first().selectOption('All')
  await expect(page.getByText(/tal hittade/)).toBeVisible()
  await page.locator('.speech-card').first().click()
  await expect(page.locator('.source-text[lang="sv"]')).toBeVisible()

  await page.goto('/#drugcomb')
  await expect(
    page.getByRole('heading', { name: 'Håller förutsägelsen på något nytt?' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 320, height: 900 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  // Contrast is checked on the settled page, not halfway through the cards fading in.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  )
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])

  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', {
      name: 'Does the prediction hold up on something new?',
    }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'EN', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
})
