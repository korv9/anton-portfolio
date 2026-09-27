import { test, expect } from '@playwright/test'

test('subject and view navigation isolates content and supports back and direct links', async ({
  page,
}) => {
  await page.goto('/#now-decisions')
  const subjects = page.getByRole('navigation', { name: 'Choose a subject' })
  await expect(
    subjects.getByRole('link', { name: 'Politics', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.decision-read')).toHaveCount(5)
  await expect(page.locator('.seat-bar')).toHaveCount(0)
  await page.locator('.topic-tabs a[href="#now-government"]').click()
  await expect(page.locator('.government-facts')).toBeVisible()
  await expect(page.locator('.decision-read')).toHaveCount(0)
  await page.goBack()
  await expect(page.locator('.decision-read')).toHaveCount(5)
  await expect(
    page.locator('.topic-tabs a[href="#now-decisions"]'),
  ).toHaveAttribute('aria-current', 'page')
  await subjects.getByRole('link', { name: 'Welfare', exact: true }).click()
  await expect(page.locator('.welfare-tile').first()).toBeVisible()
  await expect(page.locator('.welfare-explorer')).toHaveCount(0)
  await expect(page.locator('.decision-read')).toHaveCount(0)
  await page.goto('/#analysis-europe')
  await expect(
    page.locator('section[aria-labelledby="analysis-europe"]'),
  ).toBeVisible()
  await expect(
    page.locator('section[aria-labelledby="analysis-counties"]'),
  ).toHaveCount(0)
  await expect(
    page.locator('.topic-tabs a[href="#analysis-europe"]'),
  ).toHaveAttribute('aria-current', 'page')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
