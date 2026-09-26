/**
 * Resolves a logical data path to the URL it is actually served from.
 *
 * Paths are written relative to the data root ('gold/overview.json', not
 * '/data/gold/overview.json'). The base URL per format comes from
 * /data/delivery.json, which scripts/build-catalog.py generates. Moving document
 * shards to object storage therefore changes that manifest, not any component.
 *
 * The classification rule lives in the manifest too, so the site and the build
 * script cannot drift apart. If the manifest is missing or unreadable the site
 * falls back to serving everything from /data/, which is the pre-move layout.
 */

export type DeliveryFormat = 'json' | 'parquet' | 'shard'

type Delivery = {
  bases: Record<DeliveryFormat, string>
  shardPrefixes: string[]
  /** Parts per Parquet dataset. DuckDB cannot glob over HTTP, so they are listed explicitly. */
  parquetDatasets: Record<string, string[]>
}

const FALLBACK: Delivery = {
  bases: { json: 'data/', parquet: 'data/', shard: 'data/' },
  shardPrefixes: [],
  parquetDatasets: {},
}

let pending: Promise<Delivery> | null = null

function load(): Promise<Delivery> {
  if (!pending)
    pending = fetch('data/delivery.json')
      .then((response) => {
        if (!response.ok) throw new Error('No delivery manifest')
        return response.json()
      })
      .then((manifest) => ({
        bases: { ...FALLBACK.bases, ...manifest.bases },
        shardPrefixes: manifest.shard_prefixes ?? [],
        parquetDatasets: manifest.parquet_datasets ?? {},
      }))
      .catch(() => FALLBACK)
  return pending
}

/** Document shards are addressed one at a time through an index; their own index stays JSON. */
function formatOf(path: string, delivery: Delivery): DeliveryFormat {
  if (path.endsWith('.parquet')) return 'parquet'
  if (path.endsWith('/index.json')) return 'json'
  return delivery.shardPrefixes.some((prefix) => path.startsWith(prefix))
    ? 'shard'
    : 'json'
}

/**
 * Logical paths start with a product segment ('gold/', 'politics/', …), never with 'data/'.
 * Generated files such as products/datasets.json still carry '/data/'-rooted paths, so strip
 * that prefix rather than producing '/data/data/…'.
 */
function logical(path: string) {
  return path.replace(/^\/+/, '').replace(/^data\//, '')
}

export async function resolveDataUrl(path: string): Promise<string> {
  const clean = logical(path)
  const delivery = await load()
  return delivery.bases[formatOf(clean, delivery)] + clean
}

/** Fetch a logical data path. Use this instead of fetch() so every request is resolved. */
export async function fetchData(path: string, init?: RequestInit) {
  return fetch(await resolveDataUrl(path), init)
}

/** Resolved URLs for every part of a Parquet dataset, for read_parquet's array form. */
export async function parquetParts(dataset: string): Promise<string[]> {
  const delivery = await load()
  const parts = delivery.parquetDatasets[dataset] ?? []
  return Promise.all(parts.map((part) => resolveDataUrl(part)))
}

/** URL of a path in object storage, for files outside the catalogue such as run status. */
export async function objectStorageUrl(path: string): Promise<string> {
  const delivery = await load()
  return delivery.bases.shard + logical(path)
}

/** Test seam: forget the cached manifest so the next resolve refetches it. */
export function resetDeliveryCache() {
  pending = null
}
