/**
 * The atlas: one dot per symbol occurrence where UMAP placed its context, coloured by HDBSCAN
 * cluster, noise faint. Points that match the filters are drawn bright on top of the rest, so a
 * symbol's spread across the map stays visible against the whole. Drawn on a canvas, since a
 * few thousand SVG circles would make hovering sluggish.
 *
 * Hover shows the symbol, book, cluster and a short excerpt; a click picks the point.
 *
 * A view can replace the cluster colouring with its own `paint` (the cross-book view mutes
 * book-bound clusters and brings reviewed ones forward) and put `labels` on the map; labels
 * are only ever the names of clusters a person has reviewed.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { l } from '../i18n'
import { TRADITION, clusterColour } from './atlasData'
import type { AtlasPoint } from './atlasTypes'

export type Paint = { fill: string; r: number; layer: number }
export type MapLabel = { x: number; y: number; text: string }

const PAD = 18
const ASPECT = 0.68
const HIT = 9

export default function AtlasCanvas({
  points,
  isLit,
  selected,
  onPick,
  onPinned,
  paint,
  labels = [],
  clusterName,
}: {
  points: AtlasPoint[]
  /** A view's own colour, size and drawing order per point; default is by cluster. */
  paint?: (p: AtlasPoint) => Paint
  /** Text placed at map coordinates (reviewed cluster names). */
  labels?: MapLabel[]
  /** How the tooltip names a cluster; default "Cluster n". */
  clusterName?: (cluster: number) => string
  /** Whether a point matches the current filters; null when nothing is filtered. */
  isLit: ((p: AtlasPoint) => boolean) | null
  selected: string | null
  onPick: (p: AtlasPoint) => void
  /** How many points lie outside the view and are pinned to its edge. */
  onPinned?: (count: number) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<{
    p: AtlasPoint
    x: number
    y: number
  } | null>(null)
  const height = Math.round(width * ASPECT)
  const toPx = useRef<(x: number, y: number) => [number, number]>(() => [0, 0])

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Map coordinates to pixels once per size. The window spans the 0.2–99.8 percentiles, so a
  // stray point far from the rest does not shrink the map; points outside it keep their data
  // and are drawn as rings pinned to the edge.
  const placed = useMemo(() => {
    if (!width || !points.length) return []
    const xs = points.map((p) => p.x).sort((a, b) => a - b)
    const ys = points.map((p) => p.y).sort((a, b) => a - b)
    const q = (v: number[], f: number) => v[Math.round(f * (v.length - 1))]
    const [x0, x1] = [q(xs, 0.002), q(xs, 0.998)]
    const [y0, y1] = [q(ys, 0.002), q(ys, 0.998)]
    const scale = Math.min(
      (width - PAD * 2) / (x1 - x0 || 1),
      (height - PAD * 2) / (y1 - y0 || 1),
    )
    const ox = (width - (x1 - x0) * scale) / 2
    const oy = (height - (y1 - y0) * scale) / 2
    const clamp = (v: number, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, v))
    toPx.current = (x: number, y: number) => [
      ox + (x - x0) * scale,
      oy + (y1 - y) * scale,
    ]
    return points.map((p) => {
      const px = ox + (p.x - x0) * scale
      const py = oy + (y1 - p.y) * scale
      const cx = clamp(px, 4, width - 4)
      const cy = clamp(py, 4, height - 4)
      return { p, px: cx, py: cy, pinned: cx !== px || cy !== py }
    })
  }, [points, width, height])

  useEffect(() => {
    onPinned?.(placed.filter((d) => d.pinned).length)
  }, [placed])

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || !width) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    el.width = width * dpr
    el.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const lit = placed.filter((d) => !isLit || isLit(d.p))
    const dim = isLit ? placed.filter((d) => !isLit(d.p)) : []
    for (const d of dim) {
      ctx.fillStyle = paint
        ? 'rgba(150, 146, 140, 0.1)'
        : clusterColour(d.p.cluster_id, 0.12)
      ctx.beginPath()
      ctx.arc(d.px, d.py, 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
    const styled = lit.map((d) => {
      if (paint) return { d, ...paint(d.p) }
      const r = d.p.is_noise ? 1.7 : 1.9 + d.p.cluster_probability * 1.4
      const fill = clusterColour(
        d.p.cluster_id,
        d.p.is_noise ? 0.7 : 0.55 + 0.4 * d.p.cluster_probability,
      )
      return { d, fill, r, layer: d.p.is_noise ? 0 : 1 }
    })
    // Muted layers first, so the clusters a view brings forward are drawn on top.
    styled.sort((a, b) => a.layer - b.layer)
    for (const { d, fill, r } of styled) {
      ctx.beginPath()
      ctx.arc(d.px, d.py, d.pinned ? 3 : r, 0, Math.PI * 2)
      if (d.pinned) {
        ctx.strokeStyle = fill
        ctx.lineWidth = 1.2
        ctx.stroke()
      } else {
        ctx.fillStyle = fill
        ctx.fill()
      }
    }
    ctx.font = '600 12px Manrope, Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    for (const label of labels) {
      const [lx, ly] = toPx.current(label.x, label.y)
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(7, 7, 8, 0.85)'
      ctx.strokeText(label.text, lx, ly - 8)
      ctx.fillStyle = '#f1ece2'
      ctx.fillText(label.text, lx, ly - 8)
    }
    const sel = placed.find((d) => d.p.occurrence_id === selected)
    if (sel) {
      ctx.strokeStyle = '#f1ece2'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(sel.px, sel.py, 7, 0, Math.PI * 2)
      ctx.stroke()
    }
  }, [placed, isLit, selected, width, height, paint, labels])

  const nearest = (x: number, y: number) => {
    let best: (typeof placed)[number] | null = null
    let dist = HIT * HIT
    for (const d of placed) {
      if (isLit && !isLit(d.p)) continue
      const dd = (d.px - x) ** 2 + (d.py - y) ** 2
      if (dd < dist) {
        dist = dd
        best = d
      }
    }
    return best
  }
  const at = (e: React.MouseEvent) => {
    const box = canvas.current!.getBoundingClientRect()
    return nearest(e.clientX - box.left, e.clientY - box.top)
  }

  return (
    <div className="atlas-frame" ref={frame}>
      <canvas
        ref={canvas}
        className="atlas-canvas"
        style={{ width, height }}
        role="img"
        aria-label={l(
          `${points.length} symbol occurrences placed by the similarity of their contexts, coloured by cluster. The filters beside the map list the symbols, books and clusters as text.`,
          `${points.length} symbolförekomster placerade efter hur lika deras sammanhang är, färgade efter kluster. Filtren bredvid kartan listar symboler, böcker och kluster som text.`,
        )}
        onMouseMove={(e) => {
          const d = at(e)
          setHover(d ? { p: d.p, x: d.px, y: d.py } : null)
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const d = at(e)
          if (d) onPick(d.p)
        }}
      />
      {hover && (
        <div
          className={`atlas-tip${hover.x > width * 0.6 ? ' is-left' : ''}`}
          style={{ left: hover.x, top: hover.y }}
        >
          <strong>{hover.p.matched_term}</strong>
          <span>
            {hover.p.title.split(':')[0]} ·{' '}
            {TRADITION[hover.p.tradition]
              ? l(...TRADITION[hover.p.tradition])
              : hover.p.tradition}
          </span>
          <span>
            {hover.p.is_noise
              ? l('Noise (no cluster)', 'Brus (inget kluster)')
              : clusterName
                ? clusterName(hover.p.cluster_id)
                : l(
                    `Cluster ${hover.p.cluster_id}`,
                    `Kluster ${hover.p.cluster_id}`,
                  )}
          </span>
          <em>
            {hover.p.context.length > 150
              ? hover.p.context.slice(0, 149) + '…'
              : hover.p.context}
          </em>
        </div>
      )}
    </div>
  )
}
