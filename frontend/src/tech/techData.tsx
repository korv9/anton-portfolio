import { useEffect, useState } from 'react'
import { fetchJson } from '../dataSource'

export const REPO = 'korv9/anton-portfolio'
export const num = (n: number) => n.toLocaleString('en-GB')
export const day = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 16).replace('T', ' ') : '–'
export const size = (bytes: number) =>
  bytes > 1e6
    ? `${(bytes / 1e6).toFixed(1)} MB`
    : `${Math.round(bytes / 1e3)} kB`
export function ago(iso: string) {
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min ago`
  if (hours < 48) return `${Math.round(hours)} h ago`
  return `${Math.round(hours / 24)} days ago`
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

export const unread = <p className="tech-note">This file could not be read.</p>
export const reading = <p className="tech-note">Loading…</p>
