/**
 * The job assistant's routes with an in-memory D1: public reads, and writes refused without the
 * owner token, with a wrong token or from another origin.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker, { type Env } from './index.ts'
import { SQL, type D1 } from './jobs.ts'

const TOKEN = 'owner-secret-token'
const SHA = 'a'.repeat(64)

function memory(): D1 {
  const rows = new Map<
    string,
    { key: string; value: string; updated_at: string }
  >()
  return {
    prepare: (sql) => ({
      bind: (...v) => ({
        run: async () => {
          assert.equal(sql, SQL.upsert)
          rows.set(`${v[0]}\u0000${v[1]}`, {
            key: String(v[1]),
            value: String(v[2]),
            updated_at: String(v[3]),
          })
          return {}
        },
        first: async <T>() => {
          assert.equal(sql, SQL.get)
          return (rows.get(`${v[0]}\u0000${v[1]}`) ?? null) as T | null
        },
        all: async <T>() => {
          assert.equal(sql, SQL.list)
          const found = [...rows.entries()]
            .filter(([k]) => k.startsWith(`${v[0]}\u0000`))
            .map(([, r]) => r)
            .sort((a, b) => a.key.localeCompare(b.key))
          return { results: found as T[] }
        },
      }),
    }),
  }
}

const env = (db: D1 | null = memory()): Env => ({
  AI: { run: async () => ({}) },
  ASSETS: { fetch: async () => new Response('asset') },
  JOBS_DB: db ?? undefined,
  JOB_ASSIST_TOKEN: TOKEN,
})

const call = (
  e: Env,
  path: string,
  init: RequestInit & { token?: string; origin?: string } = {},
) => {
  const headers = new Headers(init.headers)
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`)
  if (init.origin) headers.set('Origin', init.origin)
  return worker.fetch(
    new Request(`https://site.test/api/jobs/${path}`, { ...init, headers }),
    e,
  )
}
const profile = (extra = {}) => ({
  schema_version: 1,
  status: 'draft',
  cv: { sha256: SHA },
  wishes: {},
  ...extra,
})

test('writes need the owner token and the site origin', async () => {
  const e = env()
  const body = JSON.stringify({ status: 'interesting', note: 'read in full' })
  for (const init of [
    {},
    { token: 'wrong' },
    { token: TOKEN, origin: 'https://evil.test' },
  ])
    assert.equal(
      (await call(e, 'reviews/31626862', { method: 'PUT', body, ...init }))
        .status,
      401,
    )
  assert.deepEqual(await (await call(e, 'reviews')).json(), { reviews: {} })
  const ok = await call(e, 'reviews/31626862', {
    method: 'PUT',
    body,
    token: TOKEN,
    origin: 'https://site.test',
  })
  assert.equal(ok.status, 200)
  const { reviews } = await (await call(e, 'reviews')).json()
  assert.equal(reviews['31626862'].status, 'interesting')
  assert.equal(reviews['31626862'].note, 'read in full')
})

test('statuses, labels and ids are checked', async () => {
  const e = env()
  const put = (path: string, b: unknown) =>
    call(e, path, { method: 'PUT', body: JSON.stringify(b), token: TOKEN })
  assert.equal((await put('reviews/1', { status: 'hired' })).status, 400)
  assert.equal((await put('reviews/..%2F', { status: 'pass' })).status, 404)
  assert.equal(
    (await put('labels/1', { label: 'relevant' })).status,
    400,
    'a label records the class shown',
  )
  assert.equal(
    (await put('labels/1', { label: 'relevant', shown_class: 'outside' }))
      .status,
    200,
  )
  const { labels } = await (await call(e, 'labels')).json()
  assert.deepEqual(
    [labels['1'].label, labels['1'].shown_class],
    ['relevant', 'outside'],
  )
})

test('draft, approval request and versions', async () => {
  const e = env()
  const put = (b: unknown) =>
    call(e, 'profile/draft', {
      method: 'PUT',
      body: JSON.stringify(b),
      token: TOKEN,
    })
  assert.equal(
    (await put({ profile: profile({ summary: 'mail me at a@b.se' }) })).status,
    400,
  )
  assert.equal(
    (await put({ profile: { ...profile(), status: 'approved' } })).status,
    400,
  )
  assert.equal(
    (await put({ profile: profile(), approval_requested: true })).status,
    200,
  )
  let state = await (await call(e, 'profile')).json()
  assert.equal(state.draft.approval_requested, true)
  assert.equal(state.approved, null)
  const post = (b: unknown) =>
    call(e, 'profile/versions', {
      method: 'POST',
      body: JSON.stringify(b),
      token: TOKEN,
    })
  assert.equal(
    (await post({ ...profile(), status: 'approved', version: 2 })).status,
    400,
    'versions go up by one',
  )
  assert.equal(
    (await post({ ...profile(), status: 'approved', version: 1 })).status,
    200,
  )
  state = await (await call(e, 'profile')).json()
  assert.equal(state.approved.version, 1)
  assert.equal(state.versions.length, 1)
})

test('CV upload accepts PDF and DOCX only and serves the file back', async () => {
  const e = env()
  const upload = (type: string, bytes: Uint8Array) =>
    call(e, 'cv', {
      method: 'POST',
      body: bytes,
      token: TOKEN,
      headers: { 'Content-Type': type, 'X-Filename': 'cv.pdf' },
    })
  assert.equal(
    (await upload('application/pdf', new TextEncoder().encode('not a pdf')))
      .status,
    400,
  )
  assert.equal(
    (await upload('text/html', new TextEncoder().encode('%PDF-1.7'))).status,
    400,
  )
  const pdf = new TextEncoder().encode('%PDF-1.7 minimal')
  const { sha256 } = await (await upload('application/pdf', pdf)).json()
  assert.match(sha256, /^[0-9a-f]{64}$/)
  const { files } = await (await call(e, 'cv')).json()
  assert.equal(files[0].filename, 'cv.pdf')
  const back = await call(e, `cv/${sha256}`)
  assert.equal(back.headers.get('Content-Type'), 'application/pdf')
  assert.deepEqual(new Uint8Array(await back.arrayBuffer()), pdf)
})

test('without D1 the routes say so and write nothing', async () => {
  assert.equal((await call(env(null), 'reviews')).status, 503)
})
