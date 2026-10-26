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

test('project pagers follow the order of #projects', async ({ page }) => {
  // Every project page has a pager, the long reads included, in the hub's order.
  await page.goto('/#thesis')
  await expect(page.locator('.project-pager .pager-previous')).toHaveAttribute(
    'href',
    '#concepts-profiles',
  )
  await expect(page.locator('.project-pager .pager-next')).toHaveAttribute(
    'href',
    '#drugcomb',
  )
  // The last page has no next project.
  await page.goto('/#drugcomb')
  await expect(page.locator('.project-pager .pager-previous')).toHaveAttribute(
    'href',
    '#thesis',
  )
  await expect(page.locator('.project-pager .pager-next')).toHaveCount(0)
})
