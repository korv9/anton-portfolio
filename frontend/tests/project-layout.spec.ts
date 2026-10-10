import { test, expect } from './test'

const routes = [
  '#politik-valjarna',
  '#politik-roster',
  '#politik-sakdebatter',
  '#jobb-trender',
  '#thesis',
  '#homie',
  '#concept-journey',
  '#sweden',
  '#politik-budget',
  '#politik-partiledardebatter',
]

for (const route of routes) {
  test(`${route} keeps dashboard panels inside the content column`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/${route}`)
    await expect(page.locator('main h1')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.dk-tech').first()).toBeVisible({
      timeout: 30000,
    })
    const problems = await page.evaluate(() => {
      const main = document.querySelector('main')!.getBoundingClientRect()
      return [
        ...document.querySelectorAll(
          'main .dk,main .dk-grid,main .dk-kpis,main .dk-card,main .stage,main .stage-figure,main .stage-side',
        ),
      ].flatMap((element) => {
        const box = element.getBoundingClientRect()
        if (!box.height) return []
        return box.left < main.left - 1 ||
          box.right > main.right + 1 ||
          box.width < 150
          ? [
              {
                className: element.className,
                width: box.width,
                left: box.left,
                right: box.right,
              },
            ]
          : []
      })
    })
    expect(problems).toEqual([])
    const inset = await page
      .locator('main h1')
      .evaluate(
        (title) =>
          title.getBoundingClientRect().left -
          document.querySelector('main')!.getBoundingClientRect().left,
      )
    expect(inset).toBeGreaterThanOrEqual(15)
  })
}

test('the page title comes before the KPI row in visual projects', async ({
  page,
}) => {
  for (const route of [
    '#thesis',
    '#homie',
    '#concept-journey',
    '#concept-constellation',
  ]) {
    await page.goto(`/${route}`)
    await expect(page.locator('main .dk-kpis').first()).toBeVisible({
      timeout: 30000,
    })
    const titleBeforeMetrics = await page.evaluate(() => {
      const title = document.querySelector('main h1')!
      const metrics = document.querySelector('main .dk-kpis')!
      return !!(
        title.compareDocumentPosition(metrics) &
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    })
    expect(titleBeforeMetrics, route).toBe(true)
  }
})
