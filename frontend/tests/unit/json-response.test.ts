import test from 'node:test'
import assert from 'node:assert/strict'
import { assertJsonResponse } from '../../src/jsonResponse.ts'

const answer = (body: string, type?: string) =>
  new Response(body, { headers: type ? { 'content-type': type } : {} })

test('a page served for a JSON path is a load failure, not data', async () => {
  for (const r of [
    answer('<!doctype html><html></html>', 'text/html; charset=utf-8'),
    answer('  <html></html>'),
  ])
    await assert.rejects(
      assertJsonResponse('products/x.json', r),
      /products\/x\.json could not be loaded/,
    )
})

test('JSON, an empty JSON answer and non-JSON paths pass', async () => {
  await assertJsonResponse('a.json', answer('[]', 'application/json'))
  const r = answer('{"rows":[]}', 'application/octet-stream')
  await assertJsonResponse('a.json?v=1', r)
  assert.deepEqual(await r.json(), { rows: [] })
  await assertJsonResponse('a.parquet', answer('<', 'text/html'))
})
