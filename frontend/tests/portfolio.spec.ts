import { test, expect } from './test'

test(
  'education presents thesis evidence and its technology stack',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#utbildning')
    const thesis = page
      .locator('#utbildning .home-job')
      .filter({ hasText: 'Degree project' })
    // The case-study page is offline, so the title is plain text.
    await expect(thesis.locator('h3 a')).toHaveCount(0)
    await expect(thesis.locator('h3')).toHaveText(
      'Degree project: Finding recurring IT problems with NLP',
    )
    await expect(thesis.locator('.home-job-role').first()).toHaveText(
      'Case study, spring 2026',
    )
    await expect(thesis.locator('li')).toHaveCount(0)
    await expect(thesis).toContainText(
      'clustering 16,811 of them gave 121 groups, 72 with no link',
    )
    await expect(thesis).toContainText('12 groups containing 650 tickets')
    await expect(thesis).toContainText('ISO/IEC 25012')
    await expect(thesis).toContainText('21,633')
    await expect(thesis).toContainText('operational review')
    await expect(thesis).toContainText('Missing root-cause documentation')
    await expect(thesis).toContainText('Tech: Python, Azure Databricks')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
  },
)

test('education follows experience in one column, beside the cluster maps', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'one column with one map on a phone')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/#erfarenhet')
  await page.evaluate(() => document.fonts.ready)
  const box = (selector: string) =>
    page
      .locator(selector)
      .evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect)
  // Both titles in one frame: the page may still be scrolling smoothly to #erfarenhet, and two
  // separate reads would compare positions from two scroll offsets.
  const [experience, education] = await page.evaluate(() =>
    ['.home-experience .home-title', '.home-education .home-title'].map(
      (s) =>
        document.querySelector(s)!.getBoundingClientRect().toJSON() as DOMRect,
    ),
  )
  expect(Math.abs(experience.left - education.left)).toBeLessThan(0.5)
  expect(education.top).toBeGreaterThan(experience.bottom)
  const column = await box('.home-experience')
  expect(column.width).toBeLessThanOrEqual(641)
  // The maps sit to the right and stay beside the reading: decorative, drawn, one per slot.
  const maps = page.locator('.home-map3d')
  await expect(maps).toHaveCount(3)
  expect((await box('.home-maps')).left).toBeGreaterThan(column.right)
  await expect(maps.first()).toHaveCSS('position', 'sticky')
  await expect(maps.first()).toHaveAttribute('data-ready', 'true', {
    timeout: 20000,
  })
  await expect(maps.first().locator('.home-map3d-scene')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await expect(maps.first().locator('canvas')).toHaveCount(3)
})

test(
  'the start page is about Anton: the name, then About with contact, the profile and one way on',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('ANTON ERNSTSSON DATA & AI')
    // No header, and only the name and the role on the first screen.
    await expect(page.locator('.site-header')).toHaveCount(0)
    await expect(page.locator('#start h1')).toHaveText('Anton Ernstsson')
    await expect(page.locator('#start .home-role')).toHaveText(
      'Data & AI Engineering',
    )
    await expect(page.locator('#start a, #start button')).toHaveCount(0)
    const contact = page.locator('#kontakt')
    await expect(contact).not.toBeInViewport()
    await contact.scrollIntoViewIfNeeded()
    await expect(contact.getByRole('link', { name: 'LinkedIn' })).toBeVisible()
    await expect(contact.getByRole('link', { name: 'GitHub' })).toBeVisible()
    await expect(contact.getByRole('button', { name: /View CV/ })).toBeVisible()
    await expect(contact.locator('a[href^="mailto:"]')).toBeVisible()
    // About with contact under it, then experience and education; no project-pages section.
    await expect(page.locator('#projektsidor')).toHaveCount(0)
    await expect(page.getByText('Feedback or ideas are welcome')).toHaveCount(0)
    const top = (id: string) =>
      page
        .locator(`#${id}`)
        .evaluate((el) => el.getBoundingClientRect().top + scrollY)
    expect(await top('om-mig')).toBeLessThan(await top('kontakt'))
    await expect(page.locator('#om-mig #kontakt')).toHaveCount(1)
    expect(await top('om-mig')).toBeLessThan(await top('erfarenhet'))
    expect(await top('om-mig')).toBeLessThan(await top('utbildning'))
    // No project content: the links inside the page lead on to the projects hub.
    expect(
      await page
        .locator('main a[href^="#"]')
        .evaluateAll((as) => as.map((a) => a.getAttribute('href'))),
    ).toEqual(['#projects'])
    await expect(
      page.locator('.work-card, .home-feed, .mean-post'),
    ).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
  },
)

test('the background finishes its fast intro with fully coloured points', async ({
  page,
}) => {
  // A fast machine: page time stands still until the map is in, so it arrives inside the intro
  // window. A busy CI runner parses the 7.7 MB map more slowly and rightly takes the late path,
  // which home-feed.spec.ts covers.
  await page.clock.install()
  await page.clock.pauseAt(Date.now() + 1000)
  await page.goto('/')
  const backdrop = page.locator('.home-backdrop')
  const canvas = backdrop.locator('canvas').first()
  await expect(backdrop).toHaveAttribute('data-ready', 'true', {
    timeout: 20000,
  })
  await expect(backdrop).toHaveAttribute('data-intro', 'true')
  await page.clock.resume()
  await expect(backdrop).toHaveAttribute('data-intro', 'false')
  await expect(backdrop).toHaveAttribute('aria-hidden', 'true')
  await expect(canvas).toBeVisible()
  await expect(page.locator('.home-backdrop-toggle')).toHaveCount(0)
  await expect(backdrop.locator('.home-backdrop-scene')).toHaveCSS(
    'opacity',
    '1',
  )
  await expect(backdrop.locator('.home-backdrop-scene')).toHaveCSS(
    'mask-image',
    'none',
  )
  expect(
    await canvas.evaluate(
      (el: HTMLCanvasElement) => el.getContext('2d')?.globalAlpha,
    ),
  ).toBe(1)
  await expect(canvas).toHaveCSS('animation-play-state', 'running')
  await page.evaluate(() => {
    location.hash = 'cluster-visuals'
  })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Cluster visuals',
  )
  await page.evaluate(() => {
    location.hash = ''
  })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Anton Ernstsson',
  )
  await expect(backdrop).toHaveAttribute('data-intro', 'false')
  await expect(page.locator('.home-umap-intro')).toHaveCount(0)
})

test('home remains usable when the decorative debate map is unavailable', async ({
  page,
}) => {
  await page.route('**/umap.json', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  )
  const failedMap = page.waitForResponse((response) =>
    response.url().endsWith('/umap.json'),
  )
  await page.goto('/')
  await failedMap
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Anton Ernstsson',
  )
  await expect(page.locator('.home-backdrop')).toHaveAttribute(
    'data-ready',
    'false',
  )
  await expect(page.locator('.home-backdrop-toggle')).toHaveCount(0)
  await expect(page.locator('#start nav')).toHaveCount(0)
})

test('Projects opens the Overview: how and why the platform is built, and its numbers', async ({
  page,
}) => {
  await page.goto('/#projekt')
  await expect(page).toHaveURL(/#projects$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview')
  await expect(page.locator('.page-head-kpis > div')).toHaveCount(4)
  await expect(page.locator('.page-head-kpis dd').first()).toHaveText(/M$/)
  await expect(page.locator('.hub-why dt')).toHaveText(['How', 'Why'])
  // No project list: the index is the way into the projects.
  await expect(page.locator('.hub-item')).toHaveCount(0)
  // The platform page is gone; its old addresses land on the Overview.
  for (const old of ['#platform', '#projects-platform', '#ask-platform']) {
    await page.goto('/' + old)
    await expect(page).toHaveURL(/#projects$/)
  }
})
