/** #jobs?tab=market: the key figures, the slicers in the address, missing files and the employer list. */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect } from './test'
import { board, shots } from './job-board-helpers'

const card = (page: Page, title: string) =>
  page.locator('.dk-card', {
    has: page.getByRole('heading', { level: 2, name: title }),
  })

test('the market tab shows three key figures, and its slicers change the chart and the address', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await board(page, '#jobs?tab=market')
  await expect(
    page.getByRole('button', { name: 'Job market' }),
  ).toHaveAttribute('aria-pressed', 'true')
  const kpis = page.locator('.ja-kpis .dk-kpi')
  await expect(kpis).toHaveCount(3)
  // The fixture's last week is incomplete, so the latest complete one is W45, against W44.
  await expect(kpis.nth(0)).toContainText('week 2026-W45')
  await expect(kpis.nth(0)).toContainText('4,130')
  await expect(kpis.nth(0)).toContainText('against week 2026-W44 (4,120)')
  await expect(kpis.nth(1)).toContainText('21 days')
  await expect(kpis.nth(1)).toContainText('Over 412 ads.')
  await expect(kpis.nth(2)).toContainText('dbt, Data Engineer ads')
  await expect(kpis.nth(2)).toContainText('+14.1 pp')

  const ads = card(page, 'New ads per month')
  const whole = ads.locator('.ja-line').first().getByRole('img')
  await expect(whole).toHaveAttribute(
    'aria-label',
    /Whole market, new ads from 2024-01/,
  )
  await ads.getByRole('button', { name: 'Week' }).click()
  await expect(page).toHaveURL(/period=week/)
  const weekly = card(page, 'New ads per week')
  await expect(
    weekly.locator('.ja-line').first().getByRole('img'),
  ).toHaveAttribute('aria-label', /from 2026-W32 to 2026-W45/)
  await expect(weekly).toContainText(
    'Left off the line as incomplete: 2026-W46.',
  )
  await weekly
    .getByRole('combobox', { name: 'Field' })
    .selectOption('apaJ_2ja_LuF')
  await expect(page).toHaveURL(/field=apaJ_2ja_LuF/)
  await expect(
    weekly.locator('.ja-line').first().getByRole('img'),
  ).toHaveAttribute('aria-label', /: Data\/IT, new ads/)
  await weekly
    .getByRole('combobox', { name: 'Role' })
    .selectOption('Data Engineer')
  await expect(page).toHaveURL(/family=Data\+Engineer/)

  const tech = card(page, 'Technologies rising and falling')
  await expect(tech.locator('.rank-label')).toHaveText(['dbt', 'SQL'])
  await tech
    .getByRole('combobox', { name: 'Role' })
    .selectOption('Software Developer')
  await expect(page).toHaveURL(/tech=Software\+Developer/)
  await expect(tech.locator('.rank-label')).toHaveText(['Kubernetes'])

  // A role family without rising or falling terms is not offered.
  const terms = card(page, 'Words and phrases rising')
  await expect(
    terms.getByRole('combobox', { name: 'Role' }).locator('option'),
  ).toHaveText(['Data Engineer'])
  await expect(terms.locator('.rank-label')).toHaveText([
    'dataplattformar',
    'moderna verktyg',
    'experience',
  ])
  await expect(terms).toContainText('from 8, 12 employers')

  const closing = card(page, 'Days from publication to removal')
  await expect(closing.locator('.rank-label')).toHaveText([
    'All Data/IT ads',
    'Mjukvaru- och systemutvecklare m.fl.',
  ])
  await closing.getByRole('button', { name: 'Ran to the deadline' }).click()
  await expect(page).toHaveURL(/close=to_deadline/)
  await expect(closing.locator('.rank-value').first()).toContainText('28 days')

  // Strong 6, possible 12, stretch 6, outside 6 in the fixture's 30 matches.
  await expect(
    card(page, 'Current ads by fit').locator('.rank-value'),
  ).toHaveText(['6', '6', '12', '6'])
  // A list tab leaves the market and its slicers.
  await page.getByRole('button', { name: /^All / }).click()
  await expect(page).not.toHaveURL(/tab=|period=|field=|family=|tech=|close=/)
})

test('a card whose file did not load is not drawn, and the page says which', async ({
  page,
}) => {
  await board(page, '#jobs?tab=market', undefined, {
    market: { 'employer-top': 404, 'time-to-close': 404 },
  })
  await expect(card(page, 'Words and phrases rising')).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'Employers that posted the most IT ads',
    }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Days from publication to removal' }),
  ).toHaveCount(0)
  await expect(page.locator('.ja-kpis .dk-kpi')).toHaveCount(2)
  await expect(page.locator('.ja-market .ja-notes')).toHaveText(
    'Could not load the employer list, the time to close just now, so those cards are left out.',
  )
})

test('the employer list shows each employer and its number of ads, nothing more', async ({
  page,
}) => {
  await board(page, '#jobs?tab=market')
  const list = card(page, 'Employers that posted the most IT ads')
  await expect(list).toContainText('January 2025 – December 2025.')
  await expect(list).toContainText('not who hires')
  await expect(list.locator('li')).toHaveText([
    /^Testbemanning A AB\s*199$/,
    /^Testkonsult B AB\s*181$/,
    /^Testverket\s*81$/,
  ])
  await expect(list.locator('.rank-value small')).toHaveCount(0)
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
        await expect(page.locator('.ja-market .dk-grid')).toBeVisible()
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
