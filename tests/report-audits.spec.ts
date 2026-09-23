import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('budget corpus and NLP choices update all comparison data', async ({
  page,
}) => {
  await page.goto('/#budget-comparison')
  const budget = page.locator('#budget-comparison')
  await expect(budget.locator('.budget-overview-grid article')).toHaveCount(8)
  await expect(budget.locator('.language-audit')).toContainText('98 of 216')
  await budget.getByLabel('Speech corpus').selectOption('issues')
  await expect(budget.locator('.language-audit')).toContainText('8 of 216')
  await expect(
    budget.locator('.party-area-row').filter({ hasText: /^M\b/ }),
  ).not.toContainText('/ 0.0%')
  await budget.getByLabel('Language method').selectOption('stem')
  await expect(budget.locator('.language-audit')).toContainText('6 of 216')
  await budget.getByText('Inspect coverage and matching words').click()
  await expect(budget.locator('.language-audit tbody tr')).toHaveCount(8)
  await expect(budget.locator('.language-audit')).toContainText(
    'Dictionary for the selected area: sjukvård, vård, tandvård',
  )
  await budget
    .locator('.budget-overview-grid article')
    .filter({ has: page.getByRole('heading', { name: 'S', exact: true }) })
    .getByRole('button')
    .first()
    .click()
  await expect(
    budget.getByRole('combobox', { name: 'Party', exact: true }),
  ).toHaveValue('S')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  const results = await new AxeBuilder({ page })
    .include('#budget-comparison')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('RFC report separates observed profiles from synthetic direction', async ({
  page,
}) => {
  await page.goto('/#rfc-drift')
  const report = page.locator('#rfc-drift')
  await expect(report.locator('.rfc-version')).toHaveCount(2)
  await expect(report.locator('.rfc-version').first()).toContainText(
    '78 extracted statements',
  )
  await expect(report.locator('.engine-result')).toContainText('loosening')
  await report.getByLabel('Requirement change').selectOption('1')
  await expect(report.locator('.engine-result')).toContainText('tightening')
  await report.getByLabel('Requirement change').selectOption('2')
  await expect(report.locator('.engine-result')).toContainText('neutral')
  await expect(report).toContainText('0 matched keyword changes')
  await expect(report).toContainText('Synthetic example')
  await report.getByText('Method, sources & limitations').click()
  const results = await new AxeBuilder({ page })
    .include('#rfc-drift')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
