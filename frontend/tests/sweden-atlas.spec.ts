/**
 * SWEDEN atlas: the 3D atlas is offline (docs/roadmap.md). Its code stays in src/sweden/atlas,
 * but nothing links to it and every #sweden-atlas address leads to the SWEDEN page.
 */
import { test, expect } from './test'

const ROUTES = [
  '#sweden-atlas',
  '#sweden-atlas-a',
  '#sweden-atlas-c?kommun=1480',
  '#sweden-atlas-x',
]

test('every atlas address leads to the SWEDEN page', async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto('/' + route)
    await expect(page).toHaveURL(/#sweden(\?|$)/)
    await expect(page.locator('.sw-jump')).toBeVisible()
    await expect(page.locator('.sw-atlas-nav')).toHaveCount(0)
  }
})

test('the SWEDEN page does not link to the atlas', async ({ page }) => {
  await page.goto('/#sweden')
  await expect(page.locator('.sw-jump')).toBeVisible()
  await expect(page.locator('a[href^="#sweden-atlas"]')).toHaveCount(0)
})
