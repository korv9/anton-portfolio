import { test, expect } from './test'

test('the tax theme carries a calculator that responds', async ({ page }) => {
  await page.goto('/#politik-skatter')
  const total = page.getByTestId('tax-total')
  await expect(total).toBeVisible()
  const before = await total.textContent()
  await page.locator('[data-field="salary"]').fill('60000')
  await expect(total).not.toHaveText(before ?? '')
  await expect(page.getByTestId('employer-contributions')).toContainText('kr')
  await expect(page.getByTestId('tax-wedge')).toContainText('%')
  // Capital: an ISK above the tax-free level adds capital tax to the breakdown.
  await page.locator('[data-field="iskCapital"]').fill('1000000')
  await expect(page.locator('.tax-lines')).toContainText('capital income')
})

test('data model: every table, how it connects, and example rows', async ({
  page,
}) => {
  await page.goto('/#data-model-fct_tax_decision_vote')
  await expect(page.getByTestId('dm-detail')).toContainText(
    'gold.fct_tax_decision_vote',
  )
  await expect(
    page.getByTestId('dm-columns').locator('tbody tr'),
  ).not.toHaveCount(0)
  await expect(
    page.getByTestId('dm-sample').locator('tbody tr'),
  ).not.toHaveCount(0)
  // Follow a link upstream to the table it reads from.
  await page
    .getByTestId('dm-lineage')
    .getByRole('link', { name: 'dim_tax_decision' })
    .click()
  await expect(page.getByTestId('dm-detail')).toContainText(
    'gold.dim_tax_decision',
  )
  // Filter the list to one layer.
  await page.locator('[data-field="dm-layer"]').selectOption('bronze')
  await expect(page.getByTestId('dm-list').locator('li').first()).toContainText(
    'stg_',
  )
})
