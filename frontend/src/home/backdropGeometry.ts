import { projectClusterPoints, type Xyc } from '../clusters/clusterGeometry.ts'

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

/**
 * The start page's side maps keep only compact, distinct clusters, so none reads as a blob: no
 * noise, no cluster holding more than `maxShare` of the points or under 0.4 % of them, the `max` tightest clusters by
 * mean distance to their centroid (relative to the map's spread), and at most `cap` points per
 * cluster, thinned by even sampling, without the members that stray from their cluster.
 */
export function compactClusters(
  points: Xyc[],
  { max = 16, maxShare = 0.12, cap = 260 } = {},
) {
  const groups = new Map<number, Xyc[]>()
  for (const p of points) {
    if (p[2] < 0) continue
    const group = groups.get(p[2]) ?? []
    group.push(p)
    groups.set(p[2], group)
  }
  const mean = (g: Xyc[], i: 0 | 1) =>
    g.reduce((s, p) => s + p[i], 0) / g.length
  const spread = (g: Xyc[]) => {
    const cx = mean(g, 0)
    const cy = mean(g, 1)
    return (
      g.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / g.length
    )
  }
  const all = [...groups.values()].flat()
  const scale = spread(all) || 1
  return (
    [...groups.values()]
      .filter(
        (g) =>
          g.length >= Math.max(8, 0.004 * points.length) &&
          g.length <= maxShare * points.length,
      )
      .map((g) => ({ g, loose: spread(g) / scale }))
      .sort((a, b) => a.loose - b.loose)
      .slice(0, max)
      // A cluster's stray members (beyond twice its mean distance) would read as noise.
      .map(({ g, loose }) => {
        const cx = mean(g, 0)
        const cy = mean(g, 1)
        const reach = 2 * loose * scale
        return g.filter((p) => Math.hypot(p[0] - cx, p[1] - cy) <= reach)
      })
      .flatMap((g) =>
        g.length <= cap
          ? g
          : Array.from(
              { length: cap },
              (_, i) => g[Math.floor((i * g.length) / cap)],
            ),
      )
  )
}
