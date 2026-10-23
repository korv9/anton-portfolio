/** #jobs as a job board: search, a filter chip, opening an ad, back navigation and the phone layout. */
import type { Page } from '@playwright/test'
import { test, expect } from './test'
import { jobAssistantFixture } from './fixtures/job-assistant'

const shots = process.env.JOBS_SCREENSHOTS

async function board(page: Page, hash = '#jobs') {
  const f = jobAssistantFixture()
  await page.route('**/data/job-assistant/*.json', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!
    return route.fulfill({
      json: f[
        name.replace('.json', '') as 'ads' | 'matches' | 'texts' | 'demand'
      ],
    })
  })
  await page.route('**/api/jobs/**', (route) => {
    const what = new URL(route.request().url()).pathname.split('/').pop()
    if (what === 'reviews') return route.fulfill({ json: f.reviews })
    if (what === 'labels') return route.fulfill({ json: f.labels })
    return route.fulfill({ status: 404, json: { error: 'not found' } })
  })
  await page.goto('/' + hash)
  await expect(page.locator('.ja-card').first()).toBeVisible()
}
const count = (page: Page) =>
  page.locator('.ja-results-head [aria-live]').innerText()

test('search, a removable filter chip, an opened ad and the back button', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await board(page)
  await expect(page.locator('.ja-stats')).toContainText('Strong matches')
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
