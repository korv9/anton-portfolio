import { test, expect } from './test'

test('the cluster visuals draw every clustering from its data and pick a cluster', async ({
  page,
}) => {
  await page.goto('/#cluster-visuals')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Cluster visuals',
  )
  await expect(page.locator('.cv-section')).toHaveCount(4)
  // The philosophy map is served with the site: its count comes from the file.
  const atlas = await (
    await page.request.get('/data/philosophy/atlas.json')
  ).json()
  const philosophy = page.locator('#cv-philosophy')
  await philosophy.scrollIntoViewIfNeeded()
  await expect(philosophy.locator('canvas')).toHaveAttribute(
    'aria-label',
    new RegExp(
      `${atlas.author_centered.length.toLocaleString('en-GB')} points`,
    ),
  )
  const first = philosophy.locator('.cv-legend button').first()
  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  // It has two views.
  await philosophy.getByRole('button', { name: 'Raw' }).click()
  await expect(philosophy.locator('canvas')).toBeVisible()
})
