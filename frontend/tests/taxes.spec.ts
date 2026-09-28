import { test, expect } from '@playwright/test'

test('taxes: Sweden by type, other countries, and a calculator that responds', async ({
  page,
}) => {
  await page.goto('/#taxes')
  await expect(
    page.getByRole('heading', { level: 1, name: /What Sweden taxes/ }),
  ).toBeVisible()
  await expect(page.getByTestId('tax-summary').locator('li')).toHaveCount(3)
  await expect(page.getByTestId('tax-types').locator('li')).not.toHaveCount(0)

  // Every OECD country for the chosen tax, Sweden marked.
  const ranking = page.getByTestId('tax-ranking')
  expect(await ranking.locator('li').count()).toBeGreaterThan(35)
  await expect(ranking.locator('li.highlight')).toContainText('Sweden')
  await page.locator('[data-field="compare-type"]').selectOption('T_5111')
  await expect(ranking.locator('li.highlight')).toContainText('Sweden')

  // The calculator: a higher salary means more tax, and the employer's side is shown.
  const total = page.getByTestId('tax-total')
  const before = await total.textContent()
  await page.locator('[data-field="salary"]').fill('60000')
  await expect(total).not.toHaveText(before ?? '')
  await expect(page.getByTestId('employer-contributions')).toContainText('kr')
  await expect(page.getByTestId('tax-wedge')).toContainText('%')
  // Capital: an ISK above the tax-free level adds capital tax to the breakdown.
  await page.locator('[data-field="iskCapital"]').fill('1000000')
  await expect(page.locator('.tax-lines')).toContainText('capital income')

  // The same salary elsewhere: every country's tax wedge, Sweden marked.
  const wedge = page.getByTestId('tax-wedge-ranking')
  expect(await wedge.locator('li').count()).toBeGreaterThan(35)
  await expect(wedge.locator('li.highlight')).toContainText('Sweden')
})
