import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('the Symbolic Atlas maps real occurrences and filters by symbol and tradition', async ({
  page,
}) => {
  await page.goto('/#symbolic-atlas')
  await expect(
    page.getByRole('heading', { level: 1, name: /symbolic meanings emerge/ }),
  ).toBeVisible()
  const summary = await (
    await page.request.get('/data/symbolic/summary.json')
  ).json()
  await expect(page.locator('.atlas-canvas')).toBeVisible()
  await expect(page.locator('.atlas-status')).toContainText(
    summary.point_count.toLocaleString('en-GB'),
  )
  // A symbol filter lives in the address and shows that symbol's numbers.
  await page.getByRole('button', { name: 'snake', exact: true }).click()
  await expect(page).toHaveURL(/symbol=snake/)
  const snake = summary.symbols.find((s: { id: string }) => s.id === 'snake')
  await expect(page.locator('.stage-side.is-right')).toContainText(
    String(snake.occurrences),
  )
  await page.getByRole('button', { name: 'Norse', exact: true }).click()
  await expect(page).toHaveURL(/tradition=norse/)
  await expect(page.locator('.atlas-status')).toContainText('match the filters')
  const axe = await new AxeBuilder({ page })
    .include('#symbolic-atlas')
    .analyze()
  expect(axe.violations).toEqual([])
})

test('a filtered atlas address opens with its filter', async ({ page }) => {
  await page.goto('/#symbolic-atlas?symbol=raven')
  await expect(
    page.getByRole('button', { name: 'raven', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('the deconfounding experiments are compared under the atlas', async ({
  page,
}) => {
  await page.goto('/#symbolic-atlas')
  const comparison = await (
    await page.request.get('/data/symbolic/experiment-comparison.json')
  ).json()
  const table = page.locator('.atlas-table')
  await expect(table.locator('tbody tr')).toHaveCount(
    comparison.experiments.length,
  )
  await expect(table).toContainText('Book-centred')
  const centred = comparison.experiments.find(
    (r: { experiment: string }) => r.experiment === 'book_centered',
  )
  await expect(table).toContainText(String(centred.cross_book_cluster_count))
})
