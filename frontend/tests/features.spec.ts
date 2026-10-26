import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

/** The feature chart each page opens with: it comes first, reads its data, answers a pick or
 * a hover, keeps a table of the same numbers, and passes the accessibility scan. */
async function feature(page: import('@playwright/test').Page, id: string) {
  const f = page.locator(`#${id}`)
  await expect(f).toBeVisible()
  await expect(f.locator('h2')).not.toBeEmpty()
  await expect(f.locator('.feature-source')).toContainText('Source')
  // Scan once the entrance animations are over.
  await f.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  const scan = await new AxeBuilder({ page })
    .include(`#${id}`)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(scan.violations).toEqual([])
  await f.locator('.feature-table summary').click()
  await expect(f.locator('.feature-table tbody tr').first()).toBeVisible()
  return f
}

test('calibration scatter: predicted against measured, with zones', async ({
  page,
}) => {
  await page.goto('/#drugcomb-quality')
  const f = await feature(page, 'kalibrering')
  await expect(f.locator('.calib-point')).toHaveCount(40)
  await f
    .getByRole('button', { name: 'New drug (one or both)', exact: true })
    .click()
  await expect(f.locator('.calib-point.off')).toHaveCount(30)
})
