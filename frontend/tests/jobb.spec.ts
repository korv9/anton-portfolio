import { test, expect } from './test'
test('the labour-market report keeps the chosen fields across tabs and deep dives', async ({
  page,
}) => {
  await page.goto('/#jobb')
  const tabs = page.getByRole('navigation', { name: 'Report' })
  await expect(tabs.getByRole('link')).toHaveCount(3)
  const fields = page.getByRole('group', { name: 'Occupation fields' })
  await fields.getByRole('button', { name: 'Data/IT', exact: true }).click()
  await expect(page.locator('#annonser h2')).toContainText('Data/IT')
  await page.locator('#annonser .feature-table summary').click()
  await expect(page.locator('#annonser .feature-table table')).toBeVisible()
  for (const [tab, question, chart] of [
    ['Regional labour market', 'Where in Sweden are the jobs?', '#lan'],
    [
      'Employment conditions',
      'On what terms are people hired?',
      '#anstallning',
    ],
  ]) {
    await tabs.getByRole('link', { name: tab }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(question)
    await expect(page).toHaveURL(/omraden=/)
    await expect(page.locator(`${chart} h2`)).toContainText('Data/IT')
    await expect(page.locator('.report-tab .feature')).toHaveCount(3)
  }
  // A deep dive answers for the same fields, and keeps its table.
  await page
    .getByRole('navigation', { name: 'Go deeper' })
    .getByRole('link', { name: /Occupations/ })
    .click()
  await expect(page).toHaveURL(/jobb-yrken\?omraden=/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Which occupations are growing?',
  )
  await expect(page.locator('.theme-chart-title')).toContainText('Data/IT')
  await page.getByRole('tab', { name: 'Table', exact: true }).click()
  await expect(page.locator('.theme-table table')).toBeVisible()
  await fields.getByRole('button', { name: 'Data/IT', exact: true }).click()
  await page.goto('/#jobb-trender?diagram=omraden')
  await expect(page.locator('.jobb-multiple')).toHaveCount(6)
})
