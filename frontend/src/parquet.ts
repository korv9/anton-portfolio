import { resolveDataUrl } from './dataSource'

/**
 * Bytes of a delivered Parquet part. Object storage first, as the delivery manifest says;
 * the site's own copy when that fails, which is the case in development and between a
 * build and its first upload.
 */
async function parquetBytes(path: string): Promise<ArrayBuffer> {
  const remote = await resolveDataUrl(path)
  try {
    const response = await fetch(remote)
    if (response.ok) return response.arrayBuffer()
  } catch {
    /* fall through to the local copy */
  }
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
