/**
 * The job assistant's data (docs/job-assistant.md): the released files job-assistant/*.json,
 * read through the delivery manifest, and the owner's records at /api/jobs/*, read and written
 * only with the owner token, kept on this device until the owner forgets it.
 */
import { fetchJson } from '../dataSource'
import type { Delivered, Optional, Records } from './model'

export * from './model'

// What the page uses when an optional file fails: no matches (the open ads are listed), no texts
// (the detail links to Platsbanken), no demand table.
const EMPTY: Record<Optional, unknown> = {
  matches: { profile: null, matches: [] },
  texts: { texts: {} },
  demand: { skills: [] },
}

/** ads.json is required; a failed matches, texts or demand file is noted and left empty. */
export async function loadDelivered(): Promise<Delivered> {
  const optional = Object.keys(EMPTY) as Optional[]
  const [ads, ...rest] = await Promise.allSettled(
    ['ads', ...optional].map((n) =>
      fetchJson<unknown>(`job-assistant/${n}.json`),
    ),
  )
  if (ads.status === 'rejected') throw ads.reason
  const missing = optional.filter((_, i) => rest[i].status === 'rejected')
  const [matches, texts, demand] = rest.map((r, i) =>
    r.status === 'fulfilled' ? r.value : EMPTY[optional[i]],
  )
  return { ads: ads.value, matches, texts, demand, missing } as Delivered
}

const problem = (status: number): Records['problem'] =>
  status === 401 ? 'token' : status === 503 ? 'storage' : 'offline'

/**
 * The owner's records, read only with the owner token: statuses and notes sit next to named
 * employers. Empty and marked unavailable, with the reason, without the token or when the Worker
 * refuses, has no storage or cannot be reached.
 */
export async function loadRecords(): Promise<Records> {
  const token = ownerToken()
  const none = { reviews: {}, labels: {}, available: false }
  if (!token) return none
  try {
    const [r, l] = await Promise.all(
      ['reviews', 'labels'].map((k) =>
        fetch(`/api/jobs/${k}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ),
    )
    if (!r.ok || !l.ok)
      return { ...none, problem: problem(r.ok ? l.status : r.status) }
    return { ...(await r.json()), ...(await l.json()), available: true }
  } catch {
    return { ...none, problem: 'offline' }
  }
}

// localStorage: the owner pastes the token once per device (docs/job-assistant.md, Security of
// writes); it is sent only to this site's /api/jobs/ routes and removed by "Forget the token".
const TOKEN_KEY = 'job-assistant-owner-token'
// Where storage is blocked (some private windows) the token lasts for this page only.
let memory = ''
export const ownerToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? memory
  } catch {
    return memory
  }
}
export const setOwnerToken = (token: string) => {
  memory = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage blocked: memory holds it */
  }
}

/** A write to the owner routes; the token is sent only to this site's /api/jobs/. */
export async function write(
  path: string,
  method: 'PUT' | 'POST',
  body: BodyInit,
  type = 'application/json',
) {
  const response = await fetch(`/api/jobs/${path}`, {
    method,
    body,
    headers: { 'Content-Type': type, Authorization: `Bearer ${ownerToken()}` },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}`)
  return result
}

type Texts = Delivered['texts']['texts']
let remaining: Promise<Texts> | null = null
/**
 * The full text of an ad outside texts.json, from texts-remaining.json (about 8 MB): fetched
 * once, only when such an ad is opened. A failure is not cached, so the next ad tries again.
 */
export function remainingText(id: string): Promise<string | undefined> {
  remaining ??= fetchJson<{ texts: Texts }>(
    'job-assistant/texts-remaining.json',
  ).then(
    (f) => f.texts,
    (e) => {
      remaining = null
      throw e
    },
  )
  return remaining.then((t) => t[id]?.description)
}
