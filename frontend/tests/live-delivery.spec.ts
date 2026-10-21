import { createHash } from 'node:crypto'
import { test, expect } from '@playwright/test'

const manifestUrl = process.env.E2E_R2_MANIFEST_URL
const liveBase =
  process.env.E2E_SITE_URL ??
  `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 5173}`
const required = ['baseline', 'jobs', 'jobs-analysis', 'news', 'public-data']
const samples = {
  baseline: ['gold/semantic-model.json'],
  jobs: ['jobs/market.json'],
  news: ['parliament/news.json'],
  'public-data': ['welfare/datasets.json', 'taxes/countries.json'],
}

test.skip(!manifestUrl, 'opt-in check against a real approved R2 snapshot')

test('live bundle contains verified payloads for all required groups', async ({
  request,
}) => {
  const response = await request.get(manifestUrl!)
  expect(response.ok()).toBeTruthy()
  const current = await response.json()
  expect(current.schema_version).toBe(2)
  for (const group of required) {
    const pointer = current.groups[group]
    expect(pointer.release).toMatch(/^[a-f0-9]{64}$/)
    const reply = await request.get(
      new URL('../' + pointer.key, manifestUrl!).href,
    )
    expect(reply.ok()).toBeTruthy()
    const body = await reply.body()
    expect(body.length).toBe(pointer.bytes)
    expect(createHash('sha256').update(body).digest('hex')).toBe(pointer.sha256)
    const manifest = JSON.parse(body.toString())
    expect(manifest.release).toBe(pointer.release)
    const paths = samples[group as keyof typeof samples] ?? [
      Object.keys(manifest.files)[0],
    ]
    for (const path of paths) {
      const entry = manifest.files[path]
      const file = await request.get(
        new URL('../' + entry.key, manifestUrl!).href,
      )
      expect(file.ok()).toBeTruthy()
      const payload = await file.body()
      expect(payload.length).toBe(entry.bytes)
      expect(createHash('sha256').update(payload).digest('hex')).toBe(
        entry.sha256,
      )
    }
  }
})
