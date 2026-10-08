import { test, expect } from './test'

test('the intro plays once per session and leaves the name and titles in place', async ({
  page,
}) => {
  await page.goto('/')
  const intro = page.locator('.intro')
  await expect(intro).toHaveClass(/is-playing/)
  // The text is real and in the layout from the start; the bars only cover it for a moment.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Anton Ernstsson',
  )
  const before = await page.locator('.intro-name').boundingBox()
  await expect(intro).not.toHaveClass(/is-playing/, { timeout: 4000 })
  expect(await page.locator('.intro-name').boundingBox()).toEqual(before)
  await expect(page.locator('.intro-titles li')).toHaveText([
    'Software Developer',
    'Data Engineering',
    'AI Engineering',
  ])
  await expect(page.locator('.intro-band').first()).toBeHidden()
  // No sideways scroll, and the name row sits near the middle of the first screen.
  const layout = await page.evaluate(() => {
    const name = document.querySelector('.intro-name')!.getBoundingClientRect()
    return {
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      middle: (name.top + name.height / 2) / window.innerHeight,
    }
  })
  expect(layout.overflow).toBe(0)
  expect(layout.middle).toBeGreaterThan(0.4)
  expect(layout.middle).toBeLessThan(0.65)
  // Same session: straight to the final state.
  await page.reload()
  await expect(page.locator('.intro')).not.toHaveClass(/is-playing/)
})

test('with reduced motion the intro does not play', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.intro')).not.toHaveClass(/is-playing/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
