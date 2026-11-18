/** #jobs?tab=market: the key figures, the slicers in the address, missing files and the employer list. */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect } from './test'
import { board, shots } from './job-board-helpers'

const chart = (page: Page) => page.locator('#ja-market-chart')
const show = (page: Page, name: string) =>
  chart(page)
    .getByRole('group', { name: 'Show' })
    .getByRole('button', { name, exact: true })

test('the market tab shows three key figures and one chart, and its slicers change the chart and the address', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await board(page, '#jobs?tab=market')
  await expect(
    page.getByRole('button', { name: 'Job market' }),
  ).toHaveAttribute('aria-pressed', 'true')
  const kpis = page.locator('.ja-kpis .dk-kpi')
  await expect(kpis).toHaveCount(3)
  // The fixture's last week is incomplete, so the latest complete one is W45.
  await expect(kpis.nth(0)).toContainText('week 2026-W45')
  await expect(kpis.nth(0)).toContainText('4,130')
  await expect(kpis.nth(1)).toContainText('21 days')
  // dbt's larger rise is on 52 ads of Data Engineer, under the key figure's 100 in both months.
  await expect(kpis.nth(2)).toContainText('Kubernetes, Software Developer')
  await expect(kpis.nth(2)).toContainText('+6.1 pp')
  await expect(kpis.nth(2)).toContainText('December 2025')
  // The figures carry no notes: the chart below holds the detail.
  await expect(page.locator('.ja-kpis .dk-note')).toHaveCount(0)

  // One chart on the page; it opens on new ads per month for the whole market.
  await expect(page.locator('.ja-market .feature')).toHaveCount(1)
  const c = chart(page)
  await expect(c.getByRole('heading', { level: 2 })).toHaveText(
    'New ads per month: Whole market',
  )
  await expect(c.getByRole('img')).toHaveAttribute(
    'aria-label',
    /Whole market, new ads from 2024-01/,
  )
  // One series: the title names it, so no legend.
  await expect(c.locator('.chart-legend')).toHaveCount(0)
  await c.getByRole('button', { name: 'Week' }).click()
  await expect(page).toHaveURL(/period=week/)
  await expect(c.getByRole('img')).toHaveAttribute(
    'aria-label',
    /from 2026-W32 to 2026-W45/,
  )
  await c.getByText('About the numbers').click()
  await expect(c).toContainText('Left off as incomplete: 2026-W46.')
  await expect(c).toContainText(
    'Missing from the file, so the line breaks: 2026-W35.',
  )
  const selection = c.getByRole('combobox', { name: 'Selection' })
  await selection.selectOption('apaJ_2ja_LuF')
  await expect(page).toHaveURL(/field=apaJ_2ja_LuF/)
  await expect(c.getByRole('img')).toHaveAttribute(
    'aria-label',
    /^Data\/IT, new ads/,
  )
  // The Data/IT roles sit in the same slicer, from the archive files.
  await selection.selectOption('role:Data Engineer')
  await expect(page).toHaveURL(/field=role%3AData\+Engineer/)
  await expect(c.getByRole('heading', { level: 2 })).toHaveText(
    'New ads per week: Data/IT: Data Engineer',
  )

  await show(page, 'Technologies').click()
  await expect(page).toHaveURL(/show=tech/)
  await expect(c.locator('.rank-label')).toHaveText(['dbt', 'SQL'])
  await c
    .getByRole('combobox', { name: 'Role' })
    .selectOption('Software Developer')
  await expect(page).toHaveURL(/tech=Software\+Developer/)
  await expect(c.locator('.rank-label')).toHaveText(['Kubernetes'])

  // A role family without rising or falling terms is not offered.
  await show(page, 'Words').click()
  await expect(
    c.getByRole('combobox', { name: 'Role' }).locator('option'),
  ).toHaveText(['Data Engineer'])
  await expect(c.locator('.rank-label')).toHaveText([
    'dataplattformar',
    'moderna verktyg',
  ])
  // The numbers are raw uses; the bar and tick are per 1,000 ads of each window.
  await expect(c.locator('.rank-value').first()).toHaveText('107from 8')
  await c.getByRole('button', { name: 'Used less' }).click()
  await expect(page).toHaveURL(/dir=down/)
  await expect(c.locator('.rank-label')).toHaveText(['experience'])

  await show(page, 'Time to close').click()
  await expect(c.locator('.rank-label')).toHaveText([
    'All Data/IT ads',
    'Mjukvaru- och systemutvecklare m.fl.',
  ])
  await c.getByRole('button', { name: 'Ran to the deadline' }).click()
  await expect(page).toHaveURL(/close=to_deadline/)
  await expect(c.locator('.rank-value').first()).toContainText('28 days')

  // Strong 6, possible 12, stretch 6, outside 6 in the fixture's 30 matches.
  await show(page, 'Fit').click()
  await expect(c.locator('.rank-value')).toHaveText(['6', '6', '12', '6'])
  // A list tab leaves the market and its slicers.
  await page.getByRole('button', { name: /^All / }).click()
  await expect(page).not.toHaveURL(
    /tab=|show=|period=|field=|tech=|dir=|close=/,
  )
})

test('a view whose file did not load is not offered, and the page says which', async ({
  page,
}) => {
  await board(page, '#jobs?tab=market', undefined, {
    market: { 'employer-top': 404, 'time-to-close': 404 },
  })
  await expect(show(page, 'Words')).toBeVisible()
  await expect(show(page, 'Employers')).toHaveCount(0)
  await expect(show(page, 'Time to close')).toHaveCount(0)
  await expect(page.locator('.ja-kpis .dk-kpi')).toHaveCount(2)
  await expect(page.locator('.ja-market .ja-notes')).toHaveText(
    'The employer list and the time to close could not be loaded.',
  )
})

test('the employer list shows each employer and its number of ads, nothing more', async ({
  page,
}) => {
  await board(page, '#jobs?tab=market&show=employers')
  const c = chart(page)
  await expect(c.getByRole('heading', { level: 2 })).toHaveText(
    'IT ads per employer, January 2025 – December 2025',
  )
  await c.getByText('About the numbers').click()
  await expect(c).toContainText('not who hires')
  await expect(c.locator('li')).toHaveText([
    /^Testbemanning A AB\s*199$/,
    /^Testkonsult B AB\s*181$/,
    /^Testverket\s*81$/,
  ])
  await expect(c.locator('.rank-value small')).toHaveCount(0)
})

test('#jobs?tab=market has no axe violations', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the same markup on a phone')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await board(page, '#jobs?tab=market')
  await expect(page.locator('.ja-kpis')).toBeVisible()
  await page.waitForLoadState('networkidle')
  const result = await new AxeBuilder({ page }).include('main').analyze()
  expect(
    result.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`),
  ).toEqual([])
})

// JOBS_SCREENSHOTS=tmp/shots: the market tab on the archive copies in public/data/jobs.
for (const language of ['en', 'sv'] as const)
  test.describe(`screenshots in ${language}`, () => {
    test.use({ language })
    test('the market tab at 1440×900 and 390×844', async ({
      page,
      isMobile,
    }) => {
      test.skip(!shots || isMobile, 'only with JOBS_SCREENSHOTS, on desktop')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      for (const [width, height] of [
        [1440, 900],
        [390, 844],
      ]) {
        await page.setViewportSize({ width, height })
        await board(page, '#jobs?tab=market', undefined, { market: 'served' })
        await expect(page.locator('#ja-market-chart')).toBeVisible()
        await page.waitForLoadState('networkidle')
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          ),
        ).toBe(false)
        await page.screenshot({
          path: `${shots}/market-${language}-${width}.png`,
          fullPage: true,
        })
      }
    })
  })
