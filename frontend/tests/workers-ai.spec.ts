/**
 * The two Workers AI demos with /api/* mocked and the exports served from small fixtures
 * (workers-ai-fixtures.ts): a sentence placed on the debate map, a question answered with checked
 * quotes, and both working from their precomputed examples when the Worker has no quota left.
 */
import { test, expect } from './test'
import { DEBATE, LAW, serveExports, vectorNear } from './workers-ai-fixtures'

test(
  'a sentence lands on the debate map among its nearest passages',
  { tag: '@mobile' },
  async ({ page }) => {
    const requested = await serveExports(page)
    const sent: unknown[] = []
    await page.route('**/api/embed', (route) => {
      sent.push(route.request().postDataJSON())
      return route.fulfill({ json: { vector: vectorNear(1) } })
    })
    await page.goto('/#cluster-visuals')
    const card = page.locator('#cv-place')
    await expect(card.locator('canvas')).toBeVisible()
    // The vectors wait for the reader.
    expect(requested).not.toContain('debate/vectors.bin')
    const box = card.getByLabel('Your sentence', { exact: true })
    await box.focus()
    await expect.poll(() => requested).toContain('debate/vectors.bin')
    await box.fill('Skolan behöver fler lärare.')
    await card.getByRole('button', { name: 'Place it' }).click()
    const name = DEBATE.names[DEBATE.second][0]
    await expect(card.locator('.cv-place-group')).toHaveText(name)
    expect(sent).toEqual([{ text: 'Skolan behöver fler lärare.' }])
    await expect(card.locator('.cv-place-list li')).toHaveCount(5)
    await expect(card.locator('.cv-place-list a').first()).toHaveAttribute(
      'href',
      'https://data.riksdagen.se/',
    )
    await expect(card.locator('.rank-bars li')).toHaveCount(5)
    await expect(card.locator('.cv-marker b')).toBeVisible()
    await expect(card.locator('canvas')).toHaveAttribute(
      'aria-label',
      new RegExp(`Your sentence: ${name}`),
    )
    // The neighbour list is reached with the keyboard.
    await card.locator('.cv-place-list a').first().focus()
    await expect(card.locator('.cv-place-list a').first()).toBeFocused()
  },
)

test('a question shows its passages, then the checked answer', async ({
  page,
}) => {
  await serveExports(page)
  await page.route('**/api/embed', (route) =>
    route.fulfill({ json: { vector: vectorNear(0) } }),
  )
  let verified = true
  const asked: { corpus: string; passages: { id: string }[] }[] = []
  await page.route('**/api/answer', (route) => {
    asked.push(route.request().postDataJSON())
    return route.fulfill({
      json: verified
        ? {
            status: 'verified',
            answer: `Det gäller [[${LAW[0].id}]]"Fixture paragraph 1."`,
            quotes: [{ id: LAW[0].id, quote: 'Fixture paragraph 1.' }],
            model: '@cf/google/gemma-4-26b-a4b-it',
          }
        : { status: 'unverified', passages: [] },
    })
  })
  await page.goto('/#fraga-lagen')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Allegora')
  await expect(page.getByText('not legal advice')).toBeVisible()
  await expect(page.getByText('(fetched 2026-10-14)')).toBeVisible()
  await expect(page.locator('.lq-laws li')).toHaveCount(1)
  await expect(page.locator('.lq-examples button')).toHaveCount(1)
  // The page opens on the first example's checked answer, three of its passages shown.
  await expect(page.locator('.lq-quote q')).toHaveText('Fixture paragraph 1.')
  await expect(page.locator('.lq-passages li:visible')).toHaveCount(3)
  await page.getByRole('button', { name: 'Show all 8' }).click()
  await expect(page.locator('.lq-passages li:visible')).toHaveCount(8)
  await page.getByLabel('Your question').fill('Vem omfattas av lagen?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(page.locator('.lq-passages li')).toHaveCount(8)
  await expect(page.locator('.lq-quote')).toContainText(
    '✓ checked word for word',
  )
  expect(asked[0].corpus).toBe('sfs')
  expect(asked[0].passages).toHaveLength(8)
  await page.locator('.lq-quote button').click()
  await expect(page.locator(`[id="lq-${LAW[0].id}"]`)).toBeFocused()

  verified = false
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(
    page.getByText('The answer could not be verified against the legal text'),
  ).toBeVisible()
  await expect(page.locator('.lq-passages li')).toHaveCount(8)

  // The evaluation: the chosen model's figures and the comparison, gpt-oss cost as a lower bound.
  const checked = page.locator('.lq-checked')
  await expect(checked).toContainText(
    '15 of 20answers with every quote verified (75 %)',
  )
  await expect(checked).toContainText('0.85recall@8')
  await expect(checked).toContainText('n = 20')
  await expect(page.locator('.lq-tech')).toContainText(
    '30.2 neurons, 2,672 tokens',
  )
  const rows = page.locator('.lq-table tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toHaveClass('lq-chosen')
  await expect(rows.nth(1)).toContainText('gpt-oss-20b')
  await expect(rows.nth(1).locator('td').last()).toHaveText('at least 50.3')

  // The corpus is part of the address. The English AI Act has no examples and invites a question.
  await page.getByRole('button', { name: 'EU AI Act' }).click()
  await expect(page).toHaveURL(/#fraga-lagen\?korpus=ai-act$/)
  await expect(
    page.getByText(
      'Ask in your own words; every quote in the answer is checked against the text.',
    ),
  ).toBeVisible()
  await expect(page.locator('.lq-examples')).toHaveCount(0)
})

test(
  'with the quota spent, the precomputed examples still work',
  { tag: '@mobile' },
  async ({ page }) => {
    await serveExports(page)
    await page.route('**/api/*', (route) =>
      route.fulfill({ status: 503, json: { reason: 'quota' } }),
    )
    await page.goto('/#cluster-visuals')
    const card = page.locator('#cv-place')
    await card
      .getByRole('button', { name: 'Fixture example near the first group.' })
      .click()
    await expect(card.locator('.cv-place-group')).toHaveText(
      DEBATE.names[DEBATE.first][0],
    )
    await card
      .getByLabel('Your sentence', { exact: true })
      .fill('En egen mening.')
    await card.getByRole('button', { name: 'Place it' }).click()
    await expect(card.getByRole('status')).toContainText(
      "Today's Workers AI allocation is used up",
    )

    // The example's published answer cites with a colon and still renders as a checked quote.
    await page.goto('/#fraga-lagen')
    await page
      .getByRole('button', { name: 'Fixture question near paragraph 1?' })
      .click()
    await expect(page.getByLabel('Your question')).toHaveValue(
      'Fixture question near paragraph 1?',
    )
    await expect(page.locator('.lq-passages li').first()).toContainText(
      'Fixture paragraph',
    )
    await expect(page.locator('.lq-quote q')).toHaveText('Fixture paragraph 1.')
    await expect(page.locator('.lq-answer')).not.toContainText('[[')
  },
)
