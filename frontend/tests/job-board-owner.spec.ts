/** #jobs for the owner and when things fail: status buttons, missing files, stale data, no storage. */
import { test, expect } from './test'
import { jobAssistantFixture } from './fixtures/job-assistant'
import { asOwner, board, type Options } from './job-board-helpers'

test('the owner sets a status with the buttons and saves a note; the card shows the status', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await asOwner(page)
  const puts: NonNullable<Options['puts']> = []
  await board(page, '#jobs?ad=1002', jobAssistantFixture(), { puts })
  const status = page.getByRole('group', { name: 'Status' })
  await status.getByRole('button', { name: 'Interview' }).click()
  await expect(
    status.getByRole('button', { name: 'Interview' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Note').fill('Call on Monday.')
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page.locator('.ja-decide [role="status"]')).toHaveText('Saved.')
  expect(puts).toEqual([
    { id: '1002', body: { status: 'interview', note: '' } },
    { id: '1002', body: { status: 'interview', note: 'Call on Monday.' } },
  ])
  await expect(page.locator('.ja-card[href$="ad=1002"] .ja-status')).toHaveText(
    'Interview',
  )
  // The CV evidence names the kind of entry the quote comes from.
  await expect(
    page.locator('section:has(#ja-evidence) .ja-ref').first(),
  ).toHaveText('Internship (LIA) · CV: Experience, entry 1')
})

test('a failed matches file leaves the open ads under a calm note', async ({
  page,
}) => {
  await board(page, '#jobs', jobAssistantFixture(), { fail: { matches: 500 } })
  await expect(page.locator('.ja-stale')).toContainText(
    'Could not load the matches just now',
  )
  await expect(page.locator('a.ja-card')).toHaveCount(20)
  await expect(page.locator('.ja-badge')).toHaveCount(0)
})

test('a failed texts file falls back to the Platsbanken link in the opened ad', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await board(page, '#jobs?ad=1000', jobAssistantFixture(), {
    fail: { texts: 500, demand: 500 },
  })
  await expect(page.locator('.ja-stale')).toContainText(
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

test('old data is marked stale', async ({ page }) => {
  const f = jobAssistantFixture()
  f.ads.generated_at = new Date(Date.now() - 10 * 3_600_000).toISOString()
  await board(page, '#jobs', f)
  await expect(page.locator('.ja-stale')).toContainText(
    'last synced 10 hours ago',
  )
})

test('without owner storage (503) the owner gets a calm note and the ads still work', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await asOwner(page)
  await board(page, '#jobs?ad=1000', jobAssistantFixture(), { api: 503 })
  await expect(page.locator('.ja-detail')).toContainText(
    'The record storage is not set up yet',
  )
  await expect(page.locator('.ja-decide')).toHaveCount(0)
  await page.getByRole('button', { name: 'How it works' }).click()
  await expect(page.locator('.ja-sections')).toContainText(
    'The approved CV profile could not be read just now',
  )
})

test('when the remaining texts fail, the opened ad links to Platsbanken', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const f = jobAssistantFixture()
  delete f.texts.texts['1000']
  await board(page, '#jobs?ad=1000', f, { fail: { 'texts-remaining': 500 } })
  await expect(
    page.getByRole('link', { name: 'Read it on Platsbanken' }),
  ).toBeVisible()
})
