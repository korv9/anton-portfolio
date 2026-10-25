/**
 * SWEDEN atlas: the 3D atlas is offline (docs/roadmap.md). Its code stays in src/sweden/atlas,
 * but no menu links to it and every #sweden-atlas address leads to the SWEDEN hub.
 */
import { test, expect } from './test'

const ROUTES = [
  '#sweden-atlas',
  '#sweden-atlas-a',
  '#sweden-atlas-c?kommun=1480',
  '#sweden-atlas-x',
]

test('every atlas address leads to the SWEDEN hub', async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto('/' + route)
    await expect(page).toHaveURL(/#sweden(\?|$)/)
    await expect(page.locator('.sw-doors')).toBeVisible()
    await expect(page.locator('.sw-atlas-nav')).toHaveCount(0)
  }
})

test('the SWEDEN menu does not link to the atlas', async ({ page }) => {
  await page.goto('/#sweden')
  await page.getByRole('button', { name: 'MENU' }).click()
  await expect(page.locator('.sw-menu a[href="#projekt"]')).toBeVisible()
  await expect(page.locator('.sw-menu a[href^="#sweden-atlas"]')).toHaveCount(0)
})
