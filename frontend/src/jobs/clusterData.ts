import { useEffect, useState } from 'react'
import { fetchData } from '../dataSource'

export const ROLES = [
  'Data Engineer',
  'Analytics Engineer',
  'Data Scientist',
  'Software Developer',
]
export type MapPoint = { id: string; x: number; y: number; cluster: number }
export type JobPoint = MapPoint & {
  role: string
  year: number
  title: string
}
export type Distribution = { label: string; count: number; share: number }
export type Cluster = {
  cluster_id: number
  cluster_label: string
  job_count: number
  dataset_share: number
  junior_share: number
  senior_share: number
  unspecified_share: number
  mean_probability: number
  skill_observation_share?: number
  top_skills: { skill: string; count: number; lift: number }[]
  top_titles: Distribution[]
  role_distribution: Distribution[]
  representative_ads: { id: string; title: string }[]
  top_employers?: Distribution[]
  years?: Distribution[]
  label_uncertainty: string
}
export type Summary = {
  schema_version: number
  run_id: string
  generated_at: string
  source_size: number
  sampled: boolean
  source_kinds: string[]
  coverage?: { month: string; status: string; url: string; sha256: string }[]
  unique_text_count?: number
  parameter_sweep?: {
    candidate_count: number
    diagnostic_sample_size: number
    seed_stability: {
      seed: number
      ari_common_assigned: number | null
      common_assigned_share: number
      cluster_count: number
      noise_share: number
    }[]
  } | null
  config: { model: string; dimensions?: number; assignment_method?: string }
  feature_ensemble?: {
    recipe: string
    weights: Record<string, number>
    assignment_method: string
    candidate_count?: number
    consensus_window_stability?: {
      seeds: number[]
      ari_all_including_noise: number
      ari_common_assigned: number | null
      common_assigned_share: number
    }[]
  } | null
  shards: string[]
  clusters: Cluster[]
  diagnostics: {
    dataset_size: number
    cluster_count: number
    noise_share: number
    trustworthiness: number
    feature_trustworthiness?: number
    silhouette: number | null
    embedding_silhouette?: number | null
    feature_silhouette?: number | null
    mean_cluster_probability: number | null
    trustworthiness_sample_size: number
    limitations: string
  }
}

export function projectCoordinates(
  points: MapPoint[],
  width: number,
  height: number,
  fitPoints: MapPoint[] = points,
) {
  if (!points.length) return new Map<string, [number, number]>()
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity
  for (const p of fitPoints.length ? fitPoints : points) {
    x0 = Math.min(x0, p.x)
    x1 = Math.max(x1, p.x)
    y0 = Math.min(y0, p.y)
    y1 = Math.max(y1, p.y)
  }
  const scale = Math.min(
    (width - 40) / (x1 - x0 || 1),
    (height - 40) / (y1 - y0 || 1),
  )
  return new Map(
    points.map((p) => [
      p.id,
      [
        width / 2 + (p.x - (x0 + x1) / 2) * scale,
        height / 2 - (p.y - (y0 + y1) / 2) * scale,
      ],
    ]),
  )
}
export async function jsonData<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetchData(path, { signal })
  if (!response.ok) throw new Error(`Analysis unavailable (${response.status})`)
  const text = await response.text()
  if (text.trimStart().startsWith('<'))
    throw new Error('Analysis has not been published')
  return JSON.parse(text) as T
}
let preview: Promise<{
  run_id: string
  sampled: boolean
  points: MapPoint[]
}> | null = null
export function useClusterPreview() {
  const [points, setPoints] = useState<MapPoint[]>([])
  useEffect(() => {
    let active = true
    preview ??= jsonData<{
      run_id: string
      sampled: boolean
      points: MapPoint[]
    }>('jobs/cluster-preview.json')
    preview
      .then((data) => {
        if (active) setPoints(data.points)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return points
}
