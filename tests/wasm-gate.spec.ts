import { test, expect, type Page } from '@playwright/test'

/**
 * Phase 2 decision gate. These tests measure what the query engine costs and prove the
 * fallback works, so the choice to move the remaining explorer views rests on numbers.
 *
 * Bytes are counted from the Playwright side rather than from the page's own resource
 * timings. A cross-origin response reports transferSize 0 unless the server sends
 * Timing-Allow-Origin, which R2 does not, so in-page accounting silently under-reports.
 *
 * The measurements are printed rather than asserted against thresholds, because the
 * thresholds are a judgement call that belongs to the reviewer, not to CI.
 */

const PANEL = '.member-votes'

type Bytes = { engine: number; parquet: number; other: number }

function countBytes(page: Page): Bytes {
  const bytes: Bytes = { engine: 0, parquet: 0, other: 0 }
  page.on('response', async (response) => {
    const url = response.url()
    let size = 0
    try {
      size = (await response.body()).length
    } catch {
      return // redirects and aborted requests have no body
    }
    if (/duckdb|\.wasm(\?|$)/.test(url)) bytes.engine += size
    else if (url.includes('.parquet')) bytes.parquet += size
    else bytes.other += size
  })
  return bytes
}

async function openMemberVotes(page: Page) {
  await page.goto('/#politics-votes')
  await expect(page.locator(PANEL)).toBeVisible()
  await expect(page.locator(`${PANEL} tbody tr`).first()).toBeVisible({ timeout: 90000 })
}

/** Approximate a mid-range phone on a slow connection. */
async function throttle(page: Page) {
  const session = await page.context().newCDPSession(page)
  await session.send('Network.enable')
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  return session
}

for (const slow of [false, true]) {
  test(`member votes from Parquet${slow ? ', throttled' : ''}`, async ({ page }, testInfo) => {
    test.skip(slow && testInfo.project.name !== 'mobile', 'throttled profile runs on mobile only')
    test.setTimeout(180000)
    const bytes = countBytes(page)
    if (slow) await throttle(page)

    const started = Date.now()
    await openMemberVotes(page)
    const totalMs = Date.now() - started

    const note = page.locator(`${PANEL} [data-measured]`)
    await expect(note).toHaveAttribute('data-measured', 'parquet')
    const text = (await note.innerText()).replace(/\s+/g, ' ')
    const engineMs = Number(text.match(/engine ready in (\d+) ms/)?.[1])
    const queryMs = Number(text.match(/query (\d+) ms/)?.[1])

    const label = `${testInfo.project.name}${slow ? ' throttled' : ''}`
    const summary = {
      profile: label,
      engineInitMs: engineMs,
      queryMs,
      timeToFirstRowMs: totalMs,
      engineKb: Math.round(bytes.engine / 1024),
      parquetKb: Math.round(bytes.parquet / 1024),
    }
    console.log(`[gate] ${JSON.stringify(summary)}`)
    await testInfo.attach('gate', {
      body: JSON.stringify(summary),
      contentType: 'application/json',
    })

    expect(engineMs).toBeGreaterThan(0)
    // The point of range requests: a filtered query must not pull the whole dataset.
    expect(bytes.parquet).toBeLessThan(900 * 1024)
  })
}

test('the view still works when the Parquet cannot be read', async ({ page }) => {
  test.setTimeout(120000)
  await page.route('**/*.parquet', (route) => route.abort())
  await openMemberVotes(page)
  await expect(page.locator(`${PANEL} [data-measured]`)).toHaveAttribute('data-measured', 'json')
  await expect(page.locator(`${PANEL} tbody tr`).first()).toBeVisible()
})

test('the query engine never reaches the start page', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (/duckdb|\.wasm(\?|$)/.test(request.url())) requests.push(request.url())
  })
  await page.goto('/#start')
  await expect(page.locator('.intro')).toBeVisible()
  await page.waitForTimeout(1500)
  expect(requests).toEqual([])
})
