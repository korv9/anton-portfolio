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
    snake.occurrences.toLocaleString('en-GB'),
  )
  await page
    .getByRole('button', { name: 'Norse and Germanic', exact: true })
    .click()
  await expect(page).toHaveURL(/tradition=norse-germanic/)
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
  const table = page.locator('#symbolic-experiments .atlas-table')
  await expect(table.locator('tbody tr')).toHaveCount(
    comparison.experiments.length,
  )
  await expect(table).toContainText('Book-centred')
  const centred = comparison.experiments.find(
    (r: { experiment: string }) => r.experiment === 'book_centered',
  )
  await expect(table).toContainText(String(centred.cross_book_cluster_count))
})

test('the cross-book view mutes book-bound clusters and opens a cluster for review', async ({
  page,
}) => {
  const clusters = await (
    await page.request.get('/data/symbolic/book-centered-clusters.json')
  ).json()
  // The highest-ranked candidate no person has reviewed yet.
  const top = clusters.clusters
    .filter(
      (c: { review_class: string; review_status: string }) =>
        c.review_class === 'candidate' && c.review_status !== 'reviewed',
    )
    .sort(
      (
        a: { review_priority_score: number },
        b: { review_priority_score: number },
      ) => b.review_priority_score - a.review_priority_score,
    )[0]
  await page.goto('/#symbolic-atlas')
  await page.getByRole('button', { name: 'Cross-book', exact: true }).click()
  await expect(page).toHaveURL(/view=cross-book/)
  await page
    .locator('.atlas-select select')
    .selectOption(String(top.cluster_id))
  const panel = page.locator('.stage-side.is-right')
  // Unreviewed clusters are numbered, never named.
  await expect(panel).toContainText(`Cluster ${top.cluster_id}`)
  await expect(panel).toContainText('Not reviewed')
  await expect(panel).toContainText(String(top.book_count))
  await expect(panel.locator('.cluster-passages li').first()).toBeVisible()
  // The diverse representatives come from different books.
  const books = await panel.locator('.cluster-passages small').allTextContents()
  expect(new Set(books.map((b) => b.split(' · ')[1])).size).toBeGreaterThan(1)
})

test('the reviewed view shows only human-reviewed clusters, and says when there are none', async ({
  page,
}) => {
  const reviewed = await (
    await page.request.get('/data/symbolic/reviewed-clusters.json')
  ).json()
  await page.goto('/#symbolic-atlas?view=reviewed')
  if (reviewed.clusters.length === 0) {
    await expect(page.locator('.atlas-empty')).toHaveText(
      'No reviewed semantic clusters yet.',
    )
    // Nothing is lit: no unreviewed cluster stands in for a reviewed one.
    await expect(page.locator('.atlas-status')).toContainText(/^0 of /)
  } else await expect(page.locator('.atlas-empty')).toHaveCount(0)
})

test('the investigation is told step by step with its numbers', async ({
  page,
}) => {
  const history = await (
    await page.request.get('/data/symbolic/research-history.json')
  ).json()
  await page.goto('/#symbolic-findings')
  const steps = page.locator('.research-steps > li')
  await expect(steps).toHaveCount(8)
  await expect(steps.nth(1)).toContainText('Baseline')
  await expect(steps.nth(4)).toContainText('Paratext')
  await expect(steps.nth(4)).toContainText(
    String(history.steps[2].metrics.cross_book_cluster_count),
  )
  // The expanded corpus is its own step, with the number of books it grew to.
  await expect(steps.nth(5)).toContainText('Corpus expansion · v4')
  await expect(steps.nth(5)).toContainText(
    `${history.steps[3].documents} books`,
  )
  await expect(page.locator('#symbolic-validity')).toContainText(
    'What the clusters follow',
  )
  await expect(page.locator('#symbolic-method')).toContainText('Diagnostics')
})

test('the corpus explorer lists every book and filters by tradition', async ({
  page,
}) => {
  const summary = await (
    await page.request.get('/data/symbolic/summary.json')
  ).json()
  await page.goto('/#symbolic-atlas')
  const rows = page.locator('.corpus-table tbody tr')
  await expect(rows).toHaveCount(summary.document_count)
  await page
    .locator('.corpus-filters')
    .getByLabel('Tradition')
    .selectOption('east-asian')
  await expect(page).toHaveURL(/korpus=east-asian/)
  const eastAsian = summary.documents.filter(
    (d: { tradition: string }) => d.tradition === 'east-asian',
  ).length
  await expect(rows).toHaveCount(eastAsian)
  await expect(page.locator('.corpus-count')).toContainText(
    `${eastAsian} of ${summary.document_count} books`,
  )
})
