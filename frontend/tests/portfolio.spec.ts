import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('home introduces Anton and routes to each project', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'ERNSTSSON',
  )
  // The role, the pitch and the CV are on the first screen, as plain text.
  await expect(page.locator('.home-hero-role')).toContainText('Data Engineer')
  await expect(page.locator('.home-hero-role')).toBeInViewport()
  await expect(
    page.locator('.home-hero-actions a', { hasText: 'CV' }),
  ).toBeInViewport()
  // On a laptop, selected work and experience start on the first screen too; on a phone
  // they follow the hero in that order.
  await expect(page.locator('#projekt')).toBeInViewport()
  if (!isMobile) await expect(page.locator('#erfarenhet')).toBeInViewport()
  // Then, in order: projects, experience, the core stack, about, under the hood.
  const order = await page.evaluate(() =>
    ['projekt', 'erfarenhet', 'kompetenser', 'om-mig', 'under-huven'].map(
      (id) => document.getElementById(id)!.getBoundingClientRect().top,
    ),
  )
  expect([...order].sort((a, b) => a - b)).toEqual(order)
  await expect(page.locator('#projekt .ds-project-row')).toHaveCount(5)
  await expect(page.locator('.ds-project-row').first()).toContainText(
    'Swedish politics',
  )
  // Experience: company, role, period and impact visible without a click.
  await expect(page.locator('#erfarenhet')).toContainText('Fora')
  await expect(page.locator('#erfarenhet')).toContainText('Avtalat')
  await expect(page.locator('.home-job-impact').first()).toBeVisible()
  await expect(page.locator('#erfarenhet')).toContainText('JENSEN')
  // A short stack first; the full one a click away.
  await expect(
    page.locator('#kompetenser .home-stack-groups > div'),
  ).toHaveCount(5)
  await expect(page.locator('#kompetenser .skills-more').first()).toBeHidden()
  await page.locator('#kompetenser summary').click()
  await expect(page.locator('#kompetenser .skills-more')).toHaveCount(5)
  // Technical depth is linked at the bottom, not in the first screen.
  await expect(
    page.locator('#under-huven a[href="#data-constellation"]'),
  ).toHaveCount(1)
  await expect(page.locator('#under-huven a[href="#quality"]')).toHaveCount(1)
  await expect(
    page.locator('.home-hero a[href="#data-constellation"]'),
  ).toHaveCount(0)
  await expect(page.locator('#job-market')).toHaveCount(0)
  await page
    .locator('.ds-project-row')
    .first()
    .getByRole('link')
    .first()
    .click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Swedish politics through data',
  )
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
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '72 to review',
  )
  await page.goto('/#homie')
  await expect(page.locator('#homie')).toBeVisible()
  await expect(page.locator('#homie-stage .homie-stub')).toHaveCount(4)
  // DiVA: the pipeline is in place; until a harvest has run the page says so.
  await page.goto('/#diva')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'What Swedish students write about',
  )
  expect(errors).toEqual([])
})

test('language map and job chart retain useful controls', async ({ page }) => {
  await page.goto('/#debates')
  await expect(page.locator('.umap-point')).toHaveCount(400)
  await page.getByRole('button', { name: '2022/23' }).click()
  await expect(page.locator('.point-detail')).toContainText('Selected segment')
  await page.locator('.viz-toolbar select').selectOption('MP')
  expect(await page.locator('.umap-point').count()).toBeGreaterThan(0)
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
  await page.goto('/')
  await expect(
    page.getByRole('link', { name: /Download CV/ }).first(),
  ).toHaveAttribute('download', '')
  for (const route of [
    '/',
    '/#politics',
    '/#now',
    '/#politik-valjarna',
    '/#politik-roster',
    '/#politik-budget',
    '/#politik-tal',
    '/#politik-utforska',
    '/#politik-kallor',
    '/#issue-arbete',
    '/#budget-comparison',
    '/#drugcomb',
    '/#sweden',
    '/#status',
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

test('the ER diagram shows the areas, a diagram per area and a table’s keys', async ({
  page,
}) => {
  await page.goto('/#er')
  await expect(
    page.getByRole('heading', { level: 1, name: 'How the data connects' }),
  ).toBeVisible()
  await page.locator('.er-ov-node', { hasText: 'Parliament' }).click()
  await expect(page).toHaveURL(/omrade=parliament/)
  const box = page.locator('.er-box', { hasText: 'fct_roll_call' }).first()
  await expect(box).toBeVisible()
  await box.click()
  await expect(page.locator('.stage-side.is-right')).toContainText(
    'session + roll_call_id',
  )
  const axe = await new AxeBuilder({ page }).include('#er').analyze()
  expect(axe.violations).toEqual([])
  await expect(page.locator('.stage-side.is-right')).toContainText(
    'dim_parliament_session',
  )
  // A link in the panel to a table in another area opens that area.
  await page
    .locator('.stage-side.is-right .er-link', { hasText: 'dim_date' })
    .first()
    .click()
  await expect(page).toHaveURL(/omrade=shared/)
})
