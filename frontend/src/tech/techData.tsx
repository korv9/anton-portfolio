import { useEffect, useState } from 'react'
import { fetchJson } from '../dataSource'
import { l } from '../i18n'

export const REPO = 'korv9/anton-portfolio'
export const num = (n: number) => n.toLocaleString('en-GB')
export const day = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 16).replace('T', ' ') : '–'
export const size = (bytes: number) =>
  bytes > 1e6
    ? `${(bytes / 1e6).toFixed(1)} MB`
    : `${Math.round(bytes / 1e3)} kB`
/** How long ago, in the page's language; Swedish callers put "för" in front where it reads so. */
export function ago(iso: string) {
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5
  const [n, en, sv] =
    hours < 1
      ? [Math.max(1, Math.round(hours * 60)), 'min', 'min']
      : hours < 48
        ? [Math.round(hours), 'h', 'h']
        : [Math.round(hours / 24), 'days', 'dagar']
  return l(`${n} ${en} ago`, `${n} ${sv} sedan`)
}

/** Loads a published file; null while loading, 'error' when it cannot be read. */
export function useFile<T>(path: string) {
  const [data, setData] = useState<T | 'error' | null>(null)
  useEffect(() => {
    fetchJson<T>(path).then(setData, () => setData('error'))
  }, [path])
  return data
}
export const ok = <T,>(d: T | 'error' | null): d is T =>
  d != null && d !== 'error'

// A file that cannot be read leaves its part out, without an error line.
export const unread = null
// A wordless placeholder: lazy sections below the fold must not read as unfinished.
export const reading = (
  <p
    className="tech-note"
    role="status"
    aria-busy="true"
    aria-label={l('Loading', 'Laddar')}
  />
)
