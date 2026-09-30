import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('the job market is a product like politics: one screen, a field bar, one question per theme', async ({
  page,
  isMobile,
}) => {
  await page.goto('/#jobb')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'The job market now',
  )
  // The treemap says the totals and which fields grow; the key figures say the rest.
  await expect(page.locator('.dash-kpi')).toHaveCount(3)
  await expect(page.locator('.dash-card')).toHaveCount(4)
  await expect(page.locator('.jobb-columns rect.recent').first()).toBeVisible()
  // The treemap opens the page; the dashboard under it still fits one screen.
  await expect(page.locator('#treemap')).toBeVisible()
  if (!isMobile) {
    await page.setViewportSize({ width: 1440, height: 900 })
    expect(
      await page.evaluate(
        () =>
          document.querySelector('.jobb-dash')!.getBoundingClientRect().height -
          innerHeight,
      ),
    ).toBeLessThanOrEqual(120)
  }
  const total = await page
    .locator('.dash-kpi dd:not(.dash-kpi-sub)')
    .first()
    .textContent()

  // The field bar: choose Data/IT and every card answers for it.
  const bar = page.getByRole('group', { name: 'Occupation fields' })
  await bar.getByRole('button', { name: 'Data/IT', exact: true }).click()
  await expect(page).toHaveURL(/omraden=/)
  await expect(page.locator('.dash-sub')).toContainText('Data/IT')
  await expect(
    page.locator('.dash-kpi dd:not(.dash-kpi-sub)').first(),
  ).not.toHaveText(total!)

  // The choice follows the reader to every theme.
  const nav = page.getByRole('navigation', { name: 'Job market' })
  for (const [name, question] of [
    ['How are ads developing?', 'How are job ads developing?'],
    ['Which occupations grow?', 'Which occupations are growing?'],
    ['Where are the jobs?', 'Where are the jobs?'],
    ['On what terms?', 'On what terms are people hired?'],
  ]) {
    await nav.getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(question)
    await expect(page).toHaveURL(/omraden=/)
    await expect(page.locator('.theme-chart-title')).toContainText('Data/IT')
    await page.getByRole('tab', { name: 'Table' }).click()
    await expect(page.locator('.theme-table table')).toBeVisible()
  }
  await bar.getByRole('button', { name: 'Show all' }).click()
  await expect(page.locator('.theme-chart-title')).toContainText(
    'the whole market',
  )

  // One chart per field, instead of overlapping lines.
  await page.goto('/#jobb-trender?diagram=omraden')
  await expect(page.locator('.jobb-multiple')).toHaveCount(6)

  // The earlier views live on under "Explore for yourself".
  await page.goto('/#jobb-utforska')
  await expect(page.locator('.explore-row')).toHaveCount(5)
  await page.locator('.explore-row[href="#job-market-occupations"]').click()
  await expect(page.getByTestId('market-occupations')).toBeVisible()
  await expect(
    nav.getByRole('link', { name: 'Explore for yourself' }),
  ).toHaveAttribute('aria-current', 'true')
})

test('the job-market dashboard is accessible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#jobb')
  await expect(page.locator('.dash-card')).toHaveCount(4)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
