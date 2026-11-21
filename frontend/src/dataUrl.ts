import { useEffect, useState } from 'react'
import { resolveDataUrl } from './dataSource'

/** The delivered URL of a data file for a link or an image; undefined until it resolves. */
export function useDataUrl(path: string): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let current = true
    resolveDataUrl(path).then(
      (resolved) => current && setUrl(resolved),
      (error: unknown) => console.error(`${path}: no delivered URL`, error),
    )
    return () => {
      current = false
    }
  }, [path])
  return url
}
