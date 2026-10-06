import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('the quality page separates data quality from validity and shows every check', async ({
  page,
}) => {
  await page.goto('/#quality')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Quality & Validity' }),
  ).toBeVisible()
  await expect(page.locator('.q-matrix').first()).toContainText(
    'Symbolic Atlas',
  )
  await expect(page.locator('.q-matrix').first()).toContainText('not measured')
  await expect(page.locator('#quality-symbolic')).toContainText('Book-centred')
  await page.locator('.q-matrix button', { hasText: 'Symbolic Atlas' }).click()
  await expect(page).toHaveURL(/produkt=symbolic/)
  await page.locator('.q-checks summary').first().click()
  await expect(page.locator('.q-check-detail').first()).toBeVisible()
  const axe = await new AxeBuilder({ page }).include('.quality').analyze()
  expect(axe.violations).toEqual([])
})

test('a product page and the constellation show quality and validity', async ({
  page,
}) => {
  await page.goto('/#symbolic-quality')
  await expect(page.locator('#symbolic-quality')).toContainText(
    'Analytical validity',
  )
  await page.goto('/#data-constellation?view=quality&node=app:symbolic')
  await expect(page.locator('.constellation-quality')).toContainText('Accuracy')
  await expect(page.locator('.constellation-quality a')).toHaveAttribute(
    'href',
    /#quality/,
  )
})
