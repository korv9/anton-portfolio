import { test, expect } from './test'

test('job market: every occupation since 2020, by field, occupation, county and conditions', async ({
  page,
}) => {
  await page.goto('/#job-market')
  await expect(
    page.getByTestId('market-summary').locator('li'),
  ).not.toHaveCount(0)
  // Every occupation field, not only IT.
  const fields = page.getByTestId('market-fields').locator('tbody tr')
  expect(await fields.count()).toBeGreaterThan(15)
  await expect(page.getByTestId('market-fields')).toContainText('Health care')
  await expect(page.locator('.multi-chart polyline')).toHaveCount(1)
  await page.locator('.market-field-picker summary').click()
  await page.getByRole('button', { name: 'Data/IT', exact: true }).click()
  await expect(page.locator('.multi-chart polyline')).toHaveCount(2)

  // Occupation groups, filtered by field and searched.
  await page.locator('.topic-tabs a[href="#job-market-occupations"]').click()
  const occupations = page.getByTestId('market-occupations').locator('tbody tr')
  await expect(occupations).toHaveCount(30)
  await page.locator('[data-field="market-search"]').fill('sjuksköterskor')
  await expect(occupations.first()).toContainText('juksköterskor')
  await occupations.first().getByRole('button').click()
  await expect(page.locator('.year-bars li').first()).toContainText('2020')

  // Counties, and conditions of employment.
  await page.locator('.topic-tabs a[href="#job-market-regions"]').click()
  await expect(page.getByTestId('market-regions')).toContainText(
    'Stockholms län',
  )
  await page.locator('.topic-tabs a[href="#job-market-conditions"]').click()
  await expect(page.getByTestId('market-conditions')).toContainText(
    'Regular employment',
  )

  // The IT report is still there.
  await page.locator('.topic-tabs a[href="#job-market-tech"]').click()
  await expect(page.locator('#job-market')).toBeVisible()
})

test('indexed comparisons share a baseline, retain colours and work with the keyboard', async ({
  page,
}) => {
  await page.goto('/#job-market')
  await page.locator('.market-field-picker summary').click()
  await page.getByRole('button', { name: 'Data/IT', exact: true }).click()
  const lines = page.locator('.multi-chart polyline')
  await expect(lines).toHaveCount(2)
  const itColour = await lines.nth(1).getAttribute('stroke')
  await page.getByLabel('Measure', { exact: true }).selectOption('index')
  const starts = await lines.evaluateAll((elements) =>
    elements.map((el) => el.getAttribute('points')!.split(' ')[0]),
  )
  expect(starts[0]).toBe(starts[1])
  const chart = page.getByRole('img', { name: 'Job ads, indexed development' })
  await chart.focus()
  await chart.press('Home')
  await expect(page.locator('.chart-tooltip strong')).toHaveText(['100', '100'])
  await chart.press('ArrowRight')
  await expect(page.locator('.chart-tooltip')).toContainText('February 2020')
  await page
    .getByRole('button', { name: 'All occupations', exact: true })
    .click()
  await expect(lines).toHaveCount(1)
  await expect(lines).toHaveAttribute('stroke', itColour!)
  await page.getByRole('button', { name: 'Data/IT', exact: true }).click()
  await expect(lines).toHaveCount(1)
  expect(
    await page
      .locator('.multi-chart .chart-wrap')
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true)
})
