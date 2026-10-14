import { test, expect } from './test'

test(
  'project reports keep their data and downloads on their own pages',
  { tag: '@mobile' },
  async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/#drugcomb')
    const intro = page.locator('.politik-intro')
    await expect(intro).toContainText('396,498')
    // One question per tab: the splits, then what it finds and whether it is calibrated.
    await expect(page.locator('.report-tab .feature')).toHaveCount(3)
    await page.getByRole('button', { name: 'New drug', exact: true }).click()
    await expect(page).toHaveURL(/uppdelning=cold_drug/)
    await expect(page.locator('#dc-splits-title')).toContainText('new drug')
    // What it learns: the tree trained on the screens, the features and a check against luck.
    const tree = await (
      await page.request.get('/data/products/drugcomb/tree.json')
    ).json()
    await page.getByRole('link', { name: 'What it learns' }).click()
    await expect(page).toHaveURL(/drugcomb-model\?uppdelning=cold_drug/)
    const stageTree = page.locator('#dc-tree')
    await expect(stageTree.locator('.dtree-leaf')).toHaveCount(
      tree.metrics.leaves,
    )
    await stageTree
      .getByRole('combobox', { name: 'Follow a leaf' })
      .selectOption({ index: 1 })
    await expect(stageTree.locator('.dtree-caption li').first()).toBeVisible()
    // Choosing a test split changes what the model relies on.
    const families = page.locator('#dc-families')
    const before = await families.locator('.rank-bars').innerText()
    await page.getByRole('button', { name: 'New cell line' }).click()
    await expect(families.locator('.rank-bars')).not.toHaveText(before)
    // The cell lines on a body, one node per tissue of origin, and the drugs in clusters.
    await page.getByRole('link', { name: 'Cells and drugs' }).click()
    const body = page.locator('.body-map')
    await expect(body.locator('.body-node')).toHaveCount(13)
    await body.locator('.body-table summary').click()
    await expect(body.locator('.body-table tbody tr')).toHaveCount(13)
    await expect(body.locator('.body-table')).toContainText('Bone')
    await expect(body.locator('.body-table')).toContainText('23.1 %')
    await page
      .locator('#dc-body')
      .getByRole('combobox', { name: 'Tissue' })
      .selectOption('Bone')
    await expect(body.locator('.body-caption')).toContainText('Bone')
    const sky = await (
      await page.request.get('/data/products/drugcomb/drug-clusters.json')
    ).json()
    const stageSky = page.locator('#dc-sky')
    await expect(stageSky.locator('.dsky-star')).toHaveCount(sky.drugs.length)
    await stageSky.locator('.dsky-legend button').first().click()
    await expect(
      stageSky.locator('.dsky-legend button').first(),
    ).toHaveAttribute('aria-pressed', 'true')
    // The checks and the method are deep dives of their own.
    await page.goto('/#drugcomb-quality')
    await expect(page.locator('.dc-checks li.ok')).toHaveCount(10)
    await page.goto('/#drugcomb-method')
    await expect(page.locator('.dc-explain-grid h2')).toHaveCount(3)
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
  },
)
