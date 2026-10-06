import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('the Concept Constellation draws typed relations and opens concept pages', async ({
  page,
}) => {
  await page.goto('/#concept-constellation')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Concept Constellation' }),
  ).toBeVisible()
  await expect(page.locator('.cc-node')).toHaveCount(28)
  await expect(
    page.locator('.cc-line.cc-rel-shared_tension').first(),
  ).toBeAttached()
  await page.getByRole('button', { name: 'Prominent in corpus' }).click()
  await expect(
    page.locator('.cc-line.cc-rel-shared_concept').first(),
  ).toBeAttached()
  await page.locator('.cc-node a', { hasText: 'Risk' }).click()
  await expect(page).toHaveURL(/begrepp=risk/)
  await expect(page.locator('.cc-panel h3')).toHaveText('Risk')
  const axe = await new AxeBuilder({ page }).include('.concepts').analyze()
  expect(axe.violations).toEqual([])

  await page.goto('/#concept-autonomy')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Autonomy' }),
  ).toBeVisible()
  await expect(page.locator('.cc-bar')).toHaveCount(4)
  await expect(page.locator('.cc-column blockquote').first()).toBeVisible()
  await expect(page.locator('.cc-links').first()).toContainText('no word group')
  const axe2 = await new AxeBuilder({ page }).include('.concepts').analyze()
  expect(axe2.violations).toEqual([])
})
