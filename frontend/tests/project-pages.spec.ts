/**
 * Every project in the index opens a finished project page that ends with its own content.
 */
import { test, expect } from './test'

test('every project in the index opens its page, which ends with its own content', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/#projects')
  const links = await page
    .locator('nav.project-rail a[href^="#"]')
    .evaluateAll((as) => [
      ...new Set(as.map((a) => a.getAttribute('href')!.split('?')[0])),
    ])
  expect(links.length).toBeGreaterThanOrEqual(13)
  for (const href of links) {
    await page.goto('/' + href)
    await expect(page.locator('main h1').first(), href).toBeVisible()
    // No shared close or pager: the index on the left is the way on.
    await expect(
      page.locator('.project-brief, .project-pager'),
      href,
    ).toHaveCount(0)
  }
})

test('Homie is not in the index, but its page still opens', async ({
  page,
}) => {
  await page.goto('/#projects')
  await expect(page.locator('nav.project-rail a[href*="homie"]')).toHaveCount(0)
  await page.goto('/#homie')
  await expect(page.locator('main h1').first()).toBeVisible()
})
