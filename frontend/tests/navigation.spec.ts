import { test, expect } from './test'

test(
  'the header links only to About and GitHub',
  { tag: '@mobile' },
  async ({ page, isMobile }) => {
    // Wide screens show the projects index instead (project-rail.css).
    test.skip(!isMobile, 'the header is a phone header')
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
