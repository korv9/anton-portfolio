import { test, expect } from './test'

test('the cluster visuals draw every clustering from its data and pick a cluster', async ({
  page,
}) => {
  await page.goto('/#cluster-visuals')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Cluster visuals',
  )
  const sections = page.locator('.cv-section')
  await expect(sections).toHaveCount(5)
  // DrugComb's map is small and served with the site: its numbers come from the file.
  const drugs = await (
    await page.request.get('/data/products/drugcomb/drug-clusters.json')
  ).json()
  const drugcomb = page.locator('#cv-drugcomb')
  await drugcomb.scrollIntoViewIfNeeded()
  await expect(drugcomb.locator('canvas')).toHaveAttribute(
    'aria-label',
    new RegExp(`${drugs.drugs.length} points, ${drugs.k} clusters`),
  )
  const first = drugcomb.locator('.cv-legend button').first()
  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  // The philosophy map has two views.
  const philosophy = page.locator('#cv-philosophy')
  await philosophy.scrollIntoViewIfNeeded()
  await philosophy.getByRole('button', { name: 'Raw' }).click()
  await expect(philosophy.locator('canvas')).toBeVisible()
})
