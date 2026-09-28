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
  const wedge = page.getByTestId('tax-wedge-ranking')
  expect(await wedge.locator('li').count()).toBeGreaterThan(35)
  await expect(wedge.locator('li.highlight')).toContainText('Sweden')

  // The calculator: a higher salary means more tax, and the employer's side is shown.
  await page
    .locator('.taxes-page .topic-tabs a[href="#taxes-calculator"]')
    .click()
  const total = page.getByTestId('tax-total')
  const before = await total.textContent()
  await page.locator('[data-field="salary"]').fill('60000')
  await expect(total).not.toHaveText(before ?? '')
  await expect(page.getByTestId('employer-contributions')).toContainText('kr')
  await expect(page.getByTestId('tax-wedge')).toContainText('%')
  // Capital: an ISK above the tax-free level adds capital tax to the breakdown.
  await page.locator('[data-field="iskCapital"]').fill('1000000')
  await expect(page.locator('.tax-lines')).toContainText('capital income')

  // What the decisions since 2016 did to this tax, year by year, tied to the decisions.
  const changes = page.getByTestId('tax-changes')
  await expect(changes.locator('tbody tr')).toHaveCount(10)
  await expect(changes).toContainText('In-work tax credit')
  // VAT for a household, and the fuel decisions for the litres entered.
  await expect(
    page.getByTestId('household-vat').locator('tbody tr'),
  ).not.toHaveCount(0)
  await page.locator('[data-field="petrol-litres"]').fill('800')
  await expect(
    page.getByTestId('fuel-effects').locator('tbody tr'),
  ).not.toHaveCount(0)
})

test('tax decisions: when each tax last changed, who voted how, the studies behind', async ({
  page,
}) => {
  await page.goto('/#taxes-decisions')
  await expect(
    page.getByTestId('last-changed').locator('tbody tr'),
  ).not.toHaveCount(0)
  const decisions = page.getByTestId('tax-decision')
  expect(await decisions.count()).toBeGreaterThan(30)
  // The 2020 abolition of the top rate, with the parties' votes and its bill.
  const varnskatt = decisions.filter({ hasText: 'värnskatt' })
  await expect(varnskatt.locator('.positions li')).not.toHaveCount(0)
  await expect(varnskatt).toContainText('2019/20:1')
})

test('studies: the latest government studies and the laws they led to', async ({
  page,
}) => {
  await page.goto('/#now-studies')
  await expect(page.getByTestId('studies-summary').locator('li')).toHaveCount(3)
  const list = page.getByTestId('study-list')
  expect(await list.locator('li').count()).toBeGreaterThan(20)
  await page.locator('[data-field="study-kind"]').selectOption('sou')
  await expect(list.locator('li').first()).toContainText('SOU')
  await expect(
    page.getByTestId('recent-laws').locator('.study-links').first(),
  ).toBeVisible()
})
