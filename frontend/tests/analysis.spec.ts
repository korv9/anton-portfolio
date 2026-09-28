import { test, expect } from '@playwright/test'

test('analysis page: county scatter, monthly series, Europe and the models', async ({
  page,
}) => {
  await page.goto('/#analysis')
  await expect(
    page.getByRole('heading', { name: 'Two measures, 21 counties' }),
  ).toBeVisible()

  // Every county with both measures (AKU leaves out some small counties) and the country,
  // which is labelled rather than told apart by colour alone.
  const counties = page.locator('section[aria-labelledby="analysis-counties"]')
  expect(await counties.locator('.scatter-dot').count()).toBeGreaterThan(15)
  await expect(counties.locator('.scatter-reference')).toHaveText('Sweden')
  const r = page.getByTestId('county-correlation')
  await expect(r).toContainText('r =')
  const before = await r.textContent()
  await counties
    .locator('.slicers select')
    .nth(1)
    .selectOption('social_assistance_pct')
  await expect(r).not.toHaveText(before ?? '')
  await counties.locator('.scatter-dot').first().focus()
  await expect(counties.locator('.chart-tooltip')).toBeVisible()

  // Month-by-month series switch without a second axis.
  await page.locator('.topic-tabs a[href="#analysis-months"]').click()
  const months = page.locator('section[aria-labelledby="analysis-months"]')
  await expect(months.locator('polyline')).toHaveCount(3)
  await months.locator('select').selectOption('sick_pay')
  await expect(months.locator('polyline')).toHaveCount(1)

  // Sweden and its neighbours in the European Social Survey.
  await page.locator('.topic-tabs a[href="#analysis-europe"]').click()
  const europe = page.locator('section[aria-labelledby="analysis-europe"]')
  await expect(europe.locator('polyline')).toHaveCount(5)

  // The promoted polarization result, and every model with its verdict.
  await page.locator('.topic-tabs a[href="#analysis-parties"]').click()
  const parties = page.locator('section[aria-labelledby="analysis-parties"]')
  await expect(parties.locator('polyline')).toHaveCount(3)
  await expect(parties.locator('.analysis-eras tbody tr')).toHaveCount(3)
  await page.locator('.topic-tabs a[href="#analysis-models"]').click()
  await expect(page.locator('.model-card')).toHaveCount(3)
  await expect(
    page.locator('.model-card .status-badge.failing'),
  ).not.toHaveCount(0)
})
