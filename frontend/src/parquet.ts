import { resolveDataUrl, localDataFallbackAllowed } from './dataSource'

/**
 * Exact release bytes. Local fallback is restricted to legacy localhost development.
 */
async function parquetBytes(path: string): Promise<ArrayBuffer> {
  const remote = await resolveDataUrl(path)
  try {
    const response = await fetch(remote)
    if (response.ok) return response.arrayBuffer()
  } catch {
    if (!(await localDataFallbackAllowed()))
      throw new Error(`${path}: approved Parquet delivery unavailable`)
  }
  if (!(await localDataFallbackAllowed()))
    throw new Error(`${path}: approved Parquet delivery unavailable`)
  const local = await fetch('data/' + path)
  if (!local.ok) throw new Error(`${path}: HTTP ${local.status}`)
  return local.arrayBuffer()
}

/** Rows of one Parquet part as plain objects. The reader is loaded on first use only. */
export async function readParquet(
  path: string,
): Promise<Record<string, unknown>[]> {
  const [buffer, { parquetReadObjects }] = await Promise.all([
    parquetBytes(path),
    import('hyparquet'),
  ])
  return parquetReadObjects({ file: buffer })
}
