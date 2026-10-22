/**
 * The chart feed that closes Projects on the home page: it loads when the reader nears it,
 * wears the home page's light colours, keeps its thumbnails moving and opens a card on click.
 */
import type { Locator, Page } from '@playwright/test'
import { test, expect } from './test'

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
  const feed = page.locator('.home-feed')
  await feed.evaluate((el) => el.scrollIntoView({ behavior: 'instant' }))
  const ticking = feed
    .locator('.mean-post:not([data-dense]):has(.mean-now)')
    .first()
  await scrollTo(page, ticking)
  // Pinned by id: `.first()` would move on as other posts mount and unmount.
  return page.locator(
    `[data-post="${await ticking.getAttribute('data-post')}"]`,
  )
}

/** Samples the checked slicer option over about 1.5 s and returns the distinct values seen. */
async function slicerValues(post: Locator) {
  const checked = post.locator('.mean-slicer [aria-checked="true"]')
  const seen: (string | null)[] = []
  await expect
    .poll(
      async () => {
        seen.push(await checked.textContent())
        return seen.length
      },
      { intervals: [300] },
    )
    .toBeGreaterThanOrEqual(6)
  return new Set(seen)
}

test(
  'the chart feed closes Projects with living posts that open',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/')
    // Nothing of the feed loads before the reader scrolls towards it.
    await expect(page.locator('.mean-post')).toHaveCount(0)
    const feed = page.locator('.home-work > .home-feed')
    await feed.evaluate((el) => el.scrollIntoView({ behavior: 'instant' }))
    await expect(
      feed.getByRole('heading', { level: 2, name: 'What does it even mean?' }),
    ).toBeVisible()
    await expect(
      page.locator('.home-work > :last-child.home-feed'),
    ).toHaveCount(1)
    await expect
      .poll(() => feed.locator('.mean-post').count())
      .toBeGreaterThan(100)
    // The feed reads by subject, politics first.
    await expect(
      feed.getByRole('heading', { level: 3, name: 'Politics' }),
    ).toBeVisible()
    const first = feed.locator('.mean-post').first()
    // Cards wear the light palette's card token.
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
  await page.goto('/')
  const ticking = await tickingPost(page)
  expect((await slicerValues(ticking)).size).toBe(1)
})

test('a section pause button holds its thumbnails until pressed again', async ({
  page,
}) => {
  await page.goto('/')
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
  await page.goto('/')
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

test('posts whose data is past its valid_until date leave the feed', async ({
  page,
}) => {
  const ADS = '[data-post="job-co-remote"]'
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  // The published company snapshot is past its date: its posts render nothing.
  await page.goto('/')
  await page.locator('.home-feed').evaluate((el) => el.scrollIntoView())
  await page.locator(ADS).evaluate((el) => el.scrollIntoView())
  await expect(page.locator(ADS)).toHaveCount(0)
  // Leaving is quiet: nothing at all in the console.
  expect(errors).toEqual([])

  // The same data with a date still ahead renders the post.
  await page.route('**/jobs/company-intelligence.json', async (route) => {
    const json = await (await route.fetch()).json()
    json.valid_until = new Date(Date.now() + 86_400_000).toISOString()
    await route.fulfill({ json })
  })
  await page.goto('/')
  await page.locator('.home-feed').evaluate((el) => el.scrollIntoView())
  const post = page.locator(ADS)
  await post.evaluate((el) => el.scrollIntoView())
  await expect(post).toContainText('of ads mention remote work')
})
