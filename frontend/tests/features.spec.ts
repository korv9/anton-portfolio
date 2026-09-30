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

test('roll-call waffles: a hundred squares per party, re-ordered by the kind of vote', async ({
  page,
}) => {
  await page.goto('/#politik-roster')
  const f = await feature(page, 'rostrutor')
  await expect(f.locator('.waffle')).toHaveCount(8)
  await expect(
    f.locator('.waffle').first().locator('.waffle-grid span'),
  ).toHaveCount(100)
  const first = await f.locator('.waffle figcaption span').first().textContent()
  await f.getByRole('button', { name: 'Abstained' }).click()
  await expect(f.locator('.waffle figcaption span').first()).not.toHaveText(
    first!,
  )
  await expect(f.locator('h2')).toContainText('abstained')
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

test('seat alluvial: every election since 1973, one party followed through all', async ({
  page,
}) => {
  await page.goto('/#politik-partier')
  const f = await feature(page, 'mandat')
  await f.getByRole('button', { name: 'From 1973' }).click()
  await expect(f.locator('.alluvial-year')).toHaveCount(16)
  await f.locator('.alluvial-label').first().dispatchEvent('pointerdown')
  await expect(f.locator('.alluvial-readout')).toContainText('1973')
  // The party cards are still there, under the chart.
  await expect(page.locator('.party-cards')).toBeVisible()
})

test('budget flow: the government’s budget into its areas, coloured by a party', async ({
  page,
}) => {
  await page.goto('/#politik-budget')
  const f = await feature(page, 'budgetflode')
  const bands = f.locator('.budgetflow-band')
  expect(await bands.count()).toBeGreaterThan(20)
  const title = await f.locator('h2').textContent()
  const picks = f.locator('.feature-pick button')
  await picks.nth(1).click()
  await expect(f.locator('h2')).not.toHaveText(title!)
  await bands.first().dispatchEvent('pointerdown')
  await expect(f.locator('.feature-tip')).toBeVisible()
})

test('tax bubbles: every tax by revenue, the mix changes with the year', async ({
  page,
}) => {
  await page.goto('/#politik-skatter')
  const f = await feature(page, 'skattebubblor')
  await expect(f.locator('.taxband')).toHaveCount(6)
  const now = await f.locator('.taxbubble').count()
  await f.getByRole('button', { name: '1990' }).click()
  await expect(f.locator('h2')).toContainText('1990')
  expect(await f.locator('.taxbubble').count()).toBeGreaterThanOrEqual(now)
})

test('debate leaderboard: one party lit up in every column', async ({
  page,
}) => {
  await page.goto('/#politik-sakdebatter')
  const f = await feature(page, 'topplista')
  await expect(f.locator('.leaderboard-col')).toHaveCount(5)
  await f.locator('.leaderboard-col').first().locator('button').first().click()
  await expect(f.locator('.leaderboard li.on')).toHaveCount(5)
  await expect(f.locator('.leaderboard-path line')).toHaveCount(4)
})

test('job treemap: fields sized by ads, one opens into its occupations', async ({
  page,
}) => {
  await page.goto('/#jobb')
  const f = await feature(page, 'treemap')
  const fields = await f.locator('.treemap-tile').count()
  expect(fields).toBeGreaterThan(15)
  await f.locator('button.treemap-tile').first().click()
  await expect(f.locator('.treemap-path b')).toBeVisible()
  await expect(f.locator('button.treemap-tile')).toHaveCount(0)
  await f.getByRole('button', { name: 'All fields' }).click()
  await expect(f.locator('button.treemap-tile')).toHaveCount(fields)
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
