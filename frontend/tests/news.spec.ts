import { test, expect } from '@playwright/test'

type Item = { parties: string[]; topics: string[]; url: string }

test('news: political headlines from SVT, Ekot and the Government, tagged by party', async ({
  page,
}) => {
  // The news changes every few hours, so the expectations come from the file the site reads.
  const news = await (
    await page.request.get('/data/parliament/news.json')
  ).json()
  const items: Item[] = news.items
  test.skip(items.length === 0, 'No news collected yet')

  await page.goto('/#now-news')
  const list = page.getByTestId('news-list').first()
  await expect(list.locator('li').first()).toBeVisible()
  // Every item links out to its publisher.
  await expect(list.locator('a.news-title').first()).toHaveAttribute(
    'href',
    /^https:\/\//,
  )

  // Filter to the party named most often: every item left names it.
  const counts = new Map<string, number>()
  for (const item of items)
    for (const p of item.parties) counts.set(p, (counts.get(p) ?? 0) + 1)
  const party = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (party) {
    await page
      .locator('.party-picker .party-chip')
      .filter({ hasText: new RegExp(`^${party}\\d`) })
      .click()
    const shown = page.locator('.news-item')
    expect(await shown.count()).toBeGreaterThan(0)
    for (const item of await shown.all())
      await expect(item.locator('.news-tags')).toContainText(party)

    // And on the party's own page.
    await page.goto(`/#parties-${party.toLowerCase()}`)
    await expect(page.getByTestId('party-news').locator('li')).not.toHaveCount(
      0,
    )
  }

  // Forming a government, on the government view, when there is news about it.
  await page.goto('/#now-government')
  const heading = page.getByRole('heading', {
    name: /In the news: forming a government/,
  })
  if (items.some((i) => i.topics.includes('regeringsbildning')))
    await expect(heading).toBeVisible()
  else await expect(heading).toHaveCount(0)
})
