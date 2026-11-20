import { useEffect, useState } from 'react'
import { fetchJson } from './dataSource'
import { l } from './i18n'

/** A published file: null while loading, 'error' when it cannot be read. */
type Loaded<T> = T | 'error' | null

export function useJson<T>(path: string): Loaded<T> {
  const [data, setData] = useState<Loaded<T>>(null)
  useEffect(() => {
    let live = true
    fetchJson<T>(path).then(
      (value) => {
        if (live) setData(value)
      },
      (error: Error) => {
        console.warn(error.message)
        if (live) setData('error')
      },
    )
    return () => {
      live = false
    }
  }, [path])
  return data
}

export const ok = <T,>(d: Loaded<T>): d is T => d != null && d !== 'error'

/** The value, or null while it loads or after it failed. */
export const loaded = <T,>(d: Loaded<T>): T | null => (ok(d) ? d : null)

/** One line where sections are missing because a file could not be read; nothing otherwise. */
export function LoadNote({ files }: { files: Loaded<unknown>[] }) {
  if (!files.includes('error')) return null
  return (
    <p className="theme-loading ds-container" role="status">
      {l(
        'Some data could not be loaded, so parts of this page are missing.',
        'Vissa data kunde inte läsas in, så delar av sidan saknas.',
      )}
    </p>
  )
}
