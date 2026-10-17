/** Logical dataset paths share one pinned delivery snapshot for the page lifetime. */
export type DeliveryFormat = 'json' | 'parquet' | 'shard'
type Entry = { key: string; sha256: string; bytes: number }
type Pointer = Entry & {
  release: string
  published_at: string
  dependencies: Record<string, string>
}
type Route = { first: string; last: string; group: string; index: Entry }
type Current = {
  schema_version: number
  snapshot: string
  activated_at: string
  groups: Record<string, Pointer>
  routes: Route[]
}
type Delivery = {
  bases: Record<DeliveryFormat, string>
  shardPrefixes: string[]
  current?: Current
  manifestUrl?: string
}
const LOCAL: Delivery = {
  bases: { json: 'data/', parquet: 'data/', shard: 'data/' },
  shardPrefixes: [],
}
const localMode = import.meta.env.VITE_DELIVERY_MODE === 'local'
const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(
  location.hostname,
)
let pending: Promise<Delivery> | null = null
const indexes = new Map<string, Promise<Record<string, Entry>>>()
let lastRefreshError: string | undefined

function logical(path: string) {
  const clean = path.replace(/^\/+/, '').replace(/^data\//, '')
  if (
    !clean ||
    clean.split('/').some((p) => !p || p === '.' || p === '..') ||
    /[\\?#:]/.test(clean)
  )
    throw new Error(`Invalid logical data path: ${path}`)
  return clean
}

function objectUrl(key: string, manifestUrl: string) {
  if (
    !key.startsWith('releases/') ||
    key.split('/').some((p) => p === '..' || !p) ||
    /[\\?#:]/.test(key)
  )
    throw new Error('Invalid release object path')
  return new URL('../' + key, manifestUrl).href
}

async function jsonAt(url: string, cache: RequestCache = 'default') {
  const response = await fetch(siteDataUrl(url), { cache })
  if (!response.ok)
    throw new Error(`Delivery manifest unavailable: HTTP ${response.status}`)
  return response.json()
}

function siteDataUrl(url: string) {
  return new URL(url, new URL(import.meta.env.BASE_URL, location.origin)).href
}

function validateCurrent(value: Current) {
  if (
    value.schema_version !== 2 ||
    !value.groups ||
    !value.snapshot ||
    !value.activated_at ||
    !Array.isArray(value.routes)
  )
    throw new Error('Unsupported active delivery manifest')
  for (const [name, pointer] of Object.entries(value.groups)) {
    if (
      pointer.key !== `releases/${name}/${pointer.release}/manifest.json` ||
      !/^[a-z0-9-]+$/.test(name) ||
      !/^[a-f0-9]{64}$/.test(pointer.release)
    )
      throw new Error('Invalid group pointer')
    for (const [dep, release] of Object.entries(pointer.dependencies ?? {}))
      if (value.groups[dep]?.release !== release)
        throw new Error(`Incompatible delivery dependency: ${name}/${dep}`)
  }
  for (const route of value.routes) {
    const pointer = value.groups[route.group]
    if (
      !pointer ||
      !route.index.key.startsWith(
        `releases/${route.group}/${pointer.release}/indexes/`,
      ) ||
      logical(route.first) !== route.first ||
      logical(route.last) !== route.last ||
      route.first > route.last
    )
      throw new Error('Invalid delivery route')
  }
  return value
}

async function snapshot(manifestUrl: string): Promise<Delivery> {
  const current = validateCurrent(await jsonAt(manifestUrl, 'no-cache'))
  return { ...LOCAL, current, manifestUrl }
}

async function fileIndex(
  route: Route,
  delivery: Delivery,
): Promise<Record<string, Entry>> {
  let result = indexes.get(route.index.key)
  if (!result) {
    result = (async () => {
      const pointer = route.index
      const response = await fetch(
        objectUrl(pointer.key, delivery.manifestUrl!),
      )
      if (!response.ok)
        throw new Error(
          `Delivery ${route.group} index unavailable: HTTP ${response.status}`,
        )
      const bytes = await response.arrayBuffer()
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (n) => n.toString(16).padStart(2, '0'),
      ).join('')
      if (bytes.byteLength !== pointer.bytes || hash !== pointer.sha256)
        throw new Error(`Delivery ${route.group} index failed integrity check`)
      const files: Record<string, Entry> = JSON.parse(
        new TextDecoder().decode(bytes),
      )
      for (const [path, entry] of Object.entries(files)) {
        if (
          logical(path) !== path ||
          entry.key !==
            `releases/${route.group}/${delivery.current!.groups[route.group].release}/files/${path}`
        )
          throw new Error(`Invalid or duplicate delivered path: ${path}`)
      }
      return files
    })()
    indexes.set(route.index.key, result)
  }
  return result
}

async function bootstrap(): Promise<Delivery> {
  if (localMode) return LOCAL
  const override = import.meta.env.VITE_R2_MANIFEST_URL
  if (override) return snapshot(override)
  let manifest
  try {
    manifest = await jsonAt('data/delivery.json', 'no-cache')
  } catch (error) {
    if (localHost) return LOCAL
    throw error
  }
  if (manifest.manifest_url) return snapshot(manifest.manifest_url)
  if (!manifest.bases) throw new Error('Invalid legacy delivery manifest')
  return {
    bases: { ...LOCAL.bases, ...manifest.bases },
    shardPrefixes: manifest.shard_prefixes ?? [],
  }
}

function load(): Promise<Delivery> {
  return (pending ??= bootstrap())
}

export async function resolveDataUrl(path: string): Promise<string> {
  const clean = logical(path)
  const delivery = await load()
  if (delivery.current) {
    const routes = delivery.current.routes.filter(
      (r) => clean >= r.first && clean <= r.last,
    )
    for (const route of routes) {
      const entry = (await fileIndex(route, delivery))[clean]
      if (entry) return objectUrl(entry.key, delivery.manifestUrl!)
    }
    throw new Error(
      `Dataset unavailable in approved delivery: ${clean} (${delivery.current.activated_at})`,
    )
  }
  const format = clean.endsWith('.parquet')
    ? 'parquet'
    : !clean.endsWith('/index.json') &&
        delivery.shardPrefixes.some((p) => clean.startsWith(p))
      ? 'shard'
      : 'json'
  return delivery.bases[format] + clean
}

/** Fetch failures retain the pinned snapshot and never switch to local production data. */
export async function fetchData(path: string, init?: RequestInit) {
  const response = await fetch(siteDataUrl(await resolveDataUrl(path)), init)
  if (!response.ok) {
    const state = await deliveryState()
    throw new Error(
      `${path}: HTTP ${response.status}${state.activatedAt ? ` (approved delivery ${state.activatedAt})` : ''}`,
    )
  }
  return response
}

export async function localDataFallbackAllowed() {
  return localMode || (localHost && !(await load()).current)
}

/** Mutable run status is outside release snapshots and cannot supply dataset files. */
export async function objectStorageUrl(path: string): Promise<string> {
  const delivery = await load()
  const clean = logical(path)
  if (delivery.manifestUrl)
    return new URL('../' + clean, delivery.manifestUrl).href
  return delivery.bases.shard + clean
}

export async function deliveryState() {
  const delivery = await load()
  return {
    snapshot: delivery.current?.snapshot,
    activatedAt: delivery.current?.activated_at,
    groups: delivery.current?.groups,
    mode: delivery.current ? 'remote' : 'local-or-legacy',
    lastRefreshError,
  }
}

/** Reload clears every component cache together; the current page never adopts half a release. */
export async function refreshDelivery(): Promise<boolean> {
  const delivery = await load()
  if (!delivery.manifestUrl) return false
  const next = validateCurrent(await jsonAt(delivery.manifestUrl, 'no-cache'))
  if (next.snapshot === delivery.current?.snapshot) return false
  location.reload()
  return true
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && pending)
    void refreshDelivery().catch((error: unknown) => {
      lastRefreshError = String(error)
      console.error(
        'Delivery refresh failed; retaining approved snapshot',
        error,
      )
      window.dispatchEvent(new CustomEvent('delivery-error', { detail: error }))
    })
})
