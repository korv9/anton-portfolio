/**
 * The job assistant's routes with an in-memory D1: public reads, and writes and CV files refused
 * without the owner token, with a wrong token or from another origin.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import worker, { type Env } from './index.ts'
import { CONTACT, SQL, type D1 } from './jobs.ts'

// Shared with platform/tests/job_assistant/test_cv.py, so both CONTACT patterns agree.
const CASES: { contact: string[]; not_contact: string[] } = JSON.parse(
  readFileSync(
    new URL(
      '../platform/tests/job_assistant/contact_cases.json',
      import.meta.url,
    ),
    'utf8',
  ),
)

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
          assert.ok(sql === SQL.upsert || sql === SQL.insert)
          const k = `${v[0]}\u0000${v[1]}`
          if (sql === SQL.insert && rows.has(k)) return { meta: { changes: 0 } }
          rows.set(k, {
            key: String(v[1]),
            value: String(v[2]),
            updated_at: String(v[3]),
          })
          return { meta: { changes: 1 } }
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

const keys: string[] = []
const env = (db: D1 | null = memory()): Env => ({
  AI: { run: async () => ({}) },
  ASSETS: { fetch: async () => new Response('asset') },
  JOBS_DB: db ?? undefined,
  JOB_ASSIST_TOKEN: TOKEN,
  RATE_LIMITER: {
    limit: async ({ key }) => (keys.push(key), { success: true }),
  },
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
  for (const status of ['interview', 'offer', 'rejected'])
    assert.equal((await put('reviews/1', { status })).status, 200, status)
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
  assert.equal(state.draft, null, 'the unapproved draft is owner-only')
  state = await (await call(e, 'profile', { token: TOKEN })).json()
  assert.equal(state.draft.approval_requested, true)
  state = await (await call(e, 'profile', { token: 'wrong-token' })).json()
  assert.equal(state.draft, null)
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

test('personnummer and street addresses count as contact details', async () => {
  for (const text of CASES.contact) assert.ok(CONTACT.test(text), text)
  for (const text of CASES.not_contact) assert.ok(!CONTACT.test(text), text)
  const e = env()
  for (const [summary, status] of [
    ['19900161-1234', 400],
    ['Postadress 111 44 Stockholm', 400],
    ['Org.nr 556677-8899', 200],
  ] as const) {
    const r = await call(e, 'profile/draft', {
      method: 'PUT',
      body: JSON.stringify({ profile: profile({ summary }) }),
      token: TOKEN,
    })
    assert.equal(r.status, status, summary)
  }
})

test('a version stored by a concurrent approval is not overwritten', async () => {
  const db = memory()
  const v1 = JSON.stringify({ ...profile(), status: 'approved', version: 1 })
  // The other approval lands between this request's version count and its insert.
  const stale: D1 = {
    prepare: (sql) =>
      sql === SQL.list
        ? {
            bind: () => ({
              ...db.prepare(sql).bind(),
              all: async <T>() => ({ results: [] as T[] }),
            }),
          }
        : db.prepare(sql),
  }
  await db.prepare(SQL.insert).bind('version', '000001', v1, 'then').run()
  const r = await call(env(stale), 'profile/versions', {
    method: 'POST',
    body: v1,
    token: TOKEN,
  })
  assert.equal(r.status, 409)
})

test('a body declared too large is refused before it is read', async () => {
  const r = await call(env(), 'reviews/1', {
    method: 'PUT',
    body: '{}',
    token: TOKEN,
    headers: { 'Content-Length': '9000000' },
  })
  assert.equal(r.status, 400)
})

test('jobs routes need the rate limiter; reads and writes count apart', async () => {
  const e = env()
  keys.length = 0
  const ip = { 'CF-Connecting-IP': '1.2.3.4' }
  await call(e, 'reviews', { headers: ip })
  await call(e, 'reviews/1', { method: 'PUT', body: '{}', headers: ip })
  assert.deepEqual(keys, ['jobs-read:1.2.3.4', 'jobs-write:1.2.3.4'])
  assert.equal(
    (await call({ ...e, RATE_LIMITER: undefined }, 'reviews')).status,
    503,
  )
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
  // Raw uploads are owner-only: no listing or download without the token.
  assert.equal((await call(e, 'cv')).status, 401)
  assert.equal((await call(e, `cv/${sha256}`)).status, 401)
  const { files } = await (await call(e, 'cv', { token: TOKEN })).json()
  assert.equal(files[0].filename, 'cv.pdf')
  const back = await call(e, `cv/${sha256}`, { token: TOKEN })
  assert.equal(back.headers.get('Content-Type'), 'application/pdf')
  assert.equal(back.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(new Uint8Array(await back.arrayBuffer()), pdf)
})

test('without D1 the routes say so and write nothing', async () => {
  assert.equal((await call(env(null), 'reviews')).status, 503)
})
