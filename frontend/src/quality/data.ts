/** Loading the quality layer's files once per session. */
import { useEffect, useState } from 'react'
import { fetchData } from '../dataSource'
import type { QualityData } from './types'

let pending: Promise<QualityData> | null = null

async function json<T>(path: string): Promise<T> {
  const r = await fetchData(path)
  if (!r.ok) throw new Error(`${path}: ${r.status}`)
  return r.json() as Promise<T>
}

export function loadQuality(): Promise<QualityData> {
  if (!pending)
    pending = Promise.all([
      json<QualityData['summary']>('quality/summary.json'),
      json<QualityData['checks']>('quality/checks.json'),
      json<QualityData['validity']>('quality/validity.json'),
    ]).then(([summary, checks, validity]) => ({ summary, checks, validity }))
  pending.catch(() => {
    pending = null
  })
  return pending
}

export function useQuality() {
  const [data, setData] = useState<QualityData | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let live = true
    loadQuality()
      .then((d) => live && setData(d))
      .catch(() => live && setError(true))
    return () => {
      live = false
    }
  }, [])
  return { data, error }
}
