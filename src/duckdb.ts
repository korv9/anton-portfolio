/**
 * Lazily initialised DuckDB-WASM, for views that query Parquet in the browser.
 *
 * Nothing here is imported at the top level of any page. The engine is several megabytes,
 * so it is pulled in by a dynamic import from the one view that needs it, and the start page
 * never sees it. Callers are expected to keep a working path for when this fails.
 *
 * Timings are recorded so the storage decision rests on measurements rather than impressions.
 */

export type EngineTimings = {
  /** Milliseconds from first call to a ready connection, including the worker and wasm. */
  initMs: number
  /** Bytes the engine itself cost, as reported by the resource timing entries. */
  engineBytes: number
}

export type QueryResult<T> = {
  rows: T[]
  queryMs: number
  /** Bytes transferred for the data file, from resource timing. Range requests keep this
   *  far below the file size when the query only touches some row groups. */
  transferBytes: number
}

let enginePromise: Promise<{
  connect: () => Promise<unknown>
  timings: EngineTimings
}> | null = null

function transferredFor(match: string) {
  if (typeof performance === 'undefined') return 0
  return performance
    .getEntriesByType('resource')
    .filter((entry) => entry.name.includes(match))
    .reduce(
      (total, entry) => total + ((entry as PerformanceResourceTiming).transferSize || 0),
      0,
    )
}

async function start() {
  const started = performance.now()
  const duckdb = await import('@duckdb/duckdb-wasm')
  // jsDelivr serves the worker and wasm for the exact installed version, so the bundle is
  // pinned by package.json rather than by a hand-written URL.
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles())
  // The worker has to be same-origin, so it is wrapped rather than loaded cross-origin.
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: 'text/javascript',
    }),
  )
  const worker = new Worker(workerUrl)
  const database = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.ERROR), worker)
  await database.instantiate(bundle.mainModule, bundle.pthreadWorker)
  URL.revokeObjectURL(workerUrl)
  return {
    connect: () => database.connect(),
    timings: {
      initMs: Math.round(performance.now() - started),
      engineBytes: transferredFor('duckdb'),
    },
  }
}

export function engine() {
  if (!enginePromise) enginePromise = start()
  return enginePromise
}

/**
 * Run one SQL statement against Parquet reachable over HTTP.
 *
 * `url` is registered so DuckDB reads it with range requests instead of downloading it whole;
 * the measured transfer size is what proves that is happening.
 */
export async function queryParquet<T>(sql: string, url: string): Promise<QueryResult<T>> {
  const { connect } = await engine()
  const connection = (await connect()) as {
    query: (sql: string) => Promise<{ toArray: () => T[] }>
    close: () => Promise<void>
  }
  const before = transferredFor(url)
  const started = performance.now()
  try {
    const table = await connection.query(sql)
    return {
      rows: table.toArray().map((row) => JSON.parse(JSON.stringify(row)) as T),
      queryMs: Math.round(performance.now() - started),
      transferBytes: transferredFor(url) - before,
    }
  } finally {
    await connection.close()
  }
}

export function engineTimings() {
  return enginePromise
    ? enginePromise.then((value) => value.timings).catch(() => null)
    : Promise.resolve(null)
}
