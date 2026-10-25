/**
 * The chart feed on its own page (#what-does-it-even-mean), and the start page's name intro: the
 * feed keeps its thumbnails moving and opens a card on click.
 */
import type { Locator, Page } from '@playwright/test'
import { test, expect } from './test'

const FEED = '/#what-does-it-even-mean'

/** Posts mount only near the screen, so scroll down until the wanted one is there. */
async function scrollTo(page: Page, target: Locator) {
  await expect
    .poll(async () => {
      if (await target.count()) return true
      await page.evaluate(() => scrollBy(0, 500))
      return false
    })
    .toBe(true)
  await target.scrollIntoViewIfNeeded()
}

/** The feed's first thumbnail with a slicer that steps by itself, scrolled into view. */
async function tickingPost(page: Page) {
  const feed = page.locator('.mean-page')
  await expect(feed.locator('.mean-post').first()).toBeAttached()
  const ticking = feed
    .locator('.mean-post:not([data-dense]):has(.mean-now)')
    .first()
  await scrollTo(page, ticking)
  // Pinned by id: `.first()` would move on as other posts mount and unmount.
  return page.locator(
    `[data-post="${await ticking.getAttribute('data-post')}"]`,
  )
}

/** Samples the checked slicer option over about 9 s (thumbnails step every 2.5 s) and returns
 * the distinct values seen. */
async function slicerValues(post: Locator) {
  const checked = post.locator('.mean-slicer [aria-checked="true"]')
  const seen: (string | null)[] = []
  // A fixed 9 s window, about three 2.5 s steps, however slow each read is under CI load.
  const end = Date.now() + 9000
  while (Date.now() < end) {
    seen.push(await checked.textContent())
    await post.page().waitForTimeout(300)
  }
  return new Set(seen)
}

test(
  'the chart feed has its own page with living posts that open',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto(FEED)
    const feed = page.locator('.mean-page')
    await expect(
      feed.getByRole('heading', { level: 1, name: 'What does it even mean?' }),
    ).toBeVisible()
    await expect
      .poll(() => feed.locator('.mean-post').count())
      .toBeGreaterThan(100)
    // The feed reads by subject, politics first.
    await expect(
      feed.getByRole('heading', { level: 2, name: 'Politics' }),
    ).toBeVisible()
    const first = feed.locator('.mean-post').first()
    // The strongest post leads the feed.
    await expect(first).toHaveAttribute('data-post', 'pol-ai-speech-line')
    // Cards wear the feed's card token.
    const card = await first.evaluate((el) => {
      const probe = document.createElement('i')
      probe.style.backgroundColor = 'var(--mean-card)'
      el.parentElement!.append(probe)
      const value = getComputedStyle(probe).backgroundColor
      probe.remove()
      return value
    })
    await expect(first).toHaveCSS('background-color', card)
    await expect(first.locator('svg, .mean-body > div').first()).toBeVisible()

    // A thumbnail with a slicer steps by itself while on screen, and its corner names the
    // option it shows.
    const ticking = await tickingPost(page)
    await expect(ticking.locator('.mean-now')).toBeVisible()
    const checked = ticking.locator('.mean-slicer [aria-checked="true"]')
    const before = await checked.textContent()
    await expect.poll(() => checked.textContent()).not.toBe(before)

    // Opened, the post shows the slicer it was cycling.
    await ticking.getByRole('button', { name: 'Open chart' }).click()
    await expect(ticking).toHaveClass(/mean-open/)
    await expect(ticking.locator('.mean-slicer')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(ticking).not.toHaveClass(/mean-open/)
  },
)

test('reduced motion keeps the feed thumbnails still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(FEED)
  const ticking = await tickingPost(page)
  expect((await slicerValues(ticking)).size).toBe(1)
})

test('a section pause button holds its thumbnails until pressed again', async ({
  page,
}) => {
  // Two 9 s sampling windows.
  test.setTimeout(60_000)
  await page.goto(FEED)
  const ticking = await tickingPost(page)
  const pause = ticking
    .locator('xpath=ancestor::section[contains(@class, "mean-section")]')
    .getByRole('button', { name: /^Pause .* charts$/ })
  await expect(pause).toHaveAttribute('aria-pressed', 'false')
  await pause.focus()
  await page.keyboard.press('Enter')
  await expect(pause).toHaveAttribute('aria-pressed', 'true')
  await ticking.scrollIntoViewIfNeeded()
  expect((await slicerValues(ticking)).size).toBe(1)
  await pause.focus()
  await page.keyboard.press('Space')
  await expect(pause).toHaveAttribute('aria-pressed', 'false')
  expect((await slicerValues(ticking)).size).toBeGreaterThan(1)
})

test('focus moves to the close button on open and back to the card on close', async ({
  page,
}) => {
  // Counts view transitions, so a stray Escape that morphs the grid shows up.
  await page.addInitScript(() => {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown
      morphs?: number
    }
    doc.morphs = 0
    const start = doc.startViewTransition?.bind(doc)
    if (start)
      doc.startViewTransition = (cb) => {
        doc.morphs! += 1
        return start(cb)
      }
  })
  await page.goto(FEED)
  const post = await tickingPost(page)
  const morphs = () =>
    page.evaluate(() => (document as Document & { morphs?: number }).morphs)

  // Escape with nothing open does nothing.
  await page.keyboard.press('Escape')
  expect(await morphs()).toBe(0)
  await expect(page.locator('.mean-open')).toHaveCount(0)

  const open = post.getByRole('button', { name: /^Open chart: \S/ })
  await open.click()
  await expect(post).toHaveClass(/mean-open/)
  await expect(
    post.getByRole('button', { name: /^Close chart: / }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(post).not.toHaveClass(/mean-open/)
  await expect(open).toBeFocused()
})

test('the name is there at first paint and the map sleeps after the hero', async ({
  page,
}) => {
  // A slow map must not hold the name back or fly in under it.
  await page.route('**/umap.json', async (route) => {
    await new Promise((r) => setTimeout(r, 2000))
    await route.fulfill({ response: await route.fetch() })
  })
  await page.goto('/')
  await expect(page.locator('.home-name')).toHaveCSS('opacity', '1')
  const backdrop = page.locator('.home-backdrop')
  await expect(backdrop).toHaveAttribute('data-ready', 'true', {
    timeout: 15_000,
  })
  await expect(backdrop).toHaveAttribute('data-intro', 'late')
  await expect(backdrop).toHaveAttribute('data-paused', 'false')
  await page.evaluate(() => scrollTo(0, innerHeight * 2))
  await expect(backdrop).toHaveAttribute('data-paused', 'true')
})

test('posts whose data is withdrawn or past its valid_until date leave the feed', async ({
  page,
}) => {
  // The withdrawn company files' own posts are dropped from the feed, so a live post's file is
  // routed through each state instead: withdrawn, past its date, and ahead of it.
  const POST = '[data-post="job-cluster-kpis"]'
  const FILE = '**/jobs/cluster-summary.json'
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  // A fresh document each time: going to the same address with a hash would not reload it.
  const jobs = async () => {
    await page.goto('about:blank')
    await page.goto(FEED)
    await page
      .locator('#mean-jobs')
      .evaluate((el) => el.scrollIntoView({ block: 'start' }))
  }
  const serve = (patch: object | null) =>
    page.route(FILE, async (route) => {
      const real = await (await route.fetch()).json()
      await route.fulfill({
        json: patch ? { ...real, ...patch } : { state: 'unavailable' },
      })
    })
  const until = (days: number) => ({
    valid_until: new Date(Date.now() + days * 86_400_000).toISOString(),
  })

  await serve(null)
  await jobs()
  await expect(page.locator(POST)).toHaveCount(0)
  // Leaving is quiet: nothing at all in the console.
  expect(errors).toEqual([])

  await page.unroute(FILE)
  await serve(until(-1))
  await jobs()
  await expect(page.locator(POST)).toHaveCount(0)

  await page.unroute(FILE)
  await serve(until(1))
  await jobs()
  const post = page.locator(POST)
  await post.evaluate((el) => el.scrollIntoView())
  await expect(post).toContainText('candidate ads')
})

test('the Source panel opens from the keyboard and says what is not recorded', async ({
  page,
}) => {
  // No status and an empty provenance file: no freshness or cost rows, and no lineage.
  await page.route('**/status/ingestion.json', (route) => route.abort())
  await page.route('**/architecture/feed-provenance.json', (route) =>
    route.fulfill({ json: { paths: {}, deliveries: {} } }),
  )
  await page.goto(FEED)
  const post = await tickingPost(page)
  await post.getByRole('button', { name: /^Open chart: \S/ }).click()
  const toggle = post.getByRole('button', { name: 'Source', exact: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).not.toHaveAttribute('aria-controls')

  await toggle.focus()
  await page.keyboard.press('Enter')
  const panel = post.getByRole('region', { name: 'Where this comes from' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(toggle).toHaveAttribute(
    'aria-controls',
    (await panel.getAttribute('id'))!,
  )
  await expect(panel).toContainText('Lineage not recorded')
  await expect(
    panel.locator('dt', { hasText: /^(Ingested|Cost)$/ }),
  ).toHaveCount(0)
  await expect(post.locator('.mean-body')).toHaveAttribute('inert', '')

  await page.keyboard.press('Space')
  await expect(panel).toHaveCount(0)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(post.locator('.mean-body')).not.toHaveAttribute('inert')
})

test('the feed wears the site charcoal tokens and its text passes contrast', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the same markup on a phone')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(FEED)
  const feed = page.locator('.mean-page')
  await expect(feed.locator('.mean-post').first()).toBeAttached()
  await page.waitForLoadState('networkidle')
  // The page is the site's charcoal, not a palette of its own, and chapters have no rule.
  await expect(feed).toHaveCSS('background-color', 'rgb(36, 36, 34)')
  await expect(feed.locator('.mean-section-head').first()).toHaveCSS(
    'border-bottom-width',
    '0px',
  )
  const { default: AxeBuilder } = await import('@axe-core/playwright')
  const result = await new AxeBuilder({ page })
    .include('.mean-page')
    .withRules(['color-contrast'])
    .analyze()
  expect(result.violations.map((v) => v.nodes[0]?.target.join(' '))).toEqual([])
})
