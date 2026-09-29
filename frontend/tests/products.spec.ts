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
  await expect(report.locator('.board-card')).toHaveCount(11)
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
  await page.goto('/#raw-data')
  const politicsData = page.locator('#raw-data')
  await expect(politicsData).toContainText('1,161 matching rows of 1,161')
  await politicsData
    .getByRole('button', { name: 'All decision points' })
    .click()
  await expect(politicsData).toContainText('4,407 matching rows of 4,407')
  expect(errors).toEqual([])
})
