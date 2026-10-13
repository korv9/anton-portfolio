import { fetchJson } from '../welfare/data'

export type UmapScene = {
  id: string
  en: string
  sv: string
  points: { x: number; y: number; c: number }[]
}

let symbolicPreview: Promise<UmapScene> | null = null
let symbolicDetail: Promise<UmapScene['points']> | null = null
let jobPreview: Promise<UmapScene> | null = null
let jobDetail: Promise<UmapScene['points']> | null = null

export function loadJobDetail() {
  return (jobDetail ??= fetchJson<{ points: [number, number, number][] }>(
    'jobs/preview-detail.json',
  )
    .then(({ points }) => points.map(([x, y, c]) => ({ x, y, c })))
    .catch((error) => {
      jobDetail = null
      throw error
    }))
}

export function loadJobPreview(): Promise<UmapScene> {
  return (jobPreview ??= fetchJson<{
    points: { x: number; y: number; cluster: number }[]
  }>('jobs/cluster-preview.json')
    .then(({ points }) => ({
      id: 'jobs',
      en: 'Job Market',
      sv: 'Arbetsmarknaden',
      points: points.map(({ x, y, cluster }) => ({ x, y, c: cluster })),
    }))
    .catch((error) => {
      jobPreview = null
      throw error
    }))
}

export function loadSymbolicDetail() {
  return (symbolicDetail ??= fetchJson<{ points: [number, number, number][] }>(
    'symbolic/preview-detail.json',
  )
    .then(({ points }) => points.map(([x, y, c]) => ({ x, y, c })))
    .catch((error) => {
      symbolicDetail = null
      throw error
    }))
}

export function loadSymbolicPreview(): Promise<UmapScene> {
  return (symbolicPreview ??= fetchJson<{ points: [number, number, number][] }>(
    'symbolic/preview.json',
  )
    .then(({ points }) => ({
      id: 'symbolic',
      en: 'Symbolic Atlas',
      sv: 'Symbolic Atlas',
      points: points.map(([x, y, c]) => ({ x, y, c })),
    }))
    .catch((error) => {
      symbolicPreview = null
      throw error
    }))
}
