/**
 * One cluster map: every point drawn on a canvas that fills its width, coloured by its cluster,
 * noise faint. Pointing at a point names it; clicking a point, or a cluster in the list under the
 * map, picks that cluster and steps the others back. The list is the keyboard way in.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { l } from '../i18n'

export type ClusterPoint = {
  x: number
  y: number
  /** The cluster; below zero is noise. */
  c: number
  /** What the point is, shown on hover. */
  label?: string
}

const COLOURS = [
  '--cv-butter',
  '--cv-pistachio',
  '--cv-powder',
  '--cv-apricot',
  '--cv-oat',
  '--cv-ivory',
]

const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))

export default function ClusterScatter({
  points,
  name,
  label,
  height = 780,
}: {
  points: ClusterPoint[]
  /** A cluster's name for the tooltip and the list. */
  name?: (cluster: number) => string
  /** The accessible name of the map. */
  label: string
  height?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(900)
  const [picked, setPicked] = useState<number | null>(null)
  const [hover, setHover] = useState<{
    p: ClusterPoint
    x: number
    y: number
  } | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, Math.round(entry.contentRect.width))),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const h = Math.min(height, Math.round(width * 0.62))
  const pad = 12
  const { sx, sy, sizes } = useMemo(() => {
    // The scale spans the middle 99 % of the points, so a few far outliers do not shrink the
    // map; those outliers are drawn at its edge.
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
    // One scale for both axes, so distances mean the same across and up.
    const k = Math.min(
      (width - 2 * pad) / (x1 - x0 || 1),
      (h - 2 * pad) / (y1 - y0 || 1),
    )
    const ox = (width - k * (x1 - x0)) / 2
    const oy = (h - k * (y1 - y0)) / 2
    const counts = new Map<number, number>()
    for (const p of points) counts.set(p.c, (counts.get(p.c) ?? 0) + 1)
    const clampX = (x: number) => Math.min(x1, Math.max(x0, x))
    const clampY = (y: number) => Math.min(y1, Math.max(y0, y))
    return {
      sx: (x: number) => ox + (clampX(x) - x0) * k,
      sy: (y: number) => h - (oy + (clampY(y) - y0) * k),
      sizes: [...counts].filter(([c]) => c >= 0).sort((a, b) => b[1] - a[1]),
    }
  }, [points, width, h])

  const radius =
    points.length > 20000
      ? 1.1
      : points.length > 5000
        ? 1.5
        : points.length > 1000
          ? 2.4
          : 4

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const dpr = window.devicePixelRatio || 1
    el.width = width * dpr
    el.height = h * dpr
    const ctx = el.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, h)
    const css = getComputedStyle(el)
    const colours = COLOURS.map((v) => css.getPropertyValue(v).trim())
    const noise = css.getPropertyValue('--cv-olive').trim()
    const draw = (p: ClusterPoint, alpha: number) => {
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.c < 0 ? noise : colours[p.c % colours.length]
      ctx.beginPath()
      ctx.arc(sx(p.x), sy(p.y), radius, 0, Math.PI * 2)
      ctx.fill()
    }
    // Noise first and faint, then the clusters; a picked cluster last and in full.
    for (const p of points) if (p.c < 0) draw(p, picked == null ? 0.45 : 0.2)
    for (const p of points)
      if (p.c >= 0 && p.c !== picked) draw(p, picked == null ? 0.85 : 0.18)
    if (picked != null) for (const p of points) if (p.c === picked) draw(p, 1)
    ctx.globalAlpha = 1
  }, [points, width, h, picked, sx, sy, radius])

  // A coarse grid of the points so the nearest one is found without scanning them all.
  const grid = useMemo(() => {
    const cell = 16
    const cells = new Map<string, ClusterPoint[]>()
    for (const p of points) {
      const key = `${Math.floor(sx(p.x) / cell)},${Math.floor(sy(p.y) / cell)}`
      const list = cells.get(key)
      if (list) list.push(p)
      else cells.set(key, [p])
    }
    return { cell, cells }
  }, [points, sx, sy])

  const nearest = (mx: number, my: number) => {
    const cx = Math.floor(mx / grid.cell)
    const cy = Math.floor(my / grid.cell)
    let best: ClusterPoint | null = null
    let bestD = 12 * 12
    for (let i = cx - 1; i <= cx + 1; i++)
      for (let j = cy - 1; j <= cy + 1; j++)
        for (const p of grid.cells.get(`${i},${j}`) ?? []) {
          const d = (sx(p.x) - mx) ** 2 + (sy(p.y) - my) ** 2
          if (d < bestD) {
            bestD = d
            best = p
          }
        }
    return best
  }

  const at = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = canvas.current!.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top] as const
  }
  const clusterName = (c: number) =>
    c < 0
      ? l('No cluster', 'Inget kluster')
      : (name?.(c) ?? `${l('Cluster', 'Kluster')} ${c}`)

  return (
    <div className="cv-map" ref={box}>
      <canvas
        ref={canvas}
        style={{ width: '100%', height: h }}
        role="img"
        aria-label={`${label}: ${num(points.length)} ${l('points', 'punkter')}, ${sizes.length} ${l('clusters', 'kluster')}`}
        onPointerMove={(e) => {
          const [x, y] = at(e)
          const p = nearest(x, y)
          setHover(p ? { p, x: sx(p.x), y: sy(p.y) } : null)
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const [x, y] = at(e)
          const p = nearest(x, y)
          setPicked(p && p.c >= 0 && p.c !== picked ? p.c : null)
        }}
      />
      {hover && (
        <div
          className="cv-tip"
          style={{
            left: Math.min(hover.x + 12, width - 260),
            top: Math.max(hover.y - 12, 0),
          }}
        >
          <b>{clusterName(hover.p.c)}</b>
          {hover.p.label && <span>{hover.p.label}</span>}
        </div>
      )}
      <ul className="cv-legend" aria-label={l('Clusters', 'Kluster')}>
        {sizes.slice(0, 12).map(([c, count]) => (
          <li key={c}>
            <button
              type="button"
              aria-pressed={picked === c}
              onClick={() => setPicked(picked === c ? null : c)}
            >
              <i
                style={{ background: `var(${COLOURS[c % COLOURS.length]})` }}
                aria-hidden="true"
              />
              {clusterName(c)} <small>{num(count)}</small>
            </button>
          </li>
        ))}
        {sizes.length > 12 && (
          <li className="cv-more">
            {l(`+ ${sizes.length - 12} more`, `+ ${sizes.length - 12} till`)}
          </li>
        )}
      </ul>
    </div>
  )
}
