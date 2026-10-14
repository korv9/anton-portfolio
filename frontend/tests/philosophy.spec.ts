import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('the Philosophy Lab maps passages, compares maps and reads tensions', async ({
  page,
}) => {
  await page.goto('/#philosophy-atlas')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Do the passages gather by idea, or by the book they come from?',
  )
  await expect(page.locator('.ph-map circle').first()).toBeAttached()
  await expect(page.locator('.ph-table').first()).toContainText(
    'Nearest neighbours from the same work',
  )
  await page.getByRole('button', { name: 'Raw' }).click()
  await expect(page).toHaveURL(/karta=baseline/)
  // The chosen map follows the reader to the groups tab.
  await page.getByRole('link', { name: 'The groups' }).click()
  await expect(page).toHaveURL(/philosophy-groups\?karta=baseline/)
  const group = page.locator('.ph-groups > li').first()
  await group.locator('button').click()
  await expect(group.locator('.ph-reps li').first()).toBeVisible()
  await page.getByRole('link', { name: 'Tensions' }).click()
  await expect(page.locator('.ph-ranges li')).toHaveCount(13)
  const axe = await new AxeBuilder({ page }).include('.philosophy').analyze()
  expect(axe.violations).toEqual([])
  await page.goto('/#philosophy-works')
  await expect(page.locator('.ph-table')).toContainText('Jowett')
})
