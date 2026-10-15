/**
 * One cluster map: every point drawn on a canvas that fills its width, coloured by its cluster,
 * noise faint. Pointing at a point names it; clicking a point, or a cluster in the list under the
 * map, picks that cluster and steps the others back. The list is the keyboard way in. A marker,
 * such as a visitor's sentence, glides to its place (at once under reduced motion).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { l } from '../i18n'
import {
  CLUSTER_COLOURS as COLOURS,
  projectClusterPoints,
} from './clusterGeometry'

export type ClusterPoint = {
  x: number
  y: number
  /** The cluster; below zero is noise. */
  c: number
  /** What the point is, shown on hover. */
  label?: string
}

const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))

export default function ClusterScatter({
  points,
  name,
  label,
  height = 780,
  marker,
}: {
  points: ClusterPoint[]
  /** A cluster's name for the tooltip and the list. */
  name?: (cluster: number) => string
  /** The accessible name of the map. */
  label: string
  height?: number
  /** One extra point drawn on top, named in the map's label. */
  marker?: { x: number; y: number; label: string }
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
  const [glide, setGlide] = useState<[number, number] | null>(null)
  const { sx, sy, sizes } = useMemo(() => {
    const projection = projectClusterPoints(points, width, h, pad)
    const counts = new Map<number, number>()
    for (const p of points) counts.set(p.c, (counts.get(p.c) ?? 0) + 1)
    return {
      ...projection,
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
    const noise = css.getPropertyValue('--cv-oat').trim()
    const draw = (p: ClusterPoint, alpha: number) => {
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.c < 0 ? noise : colours[p.c % colours.length]
      ctx.beginPath()
      ctx.arc(sx(p.x), sy(p.y), radius, 0, Math.PI * 2)
      ctx.fill()
    }
    // Noise first and faint, then the clusters; a picked cluster last and in full.
    for (const p of points) if (p.c < 0) draw(p, picked == null ? 0.7 : 0.35)
    for (const p of points)
      if (p.c >= 0 && p.c !== picked) draw(p, picked == null ? 0.85 : 0.18)
    if (picked != null) for (const p of points) if (p.c === picked) draw(p, 1)
    ctx.globalAlpha = 1
  }, [points, width, h, picked, sx, sy, radius])

  // The marker starts where it was, or in the middle, and moves to its place on the next frames.
  useEffect(() => {
    if (!marker) return setGlide(null)
    const to: [number, number] = [sx(marker.x), sy(marker.y)]
    setGlide((was) => was ?? [width / 2, h / 2])
    let frame = requestAnimationFrame(
      () => (frame = requestAnimationFrame(() => setGlide(to))),
    )
    return () => cancelAnimationFrame(frame)
  }, [marker, sx, sy, width, h])

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
        aria-label={`${label}: ${num(points.length)} ${l('points', 'punkter')}, ${sizes.length} ${l('clusters', 'kluster')}${marker ? `. ${marker.label}` : ''}`}
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
      {glide && marker && (
        <span
          className={`cv-marker${glide[0] > width - 220 ? ' cv-marker-left' : ''}`}
          style={{ transform: `translate(${glide[0]}px, ${glide[1]}px)` }}
          aria-hidden="true"
        >
          <i />
          <b>{marker.label}</b>
        </span>
      )}
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
