import { test, expect } from './test'
test('job topics retain filters and expose their data tables', async ({
  page,
}) => {
  await page.goto('/#jobb')
  await expect(page.locator('.overview-topics > a')).toHaveCount(5)
  await page.locator('a[href="#jobb-trender"]').first().click()
  const bar = page.getByRole('group', { name: 'Occupation fields' })
  await bar.getByRole('button', { name: 'Data/IT', exact: true }).click()
  for (const [path, question] of [
    ['#jobb-trender', 'How are job ads developing?'],
    ['#jobb-yrken', 'Which occupations are growing?'],
    ['#jobb-lan', 'Where are the jobs?'],
    ['#jobb-villkor', 'On what terms are people hired?'],
  ]) {
    await page.goto(`/${path}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(question)
    await expect(page).toHaveURL(/omraden=/)
    await expect(page.locator('.theme-chart-title')).toContainText('Data/IT')
    await page.getByRole('tab', { name: 'Table', exact: true }).click()
    await expect(page.locator('.theme-table table')).toBeVisible()
  }
  await page
    .getByRole('group', { name: 'Occupation fields' })
    .getByRole('button', { name: 'Show all' })
    .click()
  await page.goto('/#jobb-trender?diagram=omraden')
  await expect(page.locator('.jobb-multiple')).toHaveCount(6)
})
