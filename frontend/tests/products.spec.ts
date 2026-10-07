import { test, expect } from './test'

test('project reports keep their data and downloads on their own pages', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#drugcomb')
  const report = page.locator('#drugcomb')
  await expect(report).toContainText('396,498')
  // Report cards: the question in plain words, key figures, one card per result.
  await expect(report.locator('.dc-explain h3')).toHaveCount(3)
  await expect(report.locator('.dash-kpi')).toHaveCount(6)
  await expect(report.locator('.board-card')).toHaveCount(10)
  // The cell lines on a body: one node per tissue of origin, the numbers also as a table.
  const body = report.locator('.body-map')
  await expect(body.locator('.body-node')).toHaveCount(13)
  await body.locator('.body-table summary').click()
  await expect(body.locator('.body-table tbody tr')).toHaveCount(13)
  await expect(body.locator('.body-table')).toContainText('Bone')
  await expect(body.locator('.body-table')).toContainText('23.1 %')
  // The decision tree trained on the screens, and the drugs in clusters, as dashboards.
  const tree = await (
    await page.request.get('/data/products/drugcomb/tree.json')
  ).json()
  // Slicers: a tissue lights up on the body, a leaf's path in the tree.
  await page
    .locator('#dc-body')
    .getByRole('combobox', { name: 'Tissue' })
    .selectOption('Bone')
  await expect(body.locator('.body-caption')).toContainText('Bone')
  const stageTree = page.locator('#dc-tree')
  await expect(stageTree.locator('.dtree-leaf')).toHaveCount(
    tree.metrics.leaves,
  )
  await expect(stageTree).toContainText(String(tree.metrics.roc_auc))
  await stageTree
    .getByRole('combobox', { name: 'Follow a leaf' })
    .selectOption({ index: 1 })
  await expect(stageTree.locator('.dtree-caption li').first()).toBeVisible()
  const sky = await (
    await page.request.get('/data/products/drugcomb/drug-clusters.json')
  ).json()
  const stageSky = page.locator('#dc-sky')
  await expect(stageSky.locator('.dsky-star')).toHaveCount(sky.drugs.length)
  await stageSky.locator('.dsky-legend button').first().click()
  await expect(stageSky.locator('.dsky-legend button').first()).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(report.locator('.dc-checks li.ok')).toHaveCount(10)
  // Choosing a test split changes what the model relies on.
  const card = report.locator('.board-card', {
    hasText: 'What the model relies on',
  })
  const before = await card.locator('.dash-bars').innerText()
  await card.getByRole('button', { name: 'New cell line' }).click()
  await expect(card.locator('.dash-bars')).not.toHaveText(before)
  await page.goto('/#drugcomb-data')
  const drugData = page.locator('#drugcomb-data')
  await expect(
    drugData
      .getByRole('combobox', { name: 'Dataset', exact: true })
      .locator('option'),
  ).toHaveCount(53)
  await expect(drugData.locator('caption')).toHaveText('metrics')
  await drugData
    .getByRole('combobox', { name: 'Evaluation split', exact: true })
    .selectOption('cold_drug')
  await expect(drugData.locator('tbody tr')).toHaveCount(8)
  await expect(
    drugData.getByRole('link', { name: 'Original CSV' }),
  ).toHaveAttribute('href', /metrics.csv$/)
  await page.goto('/#job-data')
  await expect(page.locator('#job-data tbody tr')).toHaveCount(25)
  expect(errors).toEqual([])
})
