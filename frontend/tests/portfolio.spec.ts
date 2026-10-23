import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test(
  'the IT job UMAP sits beside Projects without a project button',
  { tag: '@mobile' },
  async ({ page, isMobile }) => {
    await page.goto('/')
    await page
      .locator('.home-work')
      .evaluate((el) => el.scrollIntoView({ behavior: 'instant' }))
    const preview = page.locator('.home-cluster-preview[data-kind="jobs"]')
    await expect(preview.getByRole('img')).toBeVisible()
    await expect(preview.locator('figcaption')).toHaveText('UMAP of IT job ads')
    await expect(preview.locator('a, button')).toHaveCount(0)
    await expect(preview).toHaveAttribute('data-ready', 'true')
    await expect(preview.locator('img')).toHaveCount(0)
    await expect(preview).toHaveAttribute('data-points', '28698')
    await expect
      .poll(() =>
        preview.locator('canvas').evaluate((el: HTMLCanvasElement) => el.width),
      )
      .toBeGreaterThan(0)
    const layout = await page.evaluate(() => {
      // The map centres on the job assistant's slot, 80 px above its middle.
      const anchor = document.querySelector('#jobs')!.getBoundingClientRect()
      const list = document
        .querySelector('.home-project-groups > section')!
        .getBoundingClientRect()
      const map = document
        .querySelector('.home-cluster-preview[data-kind="jobs"]')!
        .getBoundingClientRect()
      const titleText = document.createRange()
      titleText.selectNodeContents(document.querySelector('#projects-title')!)
      return {
        rightOfTitle:
          map.left + map.width / 2 > titleText.getBoundingClientRect().right,
        centerAligned:
          Math.abs(
            document
              .querySelector(
                '.home-cluster-preview[data-kind="jobs"] .home-cluster-space',
              )!
              .getBoundingClientRect().top +
              document
                .querySelector(
                  '.home-cluster-preview[data-kind="jobs"] .home-cluster-space',
                )!
                .getBoundingClientRect().height /
                2 -
              (anchor.top + anchor.height / 2 - 80),
          ) < 2,
        aboveList: map.bottom <= list.top,
        fits: document.documentElement.scrollWidth <= innerWidth,
      }
    })
    expect(layout.fits).toBe(true)
    expect(
      isMobile ? layout.aboveList : layout.rightOfTitle && layout.centerAligned,
    ).toBe(true)
  },
)

test('the IT job UMAP fades out away from its section and returns on scroll back', async ({
  page,
}) => {
  await page.goto('/')
  const preview = page.locator('.home-cluster-preview[data-kind="jobs"]')
  const opacity = () =>
    preview
      .locator('.home-cluster-space')
      .evaluate((el) => Number(getComputedStyle(el).opacity))
  await expect.poll(opacity).toBeLessThan(0.05)
  const enter = () =>
    preview.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      window.scrollTo({
        top: scrollY + rect.top - innerHeight + rect.height * 0.15,
        behavior: 'instant',
      })
    })
  const leave = () =>
    preview.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      window.scrollTo({
        top: scrollY + rect.bottom - rect.height * 0.15,
        behavior: 'instant',
      })
    })
  await enter()
  await expect.poll(opacity).toBeGreaterThan(0.05)
  await expect.poll(opacity).toBeLessThan(0.95)
  await preview.evaluate((el) =>
    el.scrollIntoView({ block: 'center', behavior: 'instant' }),
  )
  await expect.poll(opacity).toBeGreaterThan(0.95)
  await leave()
  await expect.poll(opacity).toBeGreaterThan(0.05)
  await expect.poll(opacity).toBeLessThan(0.95)
  await preview.evaluate((el) =>
    window.scrollTo({
      top: scrollY + el.getBoundingClientRect().bottom + 50,
      behavior: 'instant',
    }),
  )
  await expect.poll(opacity).toBeLessThan(0.05)
  const ghost = page.locator('.home-cluster-ghost[data-kind="jobs"]')
  await expect
    .poll(() => ghost.evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBeGreaterThan(0.015)
  await expect
    .poll(() => ghost.evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBeLessThan(0.05)
  await leave()
  await expect.poll(opacity).toBeGreaterThan(0.05)
  await expect.poll(opacity).toBeLessThan(0.95)
  await preview.evaluate((el) =>
    el.scrollIntoView({ block: 'center', behavior: 'instant' }),
  )
  await expect.poll(opacity).toBeGreaterThan(0.95)
  await enter()
  await expect.poll(opacity).toBeGreaterThan(0.05)
  await expect.poll(opacity).toBeLessThan(0.95)
})

test('the smaller IT job UMAP floats without edge fading and respects reduced motion', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .locator('.home-work')
    .evaluate((el) => el.scrollIntoView({ behavior: 'instant' }))
  const preview = page.locator('.home-cluster-preview[data-kind="jobs"]')
  await expect(preview).toHaveAttribute('data-ready', 'true')
  await expect(preview.locator('canvas')).toHaveCount(1)
  await expect(
    page.locator('.home-cluster-ghost[data-kind="jobs"] canvas'),
  ).toHaveCount(1)
  await expect(preview.locator('canvas')).toHaveCSS(
    'animation-name',
    'home-job-cluster-float',
  )
  await expect(preview.locator('.home-cluster-space')).toHaveCSS(
    'mask-image',
    'none',
  )
  await page.mouse.move(1100, 250)
  await expect(preview.locator('.home-cluster-space')).toHaveCSS(
    'transform',
    'none',
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(preview.locator('canvas')).toHaveCSS('animation-name', 'none')
  await expect(preview.locator('.home-cluster-space')).toHaveCSS(
    'animation-name',
    'none',
  )
})

test('only the IT job visualization remains faintly present in the background', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.locator(
      '.home-cluster-preview[data-kind="symbolic"], .home-cluster-ghost[data-kind="symbolic"]',
    ),
  ).toHaveCount(0)
  for (const kind of ['jobs']) {
    await expect(
      page.locator(`.home-cluster-preview[data-kind="${kind}"]`),
    ).toHaveAttribute('data-ready', 'true')
    const background = page.locator(`.home-cluster-ghost[data-kind="${kind}"]`)
    await expect(background).toHaveAttribute('aria-hidden', 'true')
    await expect
      .poll(() =>
        background.evaluate((el) => Number(getComputedStyle(el).opacity)),
      )
      .toBeGreaterThan(0.015)
    await expect
      .poll(() =>
        background.evaluate((el) => Number(getComputedStyle(el).opacity)),
      )
      .toBeLessThan(0.04)
  }
})

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
  'the intro eases scrolling and reveals navigation at projects',
  { tag: '@mobile' },
  async ({ page, isMobile }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('ANTON ERNSTSSON DATA & AI')
    const header = page.locator('.site-header')
    await expect(header).not.toBeVisible()
    await expect(header).toHaveAttribute('inert', '')
    if (!isMobile) {
      await page.mouse.wheel(0, 300)
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(200)
      expect(await page.evaluate(() => scrollY)).toBeLessThan(300)
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(246)
    }
    const cta = page.locator('.home-cta-link')
    await expect(page.locator('#start .home-cta-link')).toHaveCount(0)
    await page.keyboard.press('End')
    await cta.evaluate((el) => el.scrollIntoView({ behavior: 'instant' }))
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollHeight - innerHeight - scrollY,
        ),
      )
      .toBeLessThan(2)
    await expect(header).toBeVisible()
    await expect(header).not.toHaveAttribute('inert', '')
    await expect(page.locator('.home-group-title')).toHaveCount(0)
    // The start page stands alone: the platform leads with its code, then three more
    // repositories on GitHub and three research write-ups.
    await expect(
      page.locator('#platform .home-flagship-links a').last(),
    ).toHaveAttribute('href', 'https://github.com/korv9/anton-portfolio')
    const repos = page.locator('.home-project-groups .work-card')
    await expect(repos).toHaveCount(3)
    await expect(repos.first()).toHaveAttribute(
      'href',
      'https://github.com/korv9/DrugComb-Synergy-Prediction',
    )
    await expect(page.locator('#research .work-card')).toHaveCount(3)
    await expect(
      page.locator(
        'main a[href^="#"]:not([href^="#om-mig"]):not([href="#start"]):not([href="#main"])',
      ),
    ).toHaveCount(0)
    await expect
      .poll(() =>
        page
          .locator('.home-backdrop')
          .evaluate((el) => Number(getComputedStyle(el).opacity)),
      )
      .toBeLessThan(0.1)
    await expect(cta).toHaveAttribute('href', 'https://github.com/korv9')
  },
)

test('the background finishes its fast intro with fully coloured points', async ({
  page,
}) => {
  await page.goto('/')
  const backdrop = page.locator('.home-backdrop')
  const canvas = backdrop.locator('canvas').first()
  await expect(backdrop).toHaveAttribute('data-ready', 'true', {
    timeout: 20000,
  })
  await expect(backdrop).toHaveAttribute('data-intro', 'false', {
    timeout: 20000,
  })
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

test('the projects page lists every retained project', async ({ page }) => {
  // Not linked from the published start page; local dev still opens it.
  await page.goto('/#projekt')
  await expect(page).toHaveTitle('Projects | Anton Ernstsson')
  await expect(page.locator('.projects-group')).toHaveCount(0)
  // SWEDEN is featured above the list; the other projects follow.
  await expect(
    page.locator('.project-card-featured[href="#sweden"]'),
  ).toHaveCount(1)
  await expect(page.locator('.projects-list .project-card')).toHaveCount(7)
  await expect(page.locator('.project-card[href="#politik"]')).toHaveCount(0)
  await expect(page.locator('.project-card[href="#thesis"]')).toHaveCount(0)
  await expect(page.locator('.project-card[href="#drugcomb"]')).toContainText(
    'Drug Synergy Lab',
  )
})
