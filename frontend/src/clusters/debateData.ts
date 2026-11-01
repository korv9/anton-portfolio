import { fetchJson } from '../dataSource'
import type { Xyc } from './clusterGeometry'

let map: Promise<Xyc[]> | null = null

/**
 * The 33 session maps as one [x, y, topic] list (platform/publish/clusters/debate_backdrop.py),
 * shared by the home backdrop and the gallery.
 */
export function loadDebateMap() {
  return (map ??= fetchJson<{ points: Xyc[] }>(
    'politics/parliament/backdrop.json',
  )
    .then(({ points }) => {
      if (!points.length)
        throw new Error('No published debate map is available')
      return points
    })
    .catch((error) => {
      map = null
      throw error
    }))
}
