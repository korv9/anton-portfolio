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

test('vote shares: the parties ranked by the kind of vote picked', async ({
  page,
}) => {
  await page.goto('/#politik-roster')
  const f = await feature(page, 'rostrutor')
  await expect(f.locator('.rank-bars-list li')).toHaveCount(8)
  const first = await f.locator('.rank-label').first().textContent()
  await f.getByRole('button', { name: 'Abstained', exact: true }).click()
  await expect(f.locator('.rank-label').first()).not.toHaveText(first!)
})

test('poll trend: names at the line ends and a crosshair that reads every party', async ({
  page,
}) => {
  await page.goto('/#politik-valjarna')
  const f = await feature(page, 'opinionen')
  await expect(f.locator('.trend-end')).toHaveCount(8)
  const svg = f.locator('.trend svg')
  // A tap reads the crosshair too, so this works on a phone.
  await svg.scrollIntoViewIfNeeded()
  const at = (await svg.boundingBox())!
  await svg.dispatchEvent('pointerdown', {
    clientX: at.x + at.width / 3,
    clientY: at.y + at.height / 2,
  })
  await expect(f.locator('.trend-tip span')).toHaveCount(8)
  await f.getByRole('button', { name: 'Since 1973' }).click()
  await expect(f.locator('.trend-year').first()).toHaveText(/19[7-9]\d/)
})

test('seats over time: one line per party since the chosen election', async ({
  page,
}) => {
  await page.goto('/#politik-partier')
  const f = await feature(page, 'mandat')
  await f.getByRole('button', { name: 'From 1973' }).click()
  await expect(f.locator('.feature-table thead th')).toHaveCount(17)
  // The party cards are still there, under the chart.
  await expect(page.locator('.party-cards')).toBeVisible()
})

test('budget difference: a party against the government, area by area', async ({
  page,
}) => {
  await page.goto('/#politik-budget')
  const f = await feature(page, 'budgetflode')
  await expect(f.locator('.rank-bars-list.diverging')).toBeVisible()
  const title = await f.locator('h2').textContent()
  await f.locator('.feature-pick button').nth(1).click()
  await expect(f.locator('h2')).not.toHaveText(title!)
})

test('tax ranking: every tax by revenue, the mix changes with the year', async ({
  page,
}) => {
  await page.goto('/#politik-skatter')
  const f = await feature(page, 'skattebubblor')
  await expect(f.locator('.rank-bars-list li')).toHaveCount(8)
  await f.getByRole('button', { name: '1990' }).click()
  await expect(f.locator('h2')).toContainText('1990')
})

test('debate ranking: the parties ranked by the measure picked', async ({
  page,
}) => {
  await page.goto('/#politik-sakdebatter')
  await page.locator('.sak-deeper > summary').click()
  const f = await feature(page, 'topplista')
  await expect(f.locator('.rank-bars-list li')).toHaveCount(8)
  const first = await f.locator('.rank-label').first().textContent()
  await f.getByRole('button', { name: 'Replies per speech' }).click()
  await expect(f.locator('.rank-value').first()).not.toHaveText(first!)
})

test('field ranking: fields by ads, one opens into its occupations', async ({
  page,
}) => {
  await page.goto('/#jobb')
  // The ranking is part of Explore on the overview.
  await page.getByRole('button', { name: 'Explore the data' }).click()
  const f = await feature(page, 'treemap')
  await expect(f.locator('.rank-bars-list li')).toHaveCount(12)
  await f.locator('.rank-bars-list li > button').first().click()
  await expect(f.locator('.treemap-path b')).toBeVisible()
  await f.getByRole('button', { name: 'All fields' }).click()
  await expect(f.locator('.treemap-path b')).toHaveCount(0)
})

test('county small multiples: one chart per county on a shared axis', async ({
  page,
}) => {
  await page.goto('/#sweden')
  const f = await feature(page, 'lanen')
  await expect(f.locator('.multiple')).toHaveCount(21)
  await f.getByRole('button', { name: 'Stress-related sick leave' }).click()
  await expect(f.locator('h2')).toContainText('Stress-related')
  await f
    .locator('.multiple svg')
    .first()
    .click({ position: { x: 4, y: 30 }, force: true })
  await expect(f.locator('.multiples-year b')).not.toHaveText(/2025/)
})

test('calibration scatter: predicted against measured, with zones', async ({
  page,
}) => {
  await page.goto('/#drugcomb')
  const f = await feature(page, 'kalibrering')
  await expect(f.locator('.calib-point')).toHaveCount(40)
  await f.getByRole('button', { name: 'New drug', exact: true }).click()
  await expect(f.locator('.calib-point.off')).toHaveCount(30)
})
