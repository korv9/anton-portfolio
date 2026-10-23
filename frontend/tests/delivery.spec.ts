import { test, expect } from './test'

/**
 * JSON contracts are served from the site, not object storage. This test watches the network
 * rather than the rendered output, because with the files still present locally a broken
 * resolver would silently fall back to them and every other test would still pass.
 */

test('legacy delivery resolves JSON from the pinned site snapshots', async ({
  page,
}) => {
  const manifest = await page.request.get('/data/delivery.json')
  expect(manifest.ok()).toBeTruthy()
  const { bases, shard_prefixes } = await manifest.json()
  expect(bases.shard).toMatch(/^https:\/\//)
  expect(bases.json).toBe('data/')
  expect(shard_prefixes.length).toBeGreaterThan(0)

  const jsonRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/products/')) jsonRequests.push(request.url())
  })
  // The result tables' catalogue reads products/datasets.json.
  await page.goto('/#drugcomb-data')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(jsonRequests.length).toBeGreaterThan(0)
  for (const url of jsonRequests)
    expect(url.startsWith(bases.shard)).toBeFalsy()
})
