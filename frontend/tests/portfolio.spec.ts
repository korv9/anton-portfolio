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
  // One page, in reading order, with a table of contents that names every section.
  const ids = await page
    .locator('.cv-main > section')
    .evaluateAll((sections) => sections.map((s) => s.id))
  expect(ids).toEqual([
    'start',
    'om-mig',
    'erfarenhet',
    'projekt',
    'kompetenser',
    'utbildning',
    'kontakt',
  ])
  const toc = page.getByRole('navigation', { name: 'Contents' })
  await expect(toc.getByRole('link')).toHaveCount(7)
  // The overview answers the ten-second questions: facts and a CV for each kind of role.
  await expect(page.locator('.cv-facts > div')).toHaveCount(4)
  await expect(page.locator('.cv-fit a[download]')).toHaveCount(3)
  for (const href of await page
    .locator('.cv-fit a[download]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')))) {
    expect((await page.request.get(`/${href}`)).status(), href!).toBe(200)
  }
  await expect(page.locator('#erfarenhet')).toContainText('Fora')
  await expect(page.locator('#erfarenhet')).toContainText('Avtalat')
  await expect(page.locator('.cv-flagship')).toContainText('Swedish politics')
  expect(await page.locator('.cv-project').count()).toBeGreaterThanOrEqual(6)
  // Every skill is visible: nothing behind a toggle.
  await expect(page.locator('#kompetenser .cv-skills > div')).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0)
  // The contents follow the reader.
  await toc.getByRole('link', { name: /Skills/ }).click()
  await expect(toc.getByRole('link', { name: /Skills/ })).toHaveAttribute(
    'aria-current',
    'location',
  )
  await expect(page.locator('#job-market')).toHaveCount(0)
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click()
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Politics' })
    .click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Where things stand',
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
  await expect(budget.locator('.budget-ledger-summary')).toContainText('21/27')
  await expect(budget.locator('.budget-ledger-summary')).toContainText(
    'Incomplete',
  )
  await expect(budget.locator('.comparison-bar-row')).toHaveCount(0)
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
