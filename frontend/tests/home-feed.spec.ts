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
    const first = feed.locator('.mean-post').first()
    await expect(first).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(first.locator('svg, .mean-body > div').first()).toBeVisible()

    // A thumbnail with a slicer steps by itself while on screen.
    const ticking = feed
      .locator('.mean-post:not([data-dense]):has(.mean-slicer)')
      .first()
    await scrollTo(page, ticking)
    const checked = ticking.locator('.mean-slicer [aria-checked="true"]')
    const before = await checked.textContent()
    await expect.poll(() => checked.textContent()).not.toBe(before)

    await first.scrollIntoViewIfNeeded()
    await first.getByRole('button', { name: 'Open chart' }).click()
    await expect(first).toHaveClass(/mean-open/)
    await expect(
      first.locator('.mean-legend, .mean-slicer').first(),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(first).not.toHaveClass(/mean-open/)
  },
)

test('reduced motion keeps the feed thumbnails still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const feed = page.locator('.home-feed')
  await feed.evaluate((el) => el.scrollIntoView({ behavior: 'instant' }))
  const ticking = feed
    .locator('.mean-post:not([data-dense]):has(.mean-slicer)')
    .first()
  await scrollTo(page, ticking)
  const checked = ticking.locator('.mean-slicer [aria-checked="true"]')
  const before = await checked.textContent()
  await page.waitForTimeout(1500)
  await expect(checked).toHaveText(before ?? '')
})
