import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('the Philosophy Atlas maps passages, compares maps and reads tensions', async ({
  page,
}) => {
  await page.goto('/#philosophy-atlas')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Philosophy Atlas' }),
  ).toBeVisible()
  await expect(page.locator('.ph-map circle').first()).toBeAttached()
  await expect(page.locator('.ph-table').first()).toContainText(
    'Nearest neighbours from the same work',
  )
  await page.getByRole('button', { name: 'Raw' }).click()
  await expect(page).toHaveURL(/karta=baseline/)
  const group = page.locator('.ph-groups > li').first()
  await group.locator('button').click()
  await expect(group.locator('.ph-reps li').first()).toBeVisible()
  await expect(page.locator('.ph-ranges li')).toHaveCount(13)
  await expect(page.locator('.ph-table').last()).toContainText('Jowett')
  const axe = await new AxeBuilder({ page }).include('.philosophy').analyze()
  expect(axe.violations).toEqual([])
})
