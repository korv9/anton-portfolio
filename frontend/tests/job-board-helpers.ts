/** Shared set-up of the #jobs specs: the fixture files and /api/jobs/ mocked at the network. */
import type { Page } from '@playwright/test'
import { expect } from './test'
import { jobAssistantFixture } from './fixtures/job-assistant'

export const shots = process.env.JOBS_SCREENSHOTS

export type Fixture = ReturnType<typeof jobAssistantFixture>

export type Options = {
  /** Released files answered with this HTTP status instead of the fixture. */
  fail?: Partial<
    Record<'ads' | 'matches' | 'texts' | 'demand' | 'texts-remaining', number>
  >
  /** Every /api/jobs/ route answers with this status (503: storage not configured). */
  api?: number
  /** Requests for texts-remaining.json. */
  remaining?: string[]
  /** The review PUTs that reached the mock, with their bodies. */
  puts?: { id: string; body: unknown }[]
}

export async function board(
  page: Page,
  hash = '#jobs',
  f: Fixture = jobAssistantFixture(),
  o: Options = {},
) {
  // The committed delivery reads job-assistant/ from R2; these fixtures stand in for it locally.
  await page.route('**/data/delivery.json', async (route) => {
    const { live: _, ...local } = await (await route.fetch()).json()
    return route.fulfill({ json: local })
  })
  await page.route('**/data/job-assistant/*.json', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!
    const failed = o.fail?.[name.replace('.json', '') as 'ads']
    if (failed) return route.fulfill({ status: failed, body: 'down' })
    if (name === 'texts-remaining.json') o.remaining?.push(name)
    return route.fulfill({
      json: f[name.replace('.json', '') as 'ads' | 'texts-remaining'],
    })
  })
  await page.route('**/api/jobs/**', (route) => {
    const request = route.request()
    const what = new URL(request.url()).pathname.split('/').pop()
    if (o.api)
      return route.fulfill({
        status: o.api,
        json: { error: 'job assistant storage is not configured' },
      })
    // Public: the approved profile only, as worker/jobs.ts answers without the token.
    if (what === 'profile') return route.fulfill({ json: f.profile })
    // Like worker/jobs.ts: statuses, notes and labels only with the owner token.
    if (!route.request().headers()['authorization'])
      return route.fulfill({
        status: 401,
        json: { error: 'owner token required' },
      })
    if (what === 'reviews') return route.fulfill({ json: f.reviews })
    if (what === 'labels') return route.fulfill({ json: f.labels })
    if (request.method() === 'PUT' && request.url().includes('/reviews/')) {
      o.puts?.push({ id: what!, body: request.postDataJSON() })
      return route.fulfill({ json: { updated_at: new Date().toISOString() } })
    }
    return route.fulfill({ status: 404, json: { error: 'not found' } })
  })
  await page.goto('/' + hash)
  if (!hash.includes('tab=') && !o.fail?.ads)
    await expect(page.locator('a.ja-card').first()).toBeVisible()
}
export const asOwner = (page: Page) =>
  page.addInitScript(() =>
    localStorage.setItem('job-assistant-owner-token', 'fixture-token'),
  )
export const count = (page: Page) =>
  page.locator('.ja-results-head [aria-live]').innerText()
