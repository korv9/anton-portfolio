import { test, expect } from '@playwright/test'

test('news: political headlines from SVT, Ekot and the Government, tagged by party', async ({
  page,
}) => {
  await page.goto('/#now-news')
  const list = page.getByTestId('news-list').first()
  await expect(list.locator('li').first()).toBeVisible()
  // Every item links out to its publisher.
  await expect(list.locator('a.news-title').first()).toHaveAttribute(
    'href',
    /^https:\/\//,
  )
  // Filter to one party: every item left names it.
  await page
    .locator('.party-picker .party-chip', { hasText: 'V' })
    .first()
    .click()
  const items = page.locator('.news-item')
  expect(await items.count()).toBeGreaterThan(0)
  for (const item of await items.all())
    await expect(item.locator('.news-tags')).toContainText('V')
  // Forming a government, on the government view.
  await page.goto('/#now-government')
  await expect(
    page.getByRole('heading', { name: /In the news: forming a government/ }),
  ).toBeVisible()
  // And on the party's own page.
  await page.goto('/#parties-v')
  await expect(page.getByTestId('party-news').locator('li')).not.toHaveCount(0)
})
