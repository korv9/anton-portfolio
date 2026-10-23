/**
 * The job assistant's data (docs/job-assistant.md): the released files job-assistant/*.json,
 * read through the delivery manifest, and the owner's records at /api/jobs/*, read in public
 * and written only with the owner token kept in this browser.
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

/** The owner's records; empty and marked unavailable when the Worker has no storage yet. */
export async function loadRecords(): Promise<Records> {
  try {
    const [r, l] = await Promise.all(
      ['reviews', 'labels'].map((k) => fetch(`/api/jobs/${k}`)),
    )
    if (!r.ok || !l.ok) return { reviews: {}, labels: {}, available: false }
    return { ...(await r.json()), ...(await l.json()), available: true }
  } catch {
    return { reviews: {}, labels: {}, available: false }
  }
}

const TOKEN_KEY = 'job-assistant-owner-token'
export const ownerToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}
export const setOwnerToken = (token: string) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
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
