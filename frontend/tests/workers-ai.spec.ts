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
    await page.goto('/#replik')
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

test('a question is answered with a fable, the checked law folded under it', async ({
  page,
}) => {
  const requested = await serveExports(page)
  let embedded = 0
  await page.route('**/api/embed', (route) => {
    embedded++
    return route.fulfill({ json: { vector: vectorNear(0) } })
  })
  let verified = true
  const asked: { corpus: string }[] = []
  // The Worker searches every law in force and returns what it found.
  const hits = LAW.slice(0, 8).map(({ id, title, url, text, law }, i) => ({
    id,
    title,
    url,
    text,
    law,
    score: 0.9 - i / 100,
  }))
  await page.route('**/api/answer', (route) => {
    asked.push(route.request().postDataJSON())
    return route.fulfill({
      json: verified
        ? {
            status: 'verified',
            allegory:
              'En räv och en hare arbetade i samma verkstad.\nSensmoral: regeln gäller alla.',
            answer: `Det gäller [[${LAW[0].id}]]"Fixture paragraph 1."`,
            quotes: [{ id: LAW[0].id, quote: 'Fixture paragraph 1.' }],
            model: '@cf/google/gemma-4-26b-a4b-it',
            hits,
          }
        : { status: 'unverified', passages: [], hits },
    })
  })
  await page.goto('/#fraga-lagen')
  // The name, the registry's summary and the conversation: no lead sentence or figures.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ALLEGORA')
  await expect(
    page.locator('.page-head-sentence, .page-head-kpis'),
  ).toHaveCount(0)
  await expect(page.getByText('Not legal advice')).toBeVisible()
  await expect(page.locator('.lq-examples button')).toHaveCount(1)
  // The conversation starts empty.
  await expect(page.locator('.lq-thread')).toHaveCount(0)
  const box = page.getByLabel('Your question')
  await box.fill('Vem omfattas av lagen?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(box).toHaveValue('')
  await expect(page.locator('.lq-ask')).toHaveText('Vem omfattas av lagen?')
  // The fable is the answer; the checked law and its passages are folded under it.
  await expect(page.locator('.lq-allegory p')).toHaveText([
    'En räv och en hare arbetade i samma verkstad.',
    'Sensmoral: regeln gäller alla.',
  ])
  await expect(page.locator('.lq-quote')).toBeHidden()
  await page.getByText('Show the legal text').click()
  await expect(
    page.getByRole('heading', { name: 'What the law says' }),
  ).toBeVisible()
  await expect(page.locator('.lq-quote')).toContainText(
    '✓ checked word for word',
  )
  await expect(page.locator('.lq-passages li:visible')).toHaveCount(3)
  await page.getByRole('button', { name: 'Show all 8' }).click()
  await expect(page.locator('.lq-passages li:visible')).toHaveCount(8)
  // Swedish law is searched by the Worker: the browser loads no corpus and embeds nothing.
  expect(asked[0].corpus).toBe('sfs-all')
  expect(requested).not.toContain('sfs/meta.json')
  expect(embedded).toBe(0)
  await page.locator('.lq-quote button').click()
  await expect(
    page.locator(`.lq-passages li[id$="-${LAW[0].id}"]`),
  ).toBeFocused()

  // A failed check is answered by the fixed owl fable; the first turn stays.
  verified = false
  await box.fill('Och lärlingar?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(page.locator('.lq-turn')).toHaveCount(2)
  await expect(
    page.getByText('The answer could not be verified against the legal text.'),
  ).toBeVisible()
  await expect(page.locator('.lq-turn').nth(1)).toContainText(
    'Moral: Whoever does not know should not pretend to.',
  )

  // The visitor's questions for the day are spent: the turn gets the allowance's reply instead.
  await page.unroute('**/api/answer')
  await page.route('**/api/answer', (route) =>
    route.fulfill({ status: 429, json: { reason: 'limit' } }),
  )
  await box.fill('En till?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(page.locator('.lq-turn').nth(2)).toContainText(
    "Sorry, Anton can't afford to provide more tokens today.",
  )

  // The AI Act is still reached by its address. Without examples it invites a question.
  await page.goto('/#fraga-lagen?korpus=ai-act')
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
    await page.goto('/#replik')
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

    // Without the Worker an example falls back to its published answer, which has no fable;
    // it cites with a colon and still renders as a checked quote. Nothing was searched, so no
    // passages are listed.
    await page.goto('/#fraga-lagen')
    await page
      .getByRole('button', { name: 'Fixture question near paragraph 1?' })
      .click()
    await expect(page.locator('.lq-ask')).toHaveText(
      'Fixture question near paragraph 1?',
    )
    await expect(page.locator('.lq-passages li')).toHaveCount(0)
    await expect(page.locator('.lq-quote q')).toHaveText('Fixture paragraph 1.')
    await expect(page.locator('.lq-answer')).not.toContainText('[[')
  },
)
