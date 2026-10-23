/**
 * The job assistant's owner records in D1 (docs/job-assistant.md). Reads are public except the
 * uploaded CV files and the unapproved draft; every write, every CV read and the draft need the Worker secret JOB_ASSIST_TOKEN as a
 * bearer token, compared in constant time, and comes from the site's own origin or from no browser
 * at all (the hourly GitHub Actions run).
 *
 * One table, records(kind, key, value, updated_at), holds every kind:
 *   cv       key = SHA-256 of the file; value = {filename, media_type, size, base64}
 *   draft    key = 'current'; {profile (schema v1), approval_requested, problems}
 *   version  key = zero-padded version number; an approved profile, written by the hourly run
 *            after platform/job_assistant/cv_profile.py has checked it against the CV text
 *   review   key = ad id; {status, note}
 *   label    key = ad id; {label, note, shown_class}
 */

export type D1 = {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{ meta?: { changes?: number } }>
      all: <T>() => Promise<{ results: T[] }>
      first: <T>() => Promise<T | null>
    }
  }
}
export type JobsEnv = { JOBS_DB?: D1; JOB_ASSIST_TOKEN?: string }
type Row = { key: string; value: string; updated_at: string }

export const STATUSES = [
  'new',
  'review',
  'interesting',
  'pass',
  'applied',
  'interview',
  'offer',
  'rejected',
  'closed',
]
export const LABELS = ['relevant', 'maybe', 'not_relevant']
const CLASSES = ['strong', 'possible', 'stretch', 'outside']
const MEDIA: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    0x50, 0x4b,
  ],
}
// D1 stores at most 2 MB per value: base64 adds a third, so the file stops at 1.4 MB.
const MAX_CV = 1_400_000
const MAX_PROFILE = 512_000
const AD_ID = /^[0-9A-Za-z_-]{1,40}$/
// E-mail, phone, Swedish personnummer, street address, and a postcode before a town.
// The same pattern as CONTACT in platform/job_assistant/cv.py.
const CONTACT =
  /@|\+\d[\d ]{6,}|\b0\d{2}[- ]?\d{3} ?\d{2} ?\d{2}\b|\b(?:19|20)?\d{6}[-+]?\d{4}\b|\p{L}*(?:gatan|vägen|gränd|torget|allén|stigen) \d+|\b\d{3} ?\d{2} [A-ZÅÄÖ][a-zåäö]+/u

export const SQL = {
  upsert:
    'insert into records (kind, key, value, updated_at) values (?, ?, ?, ?) ' +
    'on conflict (kind, key) do update set value = excluded.value, updated_at = excluded.updated_at',
  // A version is only ever added: two concurrent approvals of the same number cannot both win.
  insert:
    'insert into records (kind, key, value, updated_at) values (?, ?, ?, ?) ' +
    'on conflict (kind, key) do nothing',
  get: 'select key, value, updated_at from records where kind = ? and key = ?',
  list: 'select key, value, updated_at from records where kind = ? order by key',
}

const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  })

async function same(a: string, b: string) {
  const enc = new TextEncoder()
  const [x, y] = await Promise.all(
    [a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))),
  )
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (a: ArrayBuffer, b: ArrayBuffer) => boolean
  }
  if (subtle.timingSafeEqual) return subtle.timingSafeEqual(x, y)
  const u = new Uint8Array(x)
  const v = new Uint8Array(y)
  return u.reduce((d, n, i) => d | (n ^ v[i]), 0) === 0
}

/** Whether a write may go ahead: right token, and no foreign browser origin. */
export async function owner(request: Request, env: JobsEnv) {
  const origin = request.headers.get('Origin')
  if (origin && origin !== new URL(request.url).origin) return false
  const token = (request.headers.get('Authorization') ?? '').replace(
    /^Bearer\s+/i,
    '',
  )
  return Boolean(
    env.JOB_ASSIST_TOKEN && token && (await same(token, env.JOB_ASSIST_TOKEN)),
  )
}

const parse = (row: Row | null) =>
  row && { ...JSON.parse(row.value), updated_at: row.updated_at }

async function put(db: D1, kind: string, key: string, value: unknown) {
  const at = new Date().toISOString()
  await db.prepare(SQL.upsert).bind(kind, key, JSON.stringify(value), at).run()
  return at
}

async function list(db: D1, kind: string) {
  const { results } = await db.prepare(SQL.list).bind(kind).all<Row>()
  return results
}

/** A declared body above the limit is refused before it is read; the read is checked again. */
const tooLarge = (request: Request, max: number) =>
  Number(request.headers.get('Content-Length') ?? 0) > max

async function readJson(request: Request, max: number) {
  if (tooLarge(request, max)) return null
  const raw = await request.text()
  if (raw.length > max) return null
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : null
  } catch {
    return null
  }
}

/** The shape a draft must have before it is stored; the CV quote check runs in Python later. */
function draftProblem(p: Record<string, unknown>) {
  const cv = p.cv as Record<string, unknown> | undefined
  if (p.schema_version !== 1 || p.status !== 'draft')
    return 'schema_version 1, status draft'
  if (!cv || !/^[0-9a-f]{64}$/.test(String(cv.sha256))) return 'cv.sha256'
  if (CONTACT.test(JSON.stringify(p))) return 'contact details'
  return null
}

const toBase64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

async function hex(bytes: ArrayBuffer) {
  const d = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(d)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function jobs(request: Request, env: JobsEnv): Promise<Response> {
  const db = env.JOBS_DB
  if (!db)
    return reply({ error: 'job assistant storage is not configured' }, 503)
  const path = new URL(request.url).pathname
    .slice('/api/jobs/'.length)
    .split('/')
  const write = request.method !== 'GET'
  // Raw uploaded CVs (drafts, older versions) are owner-only; the approved profile is public.
  if ((write || path[0] === 'cv') && !(await owner(request, env)))
    return reply({ error: 'owner token required' }, 401)

  if (path[0] === 'profile' && path.length === 1 && !write) {
    const versions = await list(db, 'version')
    const last = versions.at(-1) ?? null
    // The draft is unapproved: only the owner sees it.
    const draft = (await owner(request, env))
      ? parse(await db.prepare(SQL.get).bind('draft', 'current').first<Row>())
      : null
    return reply({
      draft,
      // The approved profile exactly as stored, so its profile_sha256 still matches.
      approved: last ? JSON.parse(last.value) : null,
      versions: versions.map((v) => {
        const p = JSON.parse(v.value)
        return {
          version: p.version,
          approved_at: p.approved_at,
          profile_sha256: p.profile_sha256,
          cv_sha256: p.cv?.sha256,
        }
      }),
    })
  }
  if (
    path[0] === 'profile' &&
    path[1] === 'draft' &&
    request.method === 'PUT'
  ) {
    // {profile, approval_requested, problems}: the owner asks for approval, the hourly run checks
    // the draft against the CV text and either adds a version or writes back its problems.
    const b = await readJson(request, MAX_PROFILE)
    const p = b?.profile
    const problem =
      p && typeof p === 'object' ? draftProblem(p) : 'a profile object'
    if (problem) return reply({ error: `draft needs ${problem}` }, 400)
    const problems = Array.isArray(b.problems)
      ? b.problems.map(String).slice(0, 50)
      : []
    const value = {
      profile: p,
      approval_requested: b.approval_requested === true,
      problems,
    }
    return reply({ updated_at: await put(db, 'draft', 'current', value) })
  }
  if (
    path[0] === 'profile' &&
    path[1] === 'versions' &&
    request.method === 'POST'
  ) {
    const p = await readJson(request, MAX_PROFILE)
    const versions = await list(db, 'version')
    const next = versions.length
      ? JSON.parse(versions.at(-1)!.value).version + 1
      : 1
    if (
      !p ||
      p.status !== 'approved' ||
      p.version !== next ||
      CONTACT.test(JSON.stringify(p))
    )
      return reply({ error: `an approved profile with version ${next}` }, 400)
    const at = new Date().toISOString()
    const { meta } = await db
      .prepare(SQL.insert)
      .bind('version', String(next).padStart(6, '0'), JSON.stringify(p), at)
      .run()
    if (!meta?.changes)
      return reply({ error: `version ${next} was stored meanwhile` }, 409)
    return reply({ version: next, updated_at: at })
  }
  if (path[0] === 'cv' && path.length === 1) {
    if (!write) {
      const rows = await list(db, 'cv')
      return reply({
        files: rows
          .map((r) => {
            const { filename, media_type, size } = JSON.parse(r.value)
            return {
              sha256: r.key,
              filename,
              media_type,
              size,
              uploaded_at: r.updated_at,
            }
          })
          .sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at)),
      })
    }
    if (request.method !== 'POST') return reply({ error: 'POST a file' }, 405)
    const media = (request.headers.get('Content-Type') ?? '')
      .split(';')[0]
      .trim()
    const magic = MEDIA[media]
    if (!magic || tooLarge(request, MAX_CV))
      return reply({ error: 'a PDF or DOCX file up to 1.4 MB' }, 400)
    const bytes = new Uint8Array(await request.arrayBuffer())
    if (bytes.length > MAX_CV || !magic.every((b, i) => bytes[i] === b))
      return reply({ error: 'a PDF or DOCX file up to 1.4 MB' }, 400)
    const filename = (request.headers.get('X-Filename') ?? 'cv')
      .replace(/[^\w. -]/g, '')
      .slice(0, 120)
    const sha256 = await hex(bytes.buffer)
    await put(db, 'cv', sha256, {
      filename,
      media_type: media,
      size: bytes.length,
      base64: toBase64(bytes),
    })
    return reply({ sha256 })
  }
  if (path[0] === 'cv' && /^[0-9a-f]{64}$/.test(path[1] ?? '') && !write) {
    const row = await db.prepare(SQL.get).bind('cv', path[1]).first<Row>()
    if (!row) return reply({ error: 'not found' }, 404)
    const { media_type, base64 } = JSON.parse(row.value)
    return new Response(
      Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
      {
        headers: {
          'Content-Type': media_type,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    )
  }
  for (const [kind, field, allowed] of [
    ['review', 'status', STATUSES],
    ['label', 'label', LABELS],
  ] as const) {
    if (path[0] !== kind + 's') continue
    if (!write && path.length === 1) {
      const rows = await list(db, kind)
      return reply({
        [kind + 's']: Object.fromEntries(rows.map((r) => [r.key, parse(r)])),
      })
    }
    if (request.method === 'PUT' && AD_ID.test(path[1] ?? '')) {
      const b = await readJson(request, 8_000)
      const note = b?.note ?? ''
      const shown = b?.shown_class ?? null
      if (
        !b ||
        !allowed.includes(b[field] as never) ||
        typeof note !== 'string' ||
        note.length > 4000 ||
        (kind === 'label' && !CLASSES.includes(String(shown)))
      )
        return reply(
          {
            error: `${field} one of ${allowed.join(', ')}, note up to 4,000 characters`,
          },
          400,
        )
      const value =
        kind === 'label'
          ? { label: b.label, note, shown_class: shown }
          : { status: b.status, note }
      return reply({ updated_at: await put(db, kind, path[1], value) })
    }
  }
  return reply({ error: 'not found' }, 404)
}
