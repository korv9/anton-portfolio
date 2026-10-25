import { projectClusterPoints } from '../clusters/clusterGeometry.ts'

type Point = { x: number; y: number; c: number }

/** Warm greys on charcoal, one per `cluster % 6`, for the home maps (debate and jobs). */
export const WARM_TONES = [
  '#e8e0d0',
  '#cfc5b2',
  '#b3a896',
  '#998f7e',
  '#817869',
  '#6a6256',
]

/** Keep the complete UMAP topology; crop each canvas to its cluster to limit GPU memory. */
export function groupBackdropPoints(points: Point[]) {
  const { sx, sy } = projectClusterPoints(points, 1000, 1000, 48)
  const groups = new Map<number, { x: number; y: number }[]>()
  for (const p of points) {
    const group = groups.get(p.c) ?? []
    group.push({ x: sx(p.x), y: sy(p.y) })
    groups.set(p.c, group)
  }
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([cluster, points]) => {
      let left = Infinity
      let right = -Infinity
      let top = Infinity
      let bottom = -Infinity
      for (const p of points) {
        left = Math.min(left, p.x)
        right = Math.max(right, p.x)
        top = Math.min(top, p.y)
        bottom = Math.max(bottom, p.y)
      }
      return {
        cluster,
        points,
        left: left - 3,
        top: top - 3,
        width: right - left + 6,
        height: bottom - top + 6,
      }
    })
}
