/**
 * Every card on #projects opens a finished project page that ends with its own content.
 */
import { test, expect } from './test'

test('every project card opens its page, which ends with its own content', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/#projects')
  await page.locator('main a.hub-item').first().waitFor()
  const cards = await page
    .locator('main a.hub-item[href^="#"]')
    .evaluateAll((as) => [
      ...new Set(as.map((a) => a.getAttribute('href')!.split('?')[0])),
    ])
  expect(cards.length).toBeGreaterThanOrEqual(13)
  for (const href of cards) {
    await page.goto('/' + href)
    await expect(page.locator('main h1').first(), href).toBeVisible()
    // No shared close or pager: the index on the left is the way on.
    await expect(
      page.locator('.project-brief, .project-pager'),
      href,
    ).toHaveCount(0)
  }
})

test('the Homie card opens its repository', async ({ page }) => {
  await page.goto('/#projects')
  await expect(
    page.locator('main a.hub-item[href="https://github.com/korv9/homie-api"]'),
  ).toHaveCount(1)
})
