import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('home introduces Anton and routes to each project', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Anton Ernstsson',
  )
  // A short profile: at most two sentences, and the contact actions on one row.
  const pitch = (await page.locator('.cv-pitch').textContent()) ?? ''
  expect(
    pitch.split(/[.!?](\s|$)/).filter((x) => x.trim()).length,
  ).toBeLessThanOrEqual(2)
  await expect(page.getByRole('link', { name: /Download CV/ })).toHaveAttribute(
    'download',
    '',
  )
  // A CV for each kind of role, all served.
  await page.locator('.cv-more-cvs summary').click()
  await expect(page.locator('.cv-more-cvs a[download]')).toHaveCount(3)
  for (const href of await page
    .locator('.cv-more-cvs a[download]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')))) {
    expect((await page.request.get(`/${href}`)).status(), href!).toBe(200)
  }
  // A note that the site is still being built.
  await expect(page.locator('.home-notice')).toContainText('still being built')
  // Experience and the stack further down.
  await expect(page.locator('#erfarenhet .cv-job')).toHaveCount(4)
  await expect(page.locator('#erfarenhet')).toContainText('Fora')
  await expect(page.locator('#erfarenhet')).toContainText('Avtalat')
  await expect(page.locator('#teknik .cv-stack > div')).toHaveCount(5)
  // The profile as a live bar chart: a click grows a bar and opens what is behind it.
  const live = page.locator('.live')
  const bar = live.locator('.live-col.stack .live-fill').first()
  await bar.click()
  await expect(bar).toHaveAttribute('aria-expanded', 'true')
  const detail = live.locator('.live-detail:not([hidden])')
  await expect(detail).toContainText('Python')
  await page.keyboard.press('Escape')
  await expect(live.locator('.live-detail:not([hidden])')).toHaveCount(0)
  // The politics product leads; three AI projects, and a link to all of them.
  await expect(page.locator('.cv-flagship')).toContainText(
    'Political Observatory',
  )
  await expect(page.locator('.cv-pipeline li')).toHaveCount(5)
  await expect(page.locator('.cv-project')).toHaveCount(3)
  await page.locator('.home-more').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'What I have built',
  )
  expect(await page.locator('.cv-project').count()).toBeGreaterThanOrEqual(10)
  await page.getByRole('button', { name: /AI and ML/ }).click()
  await expect(page.locator('.cv-area')).toHaveCount(1)
  await expect(page.locator('.cv-flagship')).toHaveCount(0)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0)
  await expect(page.locator('#job-market')).toHaveCount(0)
  // The contents menu lists everything on the site, on every screen size.
  await page.getByRole('button', { name: 'Contents' }).click()
  const contents = page.getByRole('dialog', { name: 'Contents' })
  await expect(contents).toBeVisible()
  for (const heading of [
    'About me',
    'Political Observatory',
    'AI and machine learning',
    'Data and software',
  ])
    await expect(contents.getByRole('heading', { name: heading })).toBeVisible()
  await expect(
    contents.getByRole('link', { name: 'Issue debates' }),
  ).toBeVisible()
  // Contrast is checked once the menu has finished opening.
  await contents.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  const results = await new AxeBuilder({ page }).include('#site-map').analyze()
  expect(results.violations.map((v) => v.id)).toEqual([])
  await contents.getByRole('link', { name: 'Overview' }).first().click()
  await expect(contents).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Overview',
  )
  if (!isMobile) {
    await page.goto('/#start')
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Political Observatory' })
      .click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Overview',
    )
  }
  if (!isMobile) {
    // One sidebar for the whole site; in politics it holds the politics navigation.
    const side = page.getByRole('navigation', { name: 'All pages' })
    await expect(side).toBeVisible()
    await page.goto('/#politik')
    await expect(
      side.getByRole('navigation', { name: 'Politics' }),
    ).toBeVisible()
    await side.getByRole('link', { name: 'Technical' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'How it all works',
    )
  }
  // Technical: the architecture, with the numbers read from the dbt export.
  await page.goto('/#technical')
  const schema = await (
    await page.request.get('/data/schema/models.json')
  ).json()
  await expect(page.locator('.tech-kpis')).toContainText(
    schema.tests.toLocaleString('en-GB'),
  )
  await expect(
    page.locator('#tech-layers .tech-table:not(.heat) tbody tr'),
  ).toHaveCount(5)
  expect(await page.locator('#tech-model tbody tr').count()).toBeGreaterThan(10)
  await expect(page.locator('#tech-rag .tech-steps li')).toHaveCount(6)
  await page.goto('/#politics')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Roll calls in detail',
  )
  await page.goto('/#job-market-tech')
  await expect(page.locator('#job-market')).toBeVisible()
  // The IT report's total, from the file the page reads: it changes when a new archive year
  // is added, and the page must show whatever the file says.
  const jobs = await (
    await page.request.get('/data/gold/marts/jobs.json')
  ).json()
  await expect(
    page.getByText(jobs.kpis.ads_total.toLocaleString('en-GB'), {
      exact: true,
    }),
  ).toBeVisible()
  await page.goto('/#drugcomb')
  await expect(page.locator('#drugcomb')).toContainText('396,498')
  await page.goto('/#rfc-drift')
  await expect(page.locator('#rfc-drift')).toBeVisible()
  await page.goto('/#thesis')
  await expect(page.locator('#thesis')).toContainText('review candidates')
  await page.goto('/#homie')
  await expect(page.locator('#homie')).toBeVisible()
  expect(errors).toEqual([])
})

test('language map and job chart retain useful controls', async ({ page }) => {
  await page.goto('/#debates')
  await expect(page.locator('.umap-point')).toHaveCount(400)
  await page.getByRole('button', { name: '2022/23' }).click()
  await expect(page.locator('.point-detail')).toContainText('Selected segment')
  await page.locator('.viz-toolbar select').selectOption('MP')
  await expect(page.locator('.umap-point').first()).toBeVisible()
  await expect(page.locator('.umap-guide')).toContainText(
    'not agreement or a political position',
  )
  await page.goto('/#job-market-tech')
  await page.getByRole('button', { name: 'Data Engineer', exact: true }).click()
  await expect(page.locator('.job-chart-head')).toContainText('Data Engineer')
  const jobs = await (
    await page.request.get('/data/gold/marts/jobs.json')
  ).json()
  const first = jobs.yearly.find(
    (row: { role: string; year: number }) =>
      row.role === 'Data Engineer' && row.year === jobs.years[0],
  )
  await expect(page.locator('.year-totals')).toContainText(
    first.ads.toLocaleString('en-GB'),
  )
})

test('navigation, responsive layout and accessibility', async ({ page }) => {
  // Contrast is checked on the settled page, not halfway through an entrance animation.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Download CV/ })).toHaveAttribute(
    'download',
    '',
  )
  for (const route of [
    '/',
    '/#politics',
    '/#now',
    '/#politik-valjarna',
    '/#politik-roster',
    '/#politik-budget',
    '/#politik-sakdebatter',
    '/#politik-partier',
    '/#politik-partier?partier=M',
    '/#politik-partiledardebatter',
    '/#politik-tal',
    '/#politik-utforska',
    '/#politik-kallor',
    '/#politik-skatter',
    '/#politik-utredningar',
    '/#jobb',
    '/#jobb-yrken',
    '/#jobb-lan',
    '/#issue-arbete',
    '/#budget-comparison',
    '/#drugcomb',
    '/#sweden',
    '/#status',
    '/#projekt',
    '/#technical',
  ]) {
    await page.goto(route)
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true)
    }
  }
  await page.goto('/')
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('A')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('budget proposals and annual outcomes are separate navigable reports', async ({
  page,
}) => {
  await page.goto('/#budget-comparison')
  const budget = page.locator('#budget-comparison')
  await expect(budget.locator('.budget-ledger-summary')).toContainText('2026')
  await expect(budget.locator('.budget-ledger-summary')).toContainText('27/27')
  await expect(budget.locator('.comparison-bar-row')).toHaveCount(7)
  await expect(budget.locator('.budget-vote')).toHaveCount(8)
  await expect(budget.locator('.budget-year-context')).toContainText(
    'Budget agreement with SD',
  )
  await budget
    .getByRole('combobox', { name: 'Budget year', exact: true })
    .selectOption('2017/18')
  // 2018 runs over a page break in the source; all 27 areas are read and reconcile with the
  // committee's own total (1 000 515 SEK m).
  await expect(budget.locator('.budget-ledger-summary')).toContainText('27/27')
  await expect(budget.locator('.budget-ledger-summary')).toContainText(
    '1,000.5 bn SEK',
  )
  await expect(budget.locator('.budget-ledger-summary')).not.toContainText(
    'Incomplete',
  )
  await budget
    .getByRole('combobox', { name: 'Budget year', exact: true })
    .selectOption('2021/22')
  await expect(budget.locator('.budget-year-context')).toContainText(
    'Opposition alternative',
  )
  await expect(budget.locator('.budget-year-context')).toContainText(
    'M · SD · KD',
  )
  await budget
    .getByRole('combobox', { name: 'Budget year', exact: true })
    .selectOption('2025/26')
  await budget
    .getByRole('combobox', { name: 'Proposal', exact: true })
    .selectOption('V')
  await expect(budget.locator('.budget-ledger-detail')).toContainText(
    'relative to government',
  )
  await budget.getByText('View all 27 expenditure areas').click()
  await expect(budget.locator('.budget-ledger-all tbody tr')).toHaveCount(27)
  await page.locator('.topic-tabs a[href="#budget-outturn"]').click()
  await expect(page.locator('#budget-outturn')).toContainText('1997–2025')
  await page.getByLabel('Annual account year').selectOption('2024')
  await expect(
    page.locator('#budget-outturn .budget-ledger-all summary'),
  ).toContainText('2024')
})
