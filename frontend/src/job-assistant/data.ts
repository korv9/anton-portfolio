/**
 * The job assistant's data (docs/job-assistant.md): the released files job-assistant/*.json,
 * read through the delivery manifest, and the owner's records at /api/jobs/*, read and written
 * only with the owner token, kept for this tab's session.
 */
import { fetchJson } from '../dataSource'
import type { Delivered, Records } from './model'

export * from './model'

export async function loadDelivered(): Promise<Delivered> {
  const [ads, matches, texts, demand] = await Promise.all(
    ['ads', 'matches', 'texts', 'demand'].map((n) =>
      fetchJson<unknown>(`job-assistant/${n}.json`),
    ),
  )
  return { ads, matches, texts, demand } as Delivered
}

/**
 * The owner's records, read only with the owner token: statuses and notes sit next to named
 * employers. Empty and marked unavailable without the token or when the Worker has no storage.
 */
export async function loadRecords(): Promise<Records> {
  const token = ownerToken()
  if (!token) return { reviews: {}, labels: {}, available: false }
  try {
    const [r, l] = await Promise.all(
      ['reviews', 'labels'].map((k) =>
        fetch(`/api/jobs/${k}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ),
    )
    if (!r.ok || !l.ok) return { reviews: {}, labels: {}, available: false }
    return { ...(await r.json()), ...(await l.json()), available: true }
  } catch {
    return { reviews: {}, labels: {}, available: false }
  }
}

// sessionStorage, not localStorage: the token ends with the tab and is not left on the device.
const TOKEN_KEY = 'job-assistant-owner-token'
export const ownerToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}
export const setOwnerToken = (token: string) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private window: the token lasts for this page only */
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
