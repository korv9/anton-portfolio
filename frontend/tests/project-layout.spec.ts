import { test, expect } from './test'
const pages = [
  '#symbolic-atlas',
  '#philosophy-atlas',
  '#concept-journey',
  '#drugcomb',
  '#thesis',
  '#homie',
  '#projects',
  '#cluster-visuals',
  '#what-does-it-even-mean',
]
test(
  'retained pages fit desktop and mobile',
  { tag: '@mobile' },
  async ({ page }) => {
    test.setTimeout(120000)
    for (const path of pages) {
      await page.goto(`/${path}`)
      await expect(page.locator('main h1').first()).toBeVisible({
        timeout: 20000,
      })
      await page.waitForLoadState('networkidle')
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        path,
      ).toBe(true)
      await expect(page.locator('.page-failed,.site-sidebar')).toHaveCount(0)
    }
  },
)
