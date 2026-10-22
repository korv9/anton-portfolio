import { test, expect } from './test'

test(
  'the header links only to About and GitHub',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#thesis')
    const header = page.locator('.site-navigation')
    await expect(header.locator('a')).toHaveCount(2)
    await expect(header.locator('a[href="#om-mig"]')).toBeVisible()
    await expect(
      header.locator('a[href="https://github.com/korv9"]'),
    ).toBeVisible()
    await expect(page.locator('.project-menu')).toHaveCount(0)
  },
)

test('project pagers follow the groups', async ({ page }) => {
  // The labs open as reports without a pager; the engineering pages keep it.
  await page.goto('/#thesis')
  await expect(page.locator('.project-pager .pager-previous')).toContainText(
    'Drug Synergy Lab',
  )
  await page.goto('/#diva-lakehouse')
  await expect(page.locator('.project-pager .pager-previous')).toContainText(
    'Homie API',
  )
  await expect(page.locator('.project-pager .pager-next')).toHaveCount(0)
})
