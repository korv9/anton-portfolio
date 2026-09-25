import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('home introduces Anton and routes to each project', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Data Engineer',
  )
  await expect(page.locator('.about-profile')).toContainText('Fora')
  await expect(page.locator('.about-profile')).toContainText('Avtalat')
  await expect(page.locator('.product-cards > article')).toHaveCount(6)
  await expect(page.locator('#job-market')).toHaveCount(0)
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click()
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Politics' })
    .click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Swedish politics',
  )
  await expect(page.locator('.page-tabs a')).toHaveCount(5)
  await page.goto('/#job-market')
  await expect(page.locator('#job-market')).toBeVisible()
  await expect(page.getByText('35,726', { exact: true })).toBeVisible()
  await page.goto('/#drugcomb')
  await expect(page.locator('#drugcomb')).toContainText('396,498')
  await page.goto('/#rfc-drift')
  await expect(page.locator('#rfc-drift')).toBeVisible()
  await page.goto('/#thesis')
  await expect(page.locator('#thesis')).toContainText('review candidates')
  await page.goto('/#homie')
  await expect(page.locator('#homie')).toBeVisible()
  expect(errors).toEqual([])
})

test('language map and job chart retain useful controls', async ({ page }) => {
  await page.goto('/#debates')
  await expect(page.locator('.umap-point')).toHaveCount(400)
  await page.getByRole('button', { name: '2022/23' }).click()
  await expect(page.locator('.point-detail')).toContainText('Selected segment')
  await page.locator('.viz-toolbar select').selectOption('MP')
  expect(await page.locator('.umap-point').count()).toBeGreaterThan(0)
  await expect(page.locator('.umap-guide')).toContainText(
    'not agreement or a political position',
  )
  await page.goto('/#job-market')
  await page.getByRole('button', { name: 'Data Engineer', exact: true }).click()
  await expect(page.locator('.job-chart-head')).toContainText('Data Engineer')
  await expect(page.locator('.year-totals')).toContainText('628')
})

test('navigation, responsive layout and accessibility', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('link', { name: 'Download CV' }).first(),
  ).toHaveAttribute('download', '')
  for (const route of [
    '/',
    '/#politics',
    '/#budget-comparison',
    '/#drugcomb',
  ]) {
    await page.goto(route)
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true)
    }
  }
  await page.goto('/')
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('A')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('budget proposals and annual outcomes are separate navigable reports', async ({
  page,
}) => {
  await page.goto('/#budget-comparison')
  const budget = page.locator('#budget-comparison')
  await expect(budget.locator('.budget-ledger-summary')).toContainText('2026')
  await expect(budget.locator('.budget-ledger-summary')).toContainText('27/27')
  await expect(budget.locator('.budget-ledger-bar')).toHaveCount(7)
  await expect(budget.locator('.budget-vote')).toHaveCount(8)
  await expect(budget.locator('.budget-year-context')).toContainText(
    'Budget agreement with SD',
  )
  await budget
    .getByRole('combobox', { name: 'Budget year', exact: true })
    .selectOption('2017/18')
  await expect(budget.locator('.budget-ledger-summary')).toContainText('21/27')
  await expect(budget.locator('.budget-ledger-summary')).toContainText(
    'Incomplete',
  )
  await expect(budget.locator('.budget-ledger-bar')).toHaveCount(0)
  await budget
    .getByRole('combobox', { name: 'Budget year', exact: true })
    .selectOption('2021/22')
  await expect(budget.locator('.budget-year-context')).toContainText(
    'Opposition alternative',
  )
  await expect(budget.locator('.budget-year-context')).toContainText(
    'M · SD · KD',
  )
  await budget
    .getByRole('combobox', { name: 'Budget year', exact: true })
    .selectOption('2025/26')
  await budget
    .getByRole('combobox', { name: 'Proposal', exact: true })
    .selectOption('V')
  await expect(budget.locator('.budget-ledger-detail')).toContainText(
    'relative to government',
  )
  await budget.getByText('View all 27 expenditure areas').click()
  await expect(budget.locator('.budget-ledger-all tbody tr')).toHaveCount(27)
  await expect(page.locator('#budget-outturn')).toContainText('1997–2025')
  await page.getByLabel('Annual account year').selectOption('2024')
  await expect(
    page.locator('#budget-outturn .budget-ledger-all summary'),
  ).toContainText('2024')
})
