import { test, expect } from './test'

// docs/site-goals.md, "One look": every product route is ivory on charcoal, its page title in the
// Helvetica Neue stack and the signature's gradient, and no rules between sections. Same routes as
// scripts/goals.mjs.
const ROUTES = [
  '#start',
  '#projects',
  '#jobs',
  '#sweden',
  '#sweden-matning',
  '#sweden-arbete',
  '#sweden-likhet',
  '#sweden-tillhorighet',
  '#sweden-framtid',
  '#sweden-samband',
  '#what-does-it-even-mean',
  '#fraga-lagen',
  '#cluster-visuals',
  '#projects-platform',
  '#symbolic-atlas',
  '#philosophy-atlas',
  '#concept-journey',
  '#thesis',
  '#drugcomb',
  '#homie',
  '#replik',
  '#lag-ankomst',
  '#sweden-valfard',
]

for (const route of ROUTES) {
  test(`${route} has the one look`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'checked at 1440; the phone layout shares the CSS')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/${route}`)
    const h1 = page.locator('#main h1, main h1').first()
    await expect(h1).toBeVisible()
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      'rgb(36, 36, 34)',
    )
    const look = await page.evaluate(() => {
      const title = document.querySelector('#main h1, main h1')!
      const s = getComputedStyle(title)
      const clip =
        s.backgroundClip ||
        (s as unknown as { webkitBackgroundClip: string }).webkitBackgroundClip
      // A rule is a line on only the top or bottom of a block (a box with four sides is a card).
      const visible = (width: string, style: string, color: string) =>
        parseFloat(width) >= 1 &&
        style !== 'none' &&
        style !== 'hidden' &&
        !/rgba\(.*, 0\)$|transparent/.test(color)
      const rules = [
        ...document.querySelectorAll<HTMLElement>(
          'section, header, footer, nav, article, details, hr, [role="separator"], #main h2',
        ),
      ]
        .filter((el) => el.getClientRects().length > 0)
        // Data tables, charts and forms keep their lines.
        .filter((el) => !el.closest('table, svg, form, fieldset, canvas'))
        .filter((el) => {
          const c = getComputedStyle(el)
          if (el.tagName === 'HR') return c.visibility !== 'hidden'
          const top = visible(
            c.borderTopWidth,
            c.borderTopStyle,
            c.borderTopColor,
          )
          const bottom = visible(
            c.borderBottomWidth,
            c.borderBottomStyle,
            c.borderBottomColor,
          )
          const side =
            visible(c.borderLeftWidth, c.borderLeftStyle, c.borderLeftColor) ||
            visible(c.borderRightWidth, c.borderRightStyle, c.borderRightColor)
          return (top || bottom) && !side
        })
        .map(
          (el) =>
            `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`,
        )
      return {
        gradient:
          clip === 'text' && s.backgroundImage.includes('gradient')
            ? 'ok'
            : `${clip} / ${s.backgroundImage}`,
        font: s.fontFamily,
        rules,
      }
    })
    expect(look.gradient, 'h1 uses the signature gradient').toBe('ok')
    expect(look.font, 'h1 uses the Helvetica Neue stack').toMatch(
      /^"?Helvetica Neue"?/,
    )
    expect(look.rules, 'no rules between sections').toEqual([])
  })
}
