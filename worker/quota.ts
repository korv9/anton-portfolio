/**
 * Allegora's daily question allowance (index.ts, corpus 'sfs-all'): PER_VISITOR questions per IP
 * and TOTAL for the whole site per UTC day, counted in Workers KV (QUOTA). KV is eventually
 * consistent, so a burst can slip a question or two past the count; the rate limiter of 20 a
 * minute bounds that. Counts expire after two days. IPs are stored hashed.
 */
export const PER_VISITOR = 10
export const TOTAL = 200

export type Kv = {
  get: (key: string) => Promise<string | null>
  put: (
    key: string,
    value: string,
    o?: { expirationTtl?: number },
  ) => Promise<void>
}

async function hash(text: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  )
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Takes one question from the visitor's and the site's allowance, or says which is spent. */
export async function take(kv: Kv, ip: string, now = new Date()) {
  const day = now.toISOString().slice(0, 10)
  const visitorKey = `q:${day}:${await hash(ip)}`
  const totalKey = `q:${day}:total`
  const [visitor, total] = await Promise.all([
    kv.get(visitorKey),
    kv.get(totalKey),
  ])
  const used = Number(visitor ?? 0)
  if (used >= PER_VISITOR)
    return { ok: false as const, reason: 'limit' as const }
  if (Number(total ?? 0) >= TOTAL)
    return { ok: false as const, reason: 'site' as const }
  await Promise.all([
    kv.put(visitorKey, String(used + 1), { expirationTtl: 172800 }),
    kv.put(totalKey, String(Number(total ?? 0) + 1), { expirationTtl: 172800 }),
  ])
  return { ok: true as const }
}
