import { createHash } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'

const base = 'https://data.test/'
const moduleUrl = '/src/dataSource.ts?delivery-fixture'
const paths = [
  'jobs/market.json',
  'parliament/news.json',
  'welfare/datasets.json',
  'parquet/welfare/dim_date.parquet',
  'politics/parliament/issues/1993-94/index.json',
  'politics/parliament/issues/1993-94/gh092.json',
]

function fixture(version: string) {
  const release = version.repeat(64)
  const prefix = `releases/baseline/${release}/`
  const files = Object.fromEntries(
    paths.map((path) => [
      path,
      { key: prefix + 'files/' + path, bytes: 2, sha256: '0'.repeat(64) },
    ]),
  )
  const body = JSON.stringify(files)
  const index = {
    key: prefix + 'indexes/fixture.json',
    bytes: Buffer.byteLength(body),
    sha256: createHash('sha256').update(body).digest('hex'),
  }
  return {
    body,
    current: {
      schema_version: 2,
      snapshot: release,
      activated_at: '2026-10-12T12:00:00Z',
      groups: {
        baseline: {
          key: prefix + 'manifest.json',
          release,
          bytes: 2,
          sha256: '0'.repeat(64),
          published_at: '2026-10-11T12:00:00Z',
          dependencies: {},
        },
      },
      routes: [
        {
          first: [...paths].sort()[0],
          last: [...paths].sort().at(-1),
          group: 'baseline',
          index,
        },
      ],
    },
  }
}

async function harness(page: Page) {
  await page.route('**/delivery-fixture.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Delivery fixture</title>',
    }),
  )
  await page.route('**/data/delivery.json', (route) =>
    route.fulfill({
      json: {
        schema_version: 2,
        manifest_url: base + 'manifests/current.json',
      },
    }),
  )
  await page.goto('/delivery-fixture.html')
}

test('real logical paths resolve lazily and downloads and shards share a pinned release', async ({
  page,
}) => {
  const a = fixture('a')
  const b = fixture('b')
  let active = a
  const requests: string[] = []
  await page.route(base + '**', (route) => {
    const url = route.request().url()
    requests.push(url)
    if (url.endsWith('manifests/current.json'))
      return route.fulfill({ json: active.current })
    if (url.includes('/indexes/'))
      return route.fulfill({
        contentType: 'application/json',
        body: url.includes('/' + 'a'.repeat(64) + '/') ? a.body : b.body,
      })
    return route.fulfill({ body: '{}' })
  })
  await harness(page)
  const resolved = await page.evaluate(
    async ({ moduleUrl, paths }) => {
      const m = await import(moduleUrl)
      return Promise.all(paths.map((p) => m.resolveDataUrl('/data/' + p)))
    },
    { moduleUrl, paths },
  )
  expect(resolved).toEqual(
    paths.map((p) => base + `releases/baseline/${'a'.repeat(64)}/files/` + p),
  )
  expect(
    requests.filter((u) => u.endsWith('manifests/current.json')),
  ).toHaveLength(1)
  expect(requests.filter((u) => u.includes('/indexes/'))).toHaveLength(1)
  expect(requests.some((u) => u.endsWith('/manifest.json'))).toBe(false)
  active = b
  expect(
    await page.evaluate(
      async (url) => (await import(url)).resolveDataUrl('jobs/market.json'),
      moduleUrl,
    ),
  ).toContain('a'.repeat(64))
  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(
      async (url) => (await import(url)).refreshDelivery(),
      moduleUrl,
    ),
  ])
  expect(
    await page.evaluate(
      async (url) => (await import(url)).resolveDataUrl('jobs/market.json'),
      moduleUrl,
    ),
  ).toContain('b'.repeat(64))
})

test('failed refresh keeps dated prior snapshot and reports a delivery error', async ({
  page,
}) => {
  const a = fixture('a')
  let unavailable = false
  await page.route(base + '**', (route) => {
    if (route.request().url().endsWith('current.json'))
      return unavailable
        ? route.fulfill({ status: 503 })
        : route.fulfill({ json: a.current })
    return route.fulfill({ body: a.body })
  })
  await harness(page)
  await page.evaluate(
    async (url) => (await import(url)).resolveDataUrl('jobs/market.json'),
    moduleUrl,
  )
  unavailable = true
  const state = await page.evaluate(async (url) => {
    const m = await import(url)
    await new Promise<void>((resolve) => {
      window.addEventListener('delivery-error', () => resolve(), { once: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    return {
      ...(await m.deliveryState()),
      path: await m.resolveDataUrl('jobs/market.json'),
    }
  }, moduleUrl)
  expect(state.lastRefreshError).toContain('503')
  expect(state.activatedAt).toBe('2026-10-12T12:00:00Z')
  expect(state.path).toContain('a'.repeat(64))
})

test('remote errors, missing paths and damaged index never use local production fixtures', async ({
  page,
}) => {
  const a = fixture('a')
  let damaged = false
  const local: string[] = []
  await page.route('**/data/jobs/**', (route) => {
    local.push(route.request().url())
    return route.fulfill({ body: '{}' })
  })
  await page.route(base + '**', (route) => {
    const url = route.request().url()
    if (url.endsWith('current.json')) return route.fulfill({ json: a.current })
    if (url.includes('/indexes/'))
      return route.fulfill({ body: damaged ? '{}' : a.body })
    return route.fulfill({ status: 503 })
  })
  await harness(page)
  const error = await page.evaluate(async (url) => {
    try {
      await (await import(url)).fetchData('jobs/market.json')
      return ''
    } catch (e) {
      return String(e)
    }
  }, moduleUrl)
  expect(error).toContain('503')
  expect(error).toContain('2026-10-12')
  expect(
    await page.evaluate(async (url) => {
      try {
        await (await import(url)).resolveDataUrl('jobs/missing.json')
        return ''
      } catch (e) {
        return String(e)
      }
    }, moduleUrl),
  ).toContain('Dataset unavailable')
  damaged = true
  await page.reload()
  expect(
    await page.evaluate(async (url) => {
      try {
        await (await import(url)).resolveDataUrl('jobs/market.json')
        return ''
      } catch (e) {
        return String(e)
      }
    }, moduleUrl),
  ).toContain('integrity check')
  expect(local).toEqual([])
})

test('Parquet remote failure never falls back locally in live mode', async ({
  page,
}) => {
  const a = fixture('a')
  let localReads = 0
  await page.route('**/data/parquet/**', (route) => {
    localReads++
    return route.fulfill({ body: 'local' })
  })
  await page.route(base + '**', (route) => {
    const url = route.request().url()
    if (url.endsWith('current.json')) return route.fulfill({ json: a.current })
    if (url.includes('/indexes/')) return route.fulfill({ body: a.body })
    return route.fulfill({ status: 503 })
  })
  await harness(page)
  const error = await page.evaluate(async () => {
    const url = '/src/parquet.ts'
    try {
      await (await import(url)).readParquet('parquet/welfare/dim_date.parquet')
      return ''
    } catch (e) {
      return String(e)
    }
  })
  expect(error).toContain('approved Parquet delivery unavailable')
  expect(localReads).toBe(0)
})

test('schema1 local deliveries retain format classification and offline fixtures', async ({
  page,
}) => {
  await harness(page)
  await page.route('**/data/delivery.json', (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        bases: { json: 'data/', parquet: base, shard: base },
        shard_prefixes: ['politics/parliament/issues/'],
      },
    }),
  )
  const values = await page.evaluate(async (url) => {
    const m = await import(url)
    return Promise.all([
      m.resolveDataUrl('jobs/market.json'),
      m.resolveDataUrl('politics/parliament/issues/index.json'),
      m.resolveDataUrl('politics/parliament/issues/1993-94/gh092.json'),
      m.localDataFallbackAllowed(),
    ])
  }, moduleUrl)
  expect(values).toEqual([
    'data/jobs/market.json',
    'data/politics/parliament/issues/index.json',
    base + 'politics/parliament/issues/1993-94/gh092.json',
    true,
  ])
})
