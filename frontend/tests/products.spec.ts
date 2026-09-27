import { test, expect } from '@playwright/test'

test('project reports keep their data and downloads on their own pages', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#drugcomb')
  const report = page.locator('#drugcomb')
  await expect(report).toContainText('396,498')
  await expect(report.locator('[role="img"]')).toHaveCount(4)
  const before = await report.locator('.research-bars').first().innerText()
  await report.getByLabel('Feature set / model').selectOption('history_ridge')
  await expect(report.locator('.research-bars').first()).not.toHaveText(before)
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
  await expect(politicsData).toContainText('1,104 matching rows of 1,104')
  await politicsData
    .getByRole('button', { name: 'All decision points' })
    .click()
  await expect(politicsData).toContainText('4,407 matching rows of 4,407')
  expect(errors).toEqual([])
})
