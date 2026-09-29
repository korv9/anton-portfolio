/**
 * Fills the Vectorize index behind Herr taLLMan by calling the Worker's reindex route slice by
 * slice (docs/tallman.md). Needs the site URL and the ADMIN_TOKEN secret in the environment:
 *
 *   TALLMAN_URL=https://anton-portfolio.anton-ernstson.workers.dev ADMIN_TOKEN=… node scripts/tallman-reindex.mjs
 */
const base = process.env.TALLMAN_URL
const token = process.env.ADMIN_TOKEN
if (!base || !token) {
  console.error('Set TALLMAN_URL and ADMIN_TOKEN.')
  process.exit(1)
}

async function call(query) {
  const response = await fetch(`${base.replace(/\/$/, '')}/api/tallman/reindex?${query}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`${response.status}: ${body.error}`)
  return body
}

let result = await call('part=datapoints')
console.log(`datapoints: ${result.upserted}`)
let total = 0
while (result.next) {
  const from = Number(result.next.split(':')[1])
  result = await call(`part=debates&from=${from}&count=5`)
  total += result.upserted
  console.log(`debates ${from}–${from + result.debates - 1}: ${result.upserted} passages (${total} in all)`)
}
console.log('done')
