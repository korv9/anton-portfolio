import { test, expect } from './test'

test('one politics navigation isolates content and supports back and direct links', async ({
  page,
}) => {
  await page.goto('/#now-decisions')
  const politics = page.getByRole('navigation', { name: 'Politics' })
  await expect(politics.getByRole('link')).toHaveCount(13)
  await expect(
    politics.getByRole('link', { name: /Overview/ }),
  ).toHaveAttribute('aria-current', 'true')
  // Only one navigation for politics: the older subject and view menus are gone.
  await expect(
    page.getByRole('navigation', { name: 'Choose a subject' }),
  ).toHaveCount(0)
  await expect(page.locator('.decision-read')).toHaveCount(5)
  await expect(page.locator('.story-seatbar')).toHaveCount(0)
  await politics.getByRole('link', { name: /Overview/ }).click()
  await expect(page.locator('.story-seatbar')).toBeVisible()
  await expect(page.locator('.decision-read')).toHaveCount(0)
  await expect(
    politics.getByRole('link', { name: /Overview/ }),
  ).toHaveAttribute('aria-current', 'page')
  await page.goBack()
  await expect(page.locator('.decision-read')).toHaveCount(5)
  await page.goto('/#sweden')
  await expect(page.locator('.welfare-tile').first()).toBeVisible()
  await expect(page.locator('.welfare-explorer')).toHaveCount(0)
  await expect(page.locator('.decision-read')).toHaveCount(0)
  await expect(page.locator('.project-bar a')).toHaveAttribute(
    'href',
    '#projekt',
  )
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
