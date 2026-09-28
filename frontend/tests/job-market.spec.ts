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
