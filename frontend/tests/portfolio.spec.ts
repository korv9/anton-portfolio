import AxeBuilder from '@axe-core/playwright'
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
  const experience = await box('.home-experience .home-title')
  const education = await box('.home-education .home-title')
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

test('the projects hub leads with the dashboard and the job search', async ({
  page,
}) => {
  await page.goto('/#projekt')
  await expect(page).toHaveURL(/#projects$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projects')
  // The projects index on wide screens, the header on phones.
  await expect(
    page.locator(
      page.viewportSize()!.width >= 1024 ? '.project-rail' : '.site-header',
    ),
  ).toBeVisible()
  // How the platform is built: seven steps, the job search's path marked.
  const flow = page.locator('#projects-flow')
  await expect(flow.locator('.hub-flow-steps > li')).toHaveCount(7)
  await expect(
    flow.getByRole('button', { name: 'Arbetsförmedla' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(flow.locator('li[data-used]').first()).toBeVisible()
  // Job search first, opening the job assistant.
  await expect(page.locator('.hub-items > li').first()).toHaveAttribute(
    'data-lead',
  )
  await expect(page.locator('#projects-jobs a[href="#jobs"]')).toBeVisible()
  // Every project under one of three parts, ivory on charcoal like the start page.
  for (const name of [
    'Running on the data platform',
    'Experiments',
    'Other projects',
  ])
    await expect(
      page.getByRole('heading', { level: 2, name, exact: true }),
    ).toBeVisible()
  for (const href of [
    '#sweden',
    '#cluster-visuals',
    '#symbolic-atlas',
    '#thesis',
  ])
    await expect(page.locator(`.hub-item[href="${href}"]`)).toBeVisible()
  await expect(page.locator('#projects-sweden .hub-products a')).toHaveCount(7)
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(36, 36, 34)',
  )
  // The platform is a part of the hub; its old address leads there.
  await page.goto('/#platform')
  await expect(page).toHaveURL(/#projects-platform$/)
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'The data platform',
      exact: true,
    }),
  ).toBeInViewport()
})

test('on a phone the hub is one column with the job assistant first', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/#projects')
  await expect(page.locator('.hub-nav')).toHaveCount(0)
  await expect(page.locator('#projects-jobs a[href="#jobs"]')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
})

test('each platform card states a finding in a small chart that answers the keyboard', async ({
  page,
}) => {
  await page.goto('/#projects')
  const sweden = page.locator('#projects-sweden')
  await sweden.scrollIntoViewIfNeeded()
  // The chart loads as its card nears the screen and leads with its finding.
  await expect(sweden.locator('.mini-head')).toContainText(
    'Library visits fell',
  )
  const chart = sweden.getByRole('img')
  await chart.focus()
  await page.keyboard.press('Home')
  await expect(sweden.locator('.mini-tip')).toContainText('2014:')
  await page.keyboard.press('ArrowRight')
  await expect(sweden.locator('.mini-tip')).toContainText('2015:')
  // One toggle per card at most.
  await sweden.getByRole('button', { name: 'Ad language' }).click()
  await expect(sweden.locator('.mini-head')).toContainText('passion')
  const law = page.locator('.hub-items > li', {
    has: page.locator('a[href="#fraga-lagen"]'),
  })
  await law.scrollIntoViewIfNeeded()
  await expect(law.locator('.mini-bar')).toHaveCount(3)
  // Every card's chart, loaded, passes axe.
  const cards = page.locator('.hub-items > li')
  for (let i = 0; i < (await cards.count()); i++)
    await cards.nth(i).scrollIntoViewIfNeeded()
  await expect
    .poll(() => page.locator('.hub-items .mini-head').count())
    .toBeGreaterThanOrEqual(11)
  // Every project row has its picture; the repositories, Homie's among them, close as text links.
  const rows = page.locator('.hub-items:not(.hub-repos) > li')
  await expect(rows.locator('.hub-row-visual')).toHaveCount(await rows.count())
  await expect(page.locator('.hub-repos > li')).toHaveCount(3)
  await expect(
    page.locator('.hub-items > li', { has: page.locator('a[href="#thesis"]') }),
  ).toContainText('72 of the 121')
  const scan = await new AxeBuilder({ page }).include('.hub-items').analyze()
  expect(scan.violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
})
