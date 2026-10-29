/** #jobs marks and failure states: save, applied and closed on the device and in the owner store, missing files, stale data. */
import { test, expect } from './test'
import { jobAssistantFixture } from './fixtures/job-assistant'
import { asOwner, board, tab, type Options } from './job-board-helpers'

test('a visitor saves an ad on this device; it survives a reload and fills the tabs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await board(page, '#jobs?ad=1002')
  const save = page.getByRole('button', { name: 'Save', exact: true })
  await save.click()
  await expect(save).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.ja-kept')).toHaveText('Saved on this device')
  await expect(tab(page, 'Saved')).toContainText('1')
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Save', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('a.ja-item[href$="ad=1002"] .ja-mark')).toHaveText(
    'Saved',
  )

  // Applied replaces saved; closing the next one fills Closed; pressing again clears it.
  await page.getByRole('button', { name: 'Mark as applied' }).click()
  await expect(tab(page, 'Saved')).toContainText('0')
  await expect(tab(page, 'Applied')).toContainText('1')
  await page.locator('a.ja-item[href$="ad=1001"]').click()
  const close = page.getByRole('button', { name: 'Close', exact: true })
  await close.click()
  await expect(tab(page, 'Closed')).toContainText('1')
  await tab(page, 'Closed').click()
  await expect(page.locator('a.ja-item')).toHaveCount(1)
  await close.click()
  await expect(tab(page, 'Closed')).toContainText('0')
})

test('with the owner token the owner store statuses win and each change is written there', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await asOwner(page)
  await page.addInitScript(() =>
    localStorage.setItem('job-assistant-status:1000', 'closed'),
  )
  const puts: NonNullable<Options['puts']> = []
  await board(page, '#jobs?ad=1002', jobAssistantFixture(), { puts })
  // The fixture store has 1000 applied (over the device's closed) and 1001 saved.
  await expect(tab(page, 'Applied')).toContainText('1')
  await expect(tab(page, 'Saved')).toContainText('1')
  await expect(tab(page, 'Closed')).toContainText('0')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.ja-kept')).toHaveText(
    'Saved on this device and in the owner store',
  )
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => puts.length).toBe(2)
  expect(puts).toEqual([
    { id: '1002', body: { status: 'interesting', note: '' } },
    { id: '1002', body: { status: 'new', note: '' } },
  ])
})

test('without owner storage (503) marks stay on the device and the owner gets a calm note', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await asOwner(page)
  await board(page, '#jobs?ad=1000', jobAssistantFixture(), { api: 503 })
  await expect(page.locator('.ja-notes')).toContainText(
    'The owner store is not set up yet',
  )
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.ja-kept')).toHaveText('Saved on this device')
})

test('a failed matches file leaves every open ad under a calm note', async ({
  page,
}) => {
  await board(page, '#jobs', jobAssistantFixture(), { fail: { matches: 500 } })
  await expect(page.locator('.ja-notes')).toContainText(
    'Could not load the matches just now',
  )
  await expect(tab(page, 'All')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('a.ja-item')).toHaveCount(30)
})

test('failed texts fall back to the Platsbanken link in the opened ad', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await board(page, '#jobs?ad=1000', jobAssistantFixture(), {
    fail: { texts: 500, demand: 500, 'texts-remaining': 500 },
  })
  await expect(page.locator('.ja-notes')).toContainText(
    'Could not load the ad texts and the skill demand',
  )
  await expect(
    page.getByRole('link', { name: 'Read it on Platsbanken' }),
  ).toHaveAttribute('href', /platsbanken\/annonser\/1000$/)
})

test('a failed ads file shows the error and a retry', async ({ page }) => {
  await board(page, '#jobs', jobAssistantFixture(), { fail: { ads: 500 } })
  await expect(page.getByRole('alert')).toContainText(
    'The ads could not be loaded',
  )
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('old data is marked stale and the bar says when it was updated', async ({
  page,
}) => {
  const f = jobAssistantFixture()
  f.ads.generated_at = new Date(Date.now() - 10 * 3_600_000).toISOString()
  await board(page, '#jobs', f)
  await expect(page.locator('.ja-updated')).toContainText('Updated')
  await expect(page.locator('.ja-notes')).toContainText(
    'last synced 10 hours ago',
  )
})
