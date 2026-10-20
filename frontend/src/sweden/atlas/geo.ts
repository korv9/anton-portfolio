/** Sweden's municipalities as three.js shapes on the atlas floor (x east, -z north). */
import * as THREE from 'three'
import type { Geometry } from '../map'

export type Muni = { code: string; shapes: THREE.Shape[]; c: [number, number] }

/** `scale` turns SWEREF99 TM (100 m units) into scene units. */
export function municipalityShapes(geo: Geometry, scale: number) {
  const all = geo.municipalities.flatMap((m) => m.rings.flat())
  const xs = all.map((p) => p[0])
  const ys = all.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const at = (p: [number, number]) =>
    [(p[0] - cx) * scale, (p[1] - cy) * scale] as const
  const toWorld = (x: number, y: number): [number, number] => [
    (x - cx) * scale,
    -(y - cy) * scale,
  ]
  const munis: Muni[] = geo.municipalities.map((m) => {
    const shapes = m.rings
      .filter((r) => r.length > 3)
      .map((r) => new THREE.Shape(r.map((p) => new THREE.Vector2(...at(p)))))
    let sx = 0
    let sy = 0
    let n = 0
    for (const r of m.rings)
      for (const p of r) {
        sx += p[0]
        sy += p[1]
        n++
      }
    return { code: m.code, shapes, c: toWorld(sx / n, sy / n) }
  })
  return { munis, toWorld }
}

/** One municipality extruded upward from `y`; rotated so the shape lies on the floor. */
export function extrude(m: Muni, depth: number, y = 0) {
  const g = new THREE.ExtrudeGeometry(m.shapes, { depth, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

/** A position on the sequential ramp, mixed in sRGB like the CSS legend. */
export const ramp = (t: number, lo = '#3a3256', hi = '#e3d8ff') =>
  new THREE.Color(lo)
    .convertLinearToSRGB()
    .lerp(new THREE.Color(hi).convertLinearToSRGB(), t)
    .convertSRGBToLinear()

/** Rank of each value among the reported ones, 0–1, so a few extremes do not flatten the rest. */
export function ranks(values: (number | null | undefined)[]) {
  const sorted = values
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)
  return (v: number) =>
    sorted.length > 1 ? sorted.indexOf(v) / (sorted.length - 1) : 1
}

/** Points on a floor from 2D coordinates, centred and scaled to the floor's radius. */
export function layout(
  points: { code: string; pc: [number, number] }[],
  y: number,
  r: number,
) {
  const xs = points.map((p) => p.pc[0])
  const ys = points.map((p) => p.pc[1])
  const half =
    Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ) / 2 || 1
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2
  const my = (Math.max(...ys) + Math.min(...ys)) / 2
  return new Map(
    points.map((p) => [
      p.code,
      new THREE.Vector3(
        ((p.pc[0] - mx) / half) * r,
        y,
        (-(p.pc[1] - my) / half) * r,
      ),
    ]),
  )
}
