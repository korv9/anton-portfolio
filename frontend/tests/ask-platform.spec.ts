/**
 * Ask the platform on its test route (#ask-platform) with /api/* mocked and the platform export
 * served from fixtures: the corpus waits for the field, a checked answer cites its file at its
 * commit and draws the quoted model's path, and with the quota spent the example still answers.
 */
import { test, expect } from './test'
import {
  PLATFORM,
  PLATFORM_ANSWER,
  serveExports,
  vectorNear,
} from './workers-ai-fixtures'

test(
  'a question gets a checked answer with its file, commit and lineage',
  { tag: '@mobile' },
  async ({ page }) => {
    const requested = await serveExports(page)
    await page.route('**/api/embed', (route) =>
      route.fulfill({ json: { vector: vectorNear(0) } }),
    )
    const asked: { corpus: string; passages: { id: string }[] }[] = []
    await page.route('**/api/answer', (route) => {
      asked.push(route.request().postDataJSON())
      return route.fulfill({ json: PLATFORM_ANSWER })
    })
    await page.goto('/#ask-platform')
    const box = page.getByLabel('Your question')
    await expect(box).toBeVisible()
    // The corpus waits for the reader.
    expect(requested).not.toContain('platform/vectors.bin')
    await box.focus()
    await expect.poll(() => requested).toContain('platform/vectors.bin')
    await box.fill('Where do the election results come from?')
    await box.press('Enter')

    const answer = page.locator('.ap-answer')
    await expect(answer.locator('q')).toHaveText('Fixture platform passage 0.')
    await expect(answer).not.toContainText('[[')
    await expect(answer.locator('a.ap-cite')).toHaveText(
      `${PLATFORM[0].path} @ abc1234`,
    )
    await expect(answer.locator('a.ap-cite')).toHaveAttribute(
      'href',
      PLATFORM[0].url,
    )
    expect(asked[0].corpus).toBe('platform')
    expect(asked[0].passages).toHaveLength(8)

    // The model's path through the published graph: five steps, the model itself in gold.
    const steps = page.locator('.ap-lineage li')
    await expect(steps).toHaveCount(5)
    await expect(steps.nth(3)).toHaveClass('is-self')
    await expect(steps.nth(3)).toContainText('fct_election')
    await expect(steps.nth(2)).toHaveClass('is-missing')
    await expect(page.locator('.ap-passages li')).toHaveCount(8)
  },
)

test('with the quota spent, the precomputed example still answers', async ({
  page,
}) => {
  await serveExports(page)
  await page.route('**/api/*', (route) =>
    route.fulfill({ status: 503, json: { reason: 'quota' } }),
  )
  await page.goto('/#ask-platform')
  await page.getByLabel('Your question').fill('A question of my own?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(page.locator('.ap-notice')).toContainText(
    "Today's Workers AI allocation is used up",
  )
  await page.getByRole('button', { name: 'Fixture platform question?' }).click()
  await expect(page.locator('.ap-answer q')).toHaveText(
    'Fixture platform passage 0.',
  )
  await expect(page.locator('.ap-notice')).toHaveCount(0)
})

test('a failed load keeps the form and says to retry', async ({ page }) => {
  await serveExports(page)
  // Registered last, so it wins over the fixture route.
  await page.route(/\/workers-ai\/platform\/meta\.json$/, (route) =>
    route.fulfill({ status: 500 }),
  )
  await page.goto('/#ask-platform')
  await page.getByLabel('Your question').fill('Where is the warehouse?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(page.locator('.ap-notice')).toContainText(
    'The passages could not be loaded. Ask again to retry.',
  )
  await expect(page.getByLabel('Your question')).toBeVisible()
  await expect(page.getByText('The corpus is not published yet.')).toHaveCount(
    0,
  )
})

test('the opening example names its files before the corpus loads', async ({
  page,
}) => {
  const requested = await serveExports(page)
  await page.goto('/#platform')
  const cite = page.locator('.ap-answer .ap-cite')
  await expect(cite).toHaveText('dbt fct_election')
  expect(requested).not.toContain('platform/meta.json')
  await expect(page.getByLabel('Your question')).toHaveAttribute(
    'placeholder',
    'How does the site find the address of a data file?',
  )
})
