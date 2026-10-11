import { projectClusterPoints } from '../clusters/clusterGeometry.ts'

export const INTRO_HOLD = 80
export const INTRO_MORPH = 180
type Point = { x: number; y: number; c: number }

/** Spatial pairing is choreography between independent maps, not a relationship between records. */
export function prepareMorphFrame(points: Point[], count: number): Point[] {
  if (!points.length) return []
  const { sx, sy } = projectClusterPoints(points, 1000, 1000, 48)
  const sorted = points
    .map((p) => ({ x: sx(p.x), y: sy(p.y), c: p.c }))
    .sort((a, b) => a.x - b.x || a.y - b.y)
  return Array.from(
    { length: count },
    (_, i) => sorted[Math.floor((i * sorted.length) / count)],
  )
}

export function morphStageAt(elapsed: number, sceneCount: number) {
  const block = INTRO_HOLD + INTRO_MORPH
  const from = Math.min(Math.floor(elapsed / block), sceneCount - 1)
  const local = elapsed - from * block
  const to = local < INTRO_HOLD ? from : Math.min(from + 1, sceneCount - 1)
  return {
    from,
    to,
    progress: to === from ? 0 : Math.min(1, (local - INTRO_HOLD) / INTRO_MORPH),
    done: from === sceneCount - 1 && local >= INTRO_HOLD,
  }
}

export function morphPosition(
  a: Point,
  b: Point,
  progress: number,
  index: number,
) {
  const t = progress * progress * (3 - 2 * progress)
  const curve = Math.sin(Math.PI * progress) * 18
  return {
    x: a.x + (b.x - a.x) * t + Math.cos(index * 0.17) * curve,
    y: a.y + (b.y - a.y) * t + Math.sin(index * 0.23) * curve,
    blend: t,
  }
}
