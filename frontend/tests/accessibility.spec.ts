/**
 * The redesign's promises, checked on the main pages: axe finds no violations (contrast on
 * the grey page and on the dark plates included), nothing scrolls sideways on a phone or a
 * tablet, keyboard focus is visible, and reduced motion is honoured.
 */
import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './test'

const PAGES = [
  '#start',
  '#projekt',
  '#drugcomb',
  '#concept-constellation',
  '#philosophy-atlas',
  '#symbolic-atlas',
  '#thesis',
  '#cluster-visuals',
]

for (const path of PAGES) {
  test(`${path} has no axe violations`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'the same markup on a phone')
    // Reveal animations finished, so contrast is measured on the settled page.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/${path}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('a[href="#"], a:not([href])')).toHaveCount(0)
    const result = await new AxeBuilder({ page })
      .include('main')
      // Canvas and SVG charts carry their text alternatives on the figure.
      .exclude('canvas')
      .analyze()
    const summary = result.violations.map(
      (v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`,
    )
    expect(summary).toEqual([])
  })
}

for (const width of [320, 768, 1440]) {
  test(`nothing scrolls sideways at ${width}px`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'sets its own viewport')
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 900 })
    const wide: string[] = []
    for (const path of PAGES) {
      await page.goto(`/${path}`)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      if (overflow > 1) wide.push(`${path} +${overflow}px`)
    }
    expect(wide).toEqual([])
  })
}

test('keyboard focus is visible on the first controls', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'no keyboard on a phone')
  await page.goto('/#start')
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      const s = getComputedStyle(el)
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }
    })
    expect(outline.style).not.toBe('none')
    expect(outline.width).toBeGreaterThanOrEqual(2)
  }
})

test('reduced motion stops transitions', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the same CSS on a phone')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const backdrop = page.locator('.home-backdrop')
  await expect(backdrop).toHaveAttribute('data-ready', 'true', {
    timeout: 20000,
  })
  await expect(backdrop).toHaveAttribute('data-intro', 'false')
  await expect(page.locator('.home-umap-intro')).toHaveCount(0)
  await expect(page.locator('.home-backdrop-toggle')).toHaveCount(0)
  await expect(backdrop.locator('canvas').first()).toHaveCSS(
    'animation-name',
    'none',
  )
})
