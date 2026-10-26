/**
 * Every card on #projects opens a finished project page: the page's own content, then the shared
 * close from the sketches (question, work, findings, steps, tech and limits) and a pager.
 */
import { test, expect } from './test'

test('every project card opens a page that ends in the shared template', async ({
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
    const brief = page.locator('.project-brief')
    await expect(brief, href).toHaveCount(1)
    for (const part of [
      'The question',
      'What I built',
      'What it shows',
      'How it works',
      'Honest limits',
    ])
      await expect(
        brief.getByRole('heading', { name: part, exact: true }),
        `${href}: ${part}`,
      ).toBeAttached()
    await expect(page.locator('.project-pager a').first(), href).toBeAttached()
  }
})

test('the shared template reads in Swedish', async ({ page }) => {
  await page.goto('/?lang=sv#thesis')
  const brief = page.locator('.project-brief')
  await expect(
    brief.getByRole('heading', { name: 'Frågan', exact: true }),
  ).toBeAttached()
  await expect(
    brief.getByRole('heading', { name: 'Ärliga begränsningar', exact: true }),
  ).toBeAttached()
})

test('the Homie card opens its repository', async ({ page }) => {
  await page.goto('/#projects')
  await expect(
    page.locator('main a.hub-item[href="https://github.com/korv9/homie-api"]'),
  ).toHaveCount(1)
})
