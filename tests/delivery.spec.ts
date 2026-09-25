import { test, expect } from '@playwright/test'

/**
 * Shards are served from object storage, JSON contracts from the site. These tests watch the
 * network rather than the rendered output, because with the shard files still present locally
 * a broken resolver would silently fall back to them and every other test would still pass.
 */

test('document shards load from object storage, not from the site', async ({
  page,
}) => {
  const shardRequests: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (
      /\/politics\/(parliament\/(issues|debates)|decisions|laws\/v[12])\//.test(
        url,
      )
    )
      shardRequests.push(url)
  })

  await page.goto('/#data-explorer')
  await page
    .getByRole('button', { name: /Read full speech/ })
    .first()
    .click()
  await expect(page.locator('.speech-reader h4')).toBeVisible()

  expect(shardRequests.length).toBeGreaterThan(0)
  for (const url of shardRequests) expect(url).toContain('.r2.dev/')
})

test('the delivery manifest drives resolution and JSON stays on the site', async ({
  page,
}) => {
  const manifest = await page.request.get('/data/delivery.json')
  expect(manifest.ok()).toBeTruthy()
  const { bases, shard_prefixes } = await manifest.json()
  expect(bases.shard).toMatch(/^https:\/\//)
  expect(bases.json).toBe('/data/')
  expect(shard_prefixes.length).toBeGreaterThan(0)

  const goldRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/gold/')) goldRequests.push(request.url())
  })
  await page.goto('/#politics')
  await expect(page.locator('.politics-kpis')).toBeVisible()
  expect(goldRequests.length).toBeGreaterThan(0)
  for (const url of goldRequests) expect(url).not.toContain('.r2.dev/')
})
