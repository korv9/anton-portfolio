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

test(
  'on a phone the projects index slides out from the left edge',
  { tag: '@mobile' },
  async ({ page, isMobile }) => {
    test.skip(!isMobile, 'wide screens show the index beside the page')
    await page.goto('/#thesis')
    const rail = page.locator('.project-rail')
    await expect(rail).toBeHidden()
    await page.getByRole('button', { name: 'Index' }).click()
    await expect(rail).toBeVisible()
    await rail.getByRole('link', { name: 'Replik' }).click()
    await expect(page).toHaveURL(/#replik$/)
    await expect(rail).toBeHidden()
  },
)
