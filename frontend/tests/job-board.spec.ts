/** #jobs as a desk: the list tabs, search and filters, an opened ad, the whole ad, the phone layout. */
import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './test'
import { jobAssistantFixture } from './fixtures/job-assistant'
import { board, shots, tab } from './job-board-helpers'

test('search, a filter, an opened ad with its tags and the whole ad, and the back button', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await board(page)
  // Good fit is strong and possible: 18 of the fixture's 30 ads.
  await expect(tab(page, 'Good fit')).toHaveAttribute('aria-pressed', 'true')
  await expect(tab(page, 'Good fit')).toContainText('18')
  await expect(tab(page, 'All')).toContainText('30')
  await expect(page.locator('kbd')).toHaveCount(0)
  // The list says what it is; no lead sentence sits above the controls.
  await expect(
    page.getByRole('heading', { level: 2, name: 'Ads 18' }),
  ).toBeVisible()
  await expect(page.getByRole('list', { name: /^Ads/ })).toBeVisible()
  await expect(page.locator('.page-head-sentence')).toHaveCount(0)

  await page.getByRole('searchbox', { name: 'Search jobs' }).fill('dbt')
  await expect(page).toHaveURL(/q=dbt/)
  await expect(tab(page, 'All')).toContainText('15')

  await page.getByText('Filters', { exact: true }).click()
  await page.getByLabel('Place').selectOption('Solna')
  await expect(page).toHaveURL(/place=Solna/)
  for (const item of await page.locator('a.ja-item').all())
    await expect(item).toContainText('Solna')

  const first = page.locator('a.ja-item').first()
  const title = await first.locator('.ja-item-title').innerText()
  await first.click()
  await expect(page).toHaveURL(/ad=\d+/)
  await expect(page.locator('#ja-detail-title')).toHaveText(title)
  const asks = page.locator('section:has(#ja-asks)')
  await expect(asks).toContainText('Required')
  await expect(asks).toContainText('Nice to have')
  // One click on the ad shows the whole text, with nothing more to open.
  await expect(page.locator('.ja-lead')).toHaveText('Vi söker en dataingenjör.')
  await expect(page.locator('.ja-rest')).toBeVisible()
  await expect(page.locator('.ja-rest')).toContainText(
    'Meriterande med Kubernetes.',
  )
  await expect(page.getByText('Read the whole ad')).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: /Apply at the employer/ }),
  ).toHaveAttribute('href', /^https:\/\/arbetsformedlingen\.se\//)
  if (shots) await page.screenshot({ path: `${shots}/desk-desktop.png` })

  await page.goBack()
  await expect(page).not.toHaveURL(/ad=/)
  await expect(page).toHaveURL(/q=dbt/)
})

test('on a phone the ad replaces the list and the back button returns to it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await board(page)
  await expect(page.locator('.ja-detail')).toBeHidden()
  await page.locator('a.ja-item').nth(2).click()
  await expect(page.locator('.ja-list-pane')).toBeHidden()
  const back = page.getByRole('button', { name: 'Back to the list' })
  await expect(back).toBeVisible()
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  expect(await overflow()).toBe(false)
  await back.click()
  await expect(page.locator('.ja-list-pane')).toBeVisible()
  await expect(page).not.toHaveURL(/ad=/)
  expect(await overflow()).toBe(false)
})

test('without a profile the desk lists every open ad under a calm note, with no error codes', async ({
  page,
}) => {
  const f = jobAssistantFixture()
  const at = '2026-10-25T11:13:24+00:00'
  const unmatched = {
    ...f,
    matches: {
      ...f.matches,
      profile: null,
      status: {
        skipped: { reason: 'profile route answered 403', status: 403, at },
      },
      matches: [],
    },
  }
  await board(page, '#jobs', unmatched as unknown as typeof f)
  await expect(page.locator('.ja-notes')).toContainText(
    'Matching against my CV is paused for now.',
  )
  await expect(page.locator('.ja-notes')).not.toContainText('403')
  await expect(tab(page, 'All')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('a.ja-item')).toHaveCount(30)
  await expect(page.locator('#ja-asks')).toHaveCount(0)
})

test('an approved profile and matches: no setup copy anywhere, and the bar names the profile version', async ({
  page,
}) => {
  await board(page)
  await expect(page.locator('.ja-updated')).toContainText(
    'matched against profile v1',
  )
  for (const copy of [
    'Matching against my CV is paused',
    'Matching starts when the CV profile is approved',
    'Owner token',
  ])
    await expect(page.getByText(copy)).toHaveCount(0)
  await expect(page.locator('.ja-notes')).toHaveCount(0)
})

test('How it works counts what the CV lacks over the good, possible and stretch matches', async ({
  page,
}) => {
  await board(page, '#jobs?tab=about')
  // The fixture's odd ads lack Kubernetes as their only gap; 12 of them are not outside, 9 good or possible.
  const row = page.locator('.ja-gap-bars li')
  await expect(row).toHaveCount(1)
  await expect(page.locator('table.ja-gaps')).toHaveCount(0)
  await expect(row.locator('.rank-label')).toHaveText('Kubernetes')
  // 12 ads lack it, 9 of them good or possible, and in all 12 it is the only gap.
  await expect(row.locator('.rank-value')).toHaveText(/^12\s*9 good/)
  await expect(row.locator('.rank-value small')).toHaveText(
    '9 good or possible · 12 the only gap',
  )
})

test('How it works shows the last fetch, the delay and the last day of runs', async ({
  page,
}) => {
  const base = jobAssistantFixture()
  const pipeline = {
    flow: 'realtime',
    last_fetch: {
      at: base.ads.generated_at,
      fetched_until: base.ads.fetched_until,
    },
    latency_minutes: { median: 5.5, publications: 9 },
    last_day: {
      runs: 49,
      failed: 0,
      changes: 29,
      run_seconds_median: 31.8,
      workers_ai_neurons: 1108.97,
    },
  }
  await board(page, '#jobs?tab=about', {
    ...base,
    ads: { ...base.ads, pipeline } as typeof base.ads,
  })
  const line = page.locator('.ja-freshness')
  await expect(line).toContainText('Median delay')
  await expect(line).toContainText(': 6 min')
  await expect(line).toContainText(
    'Last day: 49 runs, 0 failed stages, 29 changes, 32 s a run, 1109 Workers AI neurons.',
  )
})

test('an ad without a published text loads it from the remaining texts, once and only when opened', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const f = jobAssistantFixture()
  for (const id of ['1005', '1010']) {
    delete f.texts.texts[id]
    f['texts-remaining'].texts[id] = {
      description: `Hela texten för annons ${id}.`,
      contact_redactions: 0,
    }
  }
  const remaining: string[] = []
  await board(page, '#jobs', f, { remaining })
  await page.waitForLoadState('networkidle')
  // 1005 (strong, the nearest deadline) is first on the desk, shown but not opened: nothing is
  // fetched yet.
  expect(remaining).toHaveLength(0)
  await expect(page.locator('a.ja-item').first()).toHaveAttribute(
    'href',
    /ad=1005$/,
  )
  await page.locator('a.ja-item[href$="ad=1005"]').click()
  await expect(page.locator('.ja-lead')).toHaveText(
    'Hela texten för annons 1005.',
  )
  await page.locator('a.ja-item[href$="ad=1010"]').click()
  await expect(page.locator('.ja-lead')).toHaveText(
    'Hela texten för annons 1010.',
  )
  expect(remaining).toHaveLength(1)
})

for (const hash of ['#jobs?ad=1000', '#jobs?tab=about'])
  test(`${hash} has no axe violations`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'the same markup on a phone')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await board(page, hash)
    await expect(page.locator('.ja-sections, .ja-detail').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    const result = await new AxeBuilder({ page }).include('main').analyze()
    expect(
      result.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`),
    ).toEqual([])
  })
