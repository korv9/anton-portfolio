import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('reports load real data and interactions work', async ({ page, isMobile }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Data Engineer')
  await expect(page.getByText('39,269', { exact: true })).toBeVisible()
  await expect(page.locator('.umap-point')).toHaveCount(400)

  await page.getByRole('button', { name: '2022/23' }).click()
  await expect(page.locator('.point-detail')).toContainText('Selected segment')
  await page.locator('.viz-toolbar select').selectOption('MP')
  expect(await page.locator('.umap-point').count()).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Data Engineer', exact: true }).click()
  await expect(page.locator('.job-chart-head')).toContainText('Data Engineer')
  await expect(page.locator('.year-totals')).toContainText('628')

  if (isMobile) {
    await page.getByRole('button', { name: 'Menu' }).click()
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveClass(/open/)
  }
  expect(errors).toEqual([])
})

test('anchors, downloads and responsive layout work', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  const broken = await page.locator('a[href^="#"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')!).filter((href) => !document.getElementById(href.slice(1))))
  expect(broken).toEqual([])
  await expect(page.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/in/anton-ernstsson')
  await expect(page.getByRole('link', { name: 'Download CV' }).first()).toHaveAttribute('download', '')
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('keyboard path and expanded content pass WCAG AA checks', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.locator('details').evaluateAll((elements) => elements.forEach((element) => element.setAttribute('open', '')))
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(results.violations).toEqual([])
})

test('budget comparison uses exported values and linked controls', async ({ page }) => {
  await page.goto('/#debates')
  const lab = page.locator('.budget-lab')
  await expect(lab.getByRole('heading', { name: 'Do parties talk about where they put money?' })).toBeVisible()
  await expect(lab.getByRole('combobox', { name: 'Party' })).toHaveValue('ALL')
  await expect(lab.locator('.budget-dot')).toHaveCount(108)
  await expect(lab.locator('.party-area-comparison')).toContainText('Health & social care · all eight parties')
  await expect(lab.locator('.party-area-row')).toHaveCount(8)
  await expect(lab.locator('.party-area-row').filter({ hasText: 'KD' })).toContainText('— / 26.3%')
  await expect(lab.locator('.party-mini')).toHaveCount(4)
  await expect(lab.locator('.party-correlation-grid > div')).toHaveCount(4)
  await expect(lab.locator('.budget-party-status')).toContainText('M debate only')
  await expect(lab.locator('.budget-party-status')).toContainText('SD debate only')
  await lab.getByText('Coverage: all eight parties and missing budget data').click()
  await expect(lab.locator('.coverage-details .coverage-scroll tbody tr')).toHaveCount(12)
  await expect(lab.locator('.coverage-details .coverage-scroll tbody')).toContainText('21/27')
  await expect(lab.getByRole('combobox', { name: 'Session' }).locator('option')).toHaveCount(6)
  await lab.getByRole('combobox', { name: 'Party' }).selectOption('S')
  await expect(lab.locator('.budget-selection').first()).toContainText('Budget 8.5%')
  await expect(lab.locator('.budget-selection').first()).toContainText('Keywords 11.1%')
  await lab.getByRole('combobox', { name: 'Party' }).selectOption('V')
  await expect(lab.locator('.budget-dot')).toHaveCount(27)
  await expect(lab.locator('.budget-selection').last()).toContainText('V · Health & social care')
  await expect(lab.locator('.correlation-panel')).toContainText('for V')
  expect(await lab.locator('.correlation-row').count()).toBeGreaterThan(1)
  await lab.getByRole('combobox', { name: 'Session' }).selectOption('2024/25')
  await expect(lab.locator('.budget-dot')).toHaveCount(27)
  expect(await lab.locator('.heatmap-cell').count()).toBeGreaterThan(0)
  await lab.getByRole('combobox', { name: 'Expenditure area' }).selectOption('20')
  await expect(lab.locator('.budget-selection').last()).toContainText('Climate & environment')
  await lab.getByRole('combobox', { name: 'Session' }).selectOption('2016/17')
  await expect(lab.getByRole('combobox', { name: 'Party' })).toHaveValue('ALL')
  await expect(lab.locator('.party-area-row')).toHaveCount(8)
  await expect(lab.locator('.budget-dot')).toHaveCount(135)
})

