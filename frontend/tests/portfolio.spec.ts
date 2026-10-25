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
    await expect(thesis).toContainText('Of 121 clusters, 72 had no link')
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

test('experience and education stay aligned while scrolling', async ({
  page,
}) => {
  await page.goto('/#erfarenhet')
  await expect(page.locator('.home-experience')).toHaveCSS(
    'animation-name',
    'none',
  )
  await expect(page.locator('.home-education')).toHaveCSS(
    'animation-name',
    'none',
  )
  await page.evaluate(() => document.fonts.ready)
  const start = await page
    .locator('.home-experience')
    .evaluate((el) => el.getBoundingClientRect().top + scrollY)
  for (const offset of [0, 200, 500]) {
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: 'instant' }),
      start + offset,
    )
    await expect
      .poll(() =>
        page.evaluate(() => {
          const experience = document
            .querySelector('.home-experience .home-title')!
            .getBoundingClientRect()
          const education = document
            .querySelector('.home-education .home-title')!
            .getBoundingClientRect()
          return Math.abs(experience.top - education.top)
        }),
      )
      .toBeLessThan(0.5)
  }
})

test(
  'the start page is about Anton: the name, then contact, profile and one way on',
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
    // Contact, the project pages, then About, then experience and education.
    const projects = page.locator('#projektsidor')
    await expect(
      projects.getByRole('heading', { name: 'Project pages' }),
    ).toBeVisible()
    await expect(
      projects.getByRole('link', { name: 'See the projects' }),
    ).toHaveAttribute('href', '#projects')
    const top = (id: string) =>
      page
        .locator(`#${id}`)
        .evaluate((el) => el.getBoundingClientRect().top + scrollY)
    expect(await top('kontakt')).toBeLessThan(await top('projektsidor'))
    expect(await top('projektsidor')).toBeLessThan(await top('om-mig'))
    expect(await top('om-mig')).toBeLessThan(await top('erfarenhet'))
    expect(await top('om-mig')).toBeLessThan(await top('utbildning'))
    // No project content: the links inside the page lead on to the projects hub.
    expect(
      await page
        .locator('main a[href^="#"]')
        .evaluateAll((as) => as.map((a) => a.getAttribute('href'))),
    ).toEqual(['#projects', '#projects'])
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
  await expect(page.locator('.site-header')).toBeVisible()
  // Every figure group names the file it was read from.
  await expect(
    page.locator('.hub-kpis', { hasText: 'schema/summary.json' }),
  ).toBeVisible()
  // Job search first, opening the job assistant.
  await expect(page.locator('.hub-item-kicker').first()).toHaveText(
    'Job search',
  )
  await expect(page.locator('#projects-jobs a[href="#jobs"]')).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Projects' })
  for (const name of ['Job search', 'SWEDEN', 'Ask the law', 'Platform'])
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible()
  // The platform is a part of the hub; its old address leads there.
  await page.goto('/#platform')
  await expect(page).toHaveURL(/#projects-platform$/)
  await expect(
    page.getByRole('heading', { level: 2, name: 'The data platform' }),
  ).toBeInViewport()
})

test('on a phone the hub sidebar folds into a menu', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/#projects')
  const menu = page.locator('.hub-nav')
  await expect(menu).not.toHaveAttribute('open')
  const nav = page.getByRole('navigation', { name: 'Projects' })
  await expect(nav).toBeHidden()
  await menu.locator('summary').click()
  await expect(nav.getByRole('link', { name: 'Job search' })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
})
