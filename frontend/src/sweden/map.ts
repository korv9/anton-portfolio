/**
 * The one Sweden map every geographic SWEDEN product shares: SCB's municipality boundaries in
 * SWEREF99 TM (100 m units, sweden/similarity/geometry.json), drawn into a 1000 × 1000 SVG
 * with the country on the right half so the scene's title panel keeps the left. A projected
 * grid needs no map projection; every layer (polygons, dots, points) uses `project`.
 */
import { useEffect, useMemo, useState } from 'react'

export type Geometry = {
  municipalities: { code: string; rings: [number, number][][] }[]
}
export const MAP_SIZE = 1000

export function useMapLayout(geo: Geometry | null) {
  return useMemo(() => {
    if (!geo) return null
    const all = geo.municipalities.flatMap((m) => m.rings.flat())
    const xs = all.map((p) => p[0])
    const ys = all.map((p) => p[1])
    const [x0, y0, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...ys)]
    const x1 = Math.max(...xs)
    const scale = Math.min(
      (MAP_SIZE * 0.5) / (x1 - x0),
      (MAP_SIZE * 0.94) / (y1 - y0),
    )
    const project = (x: number, y: number): [number, number] => [
      MAP_SIZE * 0.47 + (x - x0) * scale,
      MAP_SIZE * 0.03 + (y1 - y) * scale,
    ]
    const paths = new Map(
      geo.municipalities.map((m) => [
        m.code,
        m.rings
          .map(
            (r) =>
              'M' +
              r
                .map(([x, y]) =>
                  project(x, y)
                    .map((v) => v.toFixed(1))
                    .join(','),
                )
                .join('L') +
              'Z',
          )
          .join(''),
      ]),
    )
    // The mean of the outer ring's vertices: good enough to place a dot.
    const centroid = new Map(
      geo.municipalities.map((m) => {
        const pts = m.rings[0]
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
        return [m.code, project(cx, cy)]
      }),
    )
    return { paths, centroid, project }
  }, [geo])
}

/** On a phone the panels stack above the map, so the view is cropped to the country. */
export function useMapViewBox() {
  const query = '(max-width: 760px)'
  const [narrow, setNarrow] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia(query).matches,
  )
  useEffect(() => {
    const m = matchMedia(query)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow ? `410 0 580 ${MAP_SIZE}` : `0 0 ${MAP_SIZE} ${MAP_SIZE}`
}
