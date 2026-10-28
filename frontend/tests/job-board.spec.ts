/** #jobs as a job board: search, a filter chip, opening an ad, back navigation and the phone layout. */
import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './test'
import { jobAssistantFixture } from './fixtures/job-assistant'
import { board, count, shots, type Fixture } from './job-board-helpers'

test('search, a removable filter chip, an opened ad and the back button', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  // The Applications pipeline shows the owner's statuses, so this visit carries the token.
  await page.addInitScript(() =>
    localStorage.setItem('job-assistant-owner-token', 'fixture-token'),
  )
  await board(page)
  await expect(page.locator('.page-head-kpis')).toContainText('Strong matches')
  const before = await count(page)

  await page.getByRole('searchbox', { name: /Search jobs/ }).fill('dbt')
  await expect.poll(() => count(page)).not.toBe(before)
  await expect(page).toHaveURL(/q=dbt/)
  for (const card of await page.locator('.ja-card').all())
    await expect(card).toContainText('dbt')

  await page.getByLabel('Place').selectOption('Solna')
  await expect(page).toHaveURL(/place=Solna/)
  const chip = page.getByRole('button', { name: 'Remove filter Solna' })
  await expect(chip).toBeVisible()
  await chip.click()
  await expect(page).not.toHaveURL(/place=/)

  const first = page.locator('.ja-card').first()
  const title = await first.locator('.ja-card-title').innerText()
  await first.click()
  await expect(page).toHaveURL(/ad=\d+/)
  await expect(page.locator('#ja-detail-title')).toHaveText(title)
  await expect(page.locator('.ja-card[aria-current="true"]')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Original ad' })).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/jobs-desktop.png` })

  await page.goBack()
  await expect(page).not.toHaveURL(/ad=/)
  await expect(page).toHaveURL(/q=dbt/)

  await page.getByRole('button', { name: 'Applications' }).click()
  await expect(page.getByRole('heading', { name: /Applied/ })).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/jobs-pipeline.png` })
})

test('the arrow keys move between cards and Enter opens one', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await board(page)
  await page.locator('.ja-card').first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('.ja-card').nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/ad=\d+/)
})

test('on a phone the ad replaces the list and the back button returns to it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await board(page)
  await expect(page.locator('.ja-detail')).toBeHidden()
  if (shots)
    await page.screenshot({
      path: `${shots}/jobs-mobile-list.png`,
      fullPage: true,
    })
  await page.locator('.ja-card').nth(2).click()
  await expect(page.locator('.ja-list-pane')).toBeHidden()
  const back = page.getByRole('button', { name: 'Back to the jobs' })
  await expect(back).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/jobs-mobile-ad.png` })
  await back.click()
  await expect(page.locator('.ja-list-pane')).toBeVisible()
  await expect(page).not.toHaveURL(/ad=/)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(overflow).toBe(false)
})

test('without a profile the board lists the open ads under a calm note, with no classes, filters or error codes', async ({
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
    texts: { ...f.texts, texts: {} },
  }
  await board(page, '#jobs', unmatched as unknown as Fixture)
  await expect(page.locator('.ja-empty')).toContainText(
    'Matching against my CV is paused for now.',
  )
  await expect(page.locator('.ja-empty')).not.toContainText('403')
  await expect(page.locator('.ja-empty')).not.toContainText('starts when')
  await expect(page.locator('.ja-results-head')).toContainText(
    `${f.ads.ads.length} open ads`,
  )
  await expect(page.locator('.ja-card')).toHaveCount(20)
  await expect(page.locator('.ja-badge')).toHaveCount(0)
  await expect(
    page.getByRole('searchbox', { name: /Search jobs/ }),
  ).toHaveCount(0)
  await expect(page.locator('.page-head-kpis')).not.toContainText(
    'Strong matches',
  )
  // A visitor has no token: the owner-only Applications tab and stat are not offered.
  await expect(page.locator('.page-head-kpis')).not.toContainText(
    'Applications',
  )
  await expect(page.getByRole('button', { name: 'Applications' })).toHaveCount(
    0,
  )
})

test('How it works shows the approved profile to a visitor, with sources, and no owner records', async ({
  page,
}) => {
  await board(page, '#jobs?tab=about')
  const profile = page.locator('section:has(#ja-cv-profile)')
  await expect(profile).toContainText('Version 1')
  await expect(profile).toContainText('Built dbt models.')
  await expect(profile).toContainText(
    'Internship (LIA) · Data Engineer, Testbolag A AB',
  )
  await expect(profile).toContainText('Own project · Test project')
  await expect(page.locator('.ja-owner')).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText('Profile draft')
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

test('an ad without a published text loads it from the remaining texts, once and only when opened', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const f = jobAssistantFixture()
  for (const id of ['1003', '1008']) {
    delete f.texts.texts[id]
    f['texts-remaining'].texts[id] = {
      description: `Hela texten för annons ${id}.`,
      contact_redactions: 0,
    }
  }
  const remaining: string[] = []
  await board(page, '#jobs?match=stretch', f, { remaining })
  await page.waitForLoadState('networkidle')
  expect(remaining).toHaveLength(0)
  await page.locator('a.ja-card[href$="ad=1003"]').click()
  await expect(page.locator('.ja-ad-text')).toHaveText(
    /Hela texten för annons 1003\./,
  )
  await page.locator('a.ja-card[href$="ad=1008"]').click()
  await expect(page.locator('.ja-ad-text')).toHaveText(
    /Hela texten för annons 1008\./,
  )
  expect(remaining).toHaveLength(1)
})
