export const CLUSTER_COLOURS = [
  '--cv-ground',
  '--cv-olive',
  '--cv-apricot',
  '--cv-powder',
  '--cv-butter',
  '--cv-pistachio',
]

/** One scale for both axes; only extreme outliers are clamped, as in Cluster Visuals. */
export function projectClusterPoints(
  points: { x: number; y: number }[],
  width: number,
  height: number,
  pad = 12,
) {
  if (!points.length) return { sx: () => width / 2, sy: () => height / 2 }
  const q = (values: number[], at: number) => {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.floor(at * sorted.length))]
  }
  const trim = points.length > 500 ? 0.005 : 0
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x0 = q(xs, trim)
  const x1 = q(xs, 1 - trim - 1e-9)
  const y0 = q(ys, trim)
  const y1 = q(ys, 1 - trim - 1e-9)
  const k = Math.min(
    (width - 2 * pad) / (x1 - x0 || 1),
    (height - 2 * pad) / (y1 - y0 || 1),
  )
  const ox = (width - k * (x1 - x0)) / 2
  const oy = (height - k * (y1 - y0)) / 2
  return {
    sx: (x: number) => ox + (Math.min(x1, Math.max(x0, x)) - x0) * k,
    sy: (y: number) => height - (oy + (Math.min(y1, Math.max(y0, y)) - y0) * k),
  }
}
