/**
 * The two Workers AI demos with /api/* mocked and the exports served from small fixtures
 * (workers-ai-fixtures.ts): a sentence placed on the debate map, a question answered with checked
 * quotes, and both working from their precomputed examples when the Worker has no quota left.
 */
import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './test'
import {
  CHECKED,
  DEBATE,
  LAW,
  serveExports,
  sse,
  vectorNear,
  VERIFIED,
} from './workers-ai-fixtures'

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

test('a question streams a draft, then the checked answer and its fable, sources beside', async ({
  page,
}) => {
  const requested = await serveExports(page)
  let embedded = 0
  await page.route('**/api/embed', (route) => {
    embedded++
    return route.fulfill({ json: { vector: vectorNear(0) } })
  })
  const asked: { question: string; history: unknown[] }[] = []
  let stream: [string, unknown][] = VERIFIED.slice(0, 3)
  await page.route('**/api/ask', (route) => {
    asked.push(route.request().postDataJSON())
    return route.fulfill({
      headers: { 'Content-Type': 'text/event-stream' },
      body: sse(stream),
    })
  })
  await page.goto('/#fraga-lagen')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ALLEGORA')
  await expect(page.getByText('Not legal advice')).toBeVisible()
  await expect(page.locator('.lq-examples button')).toHaveCount(1)
  await expect(page.locator('.lq-thread')).toHaveCount(0)
  const box = page.getByLabel('Your question')

  // Mid-stream: the found paragraphs and a draft marked as one, with no ✓ and no ids.
  await box.fill('Vem omfattas av lagen?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(box).toHaveValue('')
  await expect(page.locator('.lq-ask')).toHaveText('Vem omfattas av lagen?')
  await expect(page.locator('.lq-draft')).toContainText(
    'Draft, not checked yet',
  )
  await expect(page.locator('.lq-draft .lq-answer')).toHaveText(
    'Det gäller "Fixture paragraph 1."',
  )
  await expect(page.locator('.lq-quote')).toHaveCount(0)
  await expect(page.locator('.lq-steps')).toContainText('Found 8 paragraphs')

  // The whole stream: the checked answer leads with its ✓, the fable follows it.
  stream = VERIFIED
  await box.fill('Och lärlingar?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  const turn = page.locator('.lq-turn').nth(1)
  await expect(turn.locator('.lq-quote')).toContainText(
    '✓ checked word for word',
  )
  await expect(turn.locator('.lq-draft')).toHaveCount(0)
  await expect(turn.locator('.lq-allegory p')).toHaveText([
    'En räv och en hare arbetade i samma verkstad.',
    'Sensmoral: regeln gäller alla.',
  ])
  const order = await turn.evaluate((el) =>
    [...el.querySelectorAll('.lq-answer, .lq-allegory')].map(
      (n) => n.className,
    ),
  )
  expect(order).toEqual(['lq-answer', 'lq-allegory'])
  await expect(turn.locator('.lq-steps')).toContainText(
    'Checked word for word ✓',
  )
  // The first turn was never checked, so it is not sent as history.
  expect(asked[1]).toEqual({ question: 'Och lärlingar?', history: [] })
  // Swedish law is searched by the Worker: the browser loads no corpus and embeds nothing.
  expect(requested).not.toContain('sfs/meta.json')
  expect(embedded).toBe(0)

  // On a wide screen the sources stand beside the conversation, and a quote leads there.
  const panel = page.locator('.lq-panel')
  await expect(panel).toBeVisible()
  await expect(page.locator('.lq-law')).toHaveCount(0)
  await expect(panel.locator('.lq-passages li:visible')).toHaveCount(3)
  await turn.locator('.lq-quote button').click()
  await expect(panel.locator('.lq-passages li:visible')).toHaveCount(8)
  await expect(panel.locator(`li[id$="-${LAW[0].id}"]`)).toBeFocused()

  // A follow-up sends the checked turn as history.
  await box.fill('Och praktikanter?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(page.locator('.lq-turn')).toHaveCount(3)
  await expect.poll(() => asked.length).toBe(3)
  expect(asked[2].history).toEqual([
    { question: 'Och lärlingar?', answer: CHECKED },
  ])

  // A draft that fails the check is taken away; the owl says why.
  stream = [
    ...VERIFIED.slice(0, 3),
    ['result', { status: 'unverified' }],
    ['done', {}],
  ]
  await box.fill('Och chefer?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  const failed = page.locator('.lq-turn').nth(3)
  await expect(
    failed.getByText(
      'The answer could not be verified against the legal text.',
    ),
  ).toBeVisible()
  await expect(failed).toContainText(
    'Moral: Whoever does not know should not pretend to.',
  )
  await expect(failed.locator('.lq-draft')).toHaveCount(0)
  await expect(failed.locator('.lq-steps')).toContainText('Failed the check')

  // The visitor's questions for the day are spent: the turn gets the allowance's reply instead.
  await page.unroute('**/api/ask')
  await page.route('**/api/ask', (route) =>
    route.fulfill({ status: 429, json: { reason: 'limit' } }),
  )
  await box.fill('En till?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(page.locator('.lq-turn').nth(4)).toContainText(
    "Sorry, Anton can't afford to provide more tokens today.",
  )

  // The AI Act is still reached by its address. Without examples it invites a question.
  await page.goto('/#fraga-lagen?korpus=ai-act')
  await expect(page.locator('.lq-examples')).toHaveCount(0)
})

test(
  'on a narrow screen the sources fold under the turn, and the step holds still with reduced motion',
  { tag: '@mobile-only' },
  async ({ page }) => {
    await serveExports(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let stream: [string, unknown][] = VERIFIED.slice(0, 2)
    await page.route('**/api/ask', (route) =>
      route.fulfill({
        headers: { 'Content-Type': 'text/event-stream' },
        body: sse(stream),
      }),
    )
    await page.goto('/#fraga-lagen')
    const box = page.getByLabel('Your question')
    await box.fill('Vem omfattas av lagen?')
    await page.getByRole('button', { name: 'Ask', exact: true }).click()
    const current = page.locator('.lq-steps li[data-state="current"]')
    await expect(current).toHaveText('Writing and checking')
    expect(
      await current.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('none')
    stream = VERIFIED
    await box.fill('Och lärlingar?')
    await page.getByRole('button', { name: 'Ask', exact: true }).click()
    await expect(page.locator('.lq-panel')).toHaveCount(0)
    const turn = page.locator('.lq-turn').nth(1)
    await turn.getByText('Show the 8 passages found').click()
    await expect(turn.locator('.lq-passages li:visible')).toHaveCount(3)
    await turn.locator('.lq-quote button').click()
    await expect(
      turn.locator(`.lq-passages li[id$="-${LAW[0].id}"]`),
    ).toBeFocused()
  },
)

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

test('the workspace mid-draft and answered has no axe violations, in both languages', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the same markup on a phone')
  await serveExports(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let stream: [string, unknown][] = VERIFIED
  await page.route('**/api/ask', (route) =>
    route.fulfill({
      headers: { 'Content-Type': 'text/event-stream' },
      body: sse(stream),
    }),
  )
  for (const lang of ['en', 'sv']) {
    await page.goto(`/?lang=${lang}#fraga-lagen`)
    const box = page.locator('#lq-question')
    stream = VERIFIED
    await box.fill('Vem omfattas av lagen?')
    await page
      .locator('form.lq-form')
      .evaluate((f: HTMLFormElement) => f.requestSubmit())
    await expect(page.locator('.lq-allegory').first()).toBeVisible()
    stream = VERIFIED.slice(0, 3)
    await box.fill('Och lärlingar?')
    await page
      .locator('form.lq-form')
      .evaluate((f: HTMLFormElement) => f.requestSubmit())
    await expect(page.locator('.lq-draft')).toBeVisible()
    const result = await new AxeBuilder({ page }).include('main').analyze()
    const summary = result.violations.map(
      (v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`,
    )
    expect(summary, lang).toEqual([])
  }
})
