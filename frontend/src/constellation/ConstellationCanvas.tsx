/**
 * The constellation itself, on a canvas (a few hundred nodes and edges would make SVG sluggish
 * to hover). Shape and size say what a node is, so colour is never the only cue:
 *
 *   source     large star (filled, with a ring)      ingestion  small square
 *   raw        small diamond                          seed       small hollow circle
 *   bronze     small dot                              silver     dot
 *   ML         four-pointed star                      gold       bright, larger dot
 *   delivery   hollow square (a connector)            frontend   large planet with a ring
 *   shared     double ring
 *
 * Edges: lineage solid, logical relationships dashed, delivery and frontend consumption in the
 * accent, infrastructure dotted and only drawn when its node is part of the focus. Domain names
 * sit faintly behind their lanes; stage names run along the top.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { l } from '../i18n'
import type { Graph, GraphNode, Mode, NodeType, Placed } from './graph'

export const STYLE: Record<
  NodeType,
  { colour: string; r: number; name: [string, string] }
> = {
  source: { colour: '#f4ead6', r: 5.5, name: ['Source', 'Källa'] },
  ingestion: { colour: '#c9b48e', r: 3, name: ['Ingestion', 'Inläsning'] },
  raw: { colour: '#a9a093', r: 3, name: ['Raw', 'Rådata'] },
  seed: { colour: '#8d877d', r: 2.4, name: ['Seed', 'Seed'] },
  bronze: { colour: '#b88d5c', r: 2.2, name: ['Bronze', 'Brons'] },
  silver: { colour: '#c9cbd0', r: 2.6, name: ['Silver', 'Silver'] },
  ml: { colour: '#a8c0f0', r: 5, name: ['ML', 'ML'] },
  gold: { colour: '#f0c96e', r: 3.6, name: ['Gold', 'Guld'] },
  delivery: { colour: '#8fd4c4', r: 3.2, name: ['Delivery', 'Leverans'] },
  frontend: { colour: '#fff3d6', r: 8, name: ['Product', 'Produkt'] },
  shared: { colour: '#d7a7cf', r: 6, name: ['Shared', 'Gemensamt'] },
}

const STAGE_NAMES: Record<string, [string, string]> = {
  source: ['Sources', 'Källor'],
  ingestion: ['Ingestion', 'Inläsning'],
  raw: ['Raw', 'Rådata'],
  bronze: ['Bronze', 'Brons'],
  silver: ['Silver', 'Silver'],
  ml: ['ML', 'ML'],
  gold: ['Gold', 'Guld'],
  delivery: ['Delivery', 'Leverans'],
  frontend: ['Products', 'Produkter'],
}
const KIND_NAMES: [string, string][] = [
  ['Seeds', 'Seeds'],
  ['Dimensions', 'Dimensioner'],
  ['Facts & bridges', 'Fakta & bryggor'],
  ['Marts', 'Marts'],
]

const PAD_X = 28
const PAD_TOP = 34
const PAD_BOTTOM = 12
const HIT = 11

function shape(
  ctx: CanvasRenderingContext2D,
  type: NodeType,
  x: number,
  y: number,
  r: number,
  colour: string,
) {
  ctx.fillStyle = colour
  ctx.strokeStyle = colour
  ctx.lineWidth = 1
  ctx.beginPath()
  switch (type) {
    case 'ingestion':
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
      return
    case 'delivery':
      ctx.strokeRect(x - r, y - r, r * 2, r * 2)
      return
    case 'raw':
      ctx.moveTo(x, y - r * 1.3)
      ctx.lineTo(x + r * 1.3, y)
      ctx.lineTo(x, y + r * 1.3)
      ctx.lineTo(x - r * 1.3, y)
      ctx.closePath()
      ctx.fill()
      return
    case 'seed':
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.stroke()
      return
    case 'ml':
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - Math.PI / 2
        const rr = i % 2 ? r * 0.35 : r * 1.2
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      }
      ctx.closePath()
      ctx.fill()
      return
    case 'shared':
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, r * 0.5, 0, Math.PI * 2)
      ctx.stroke()
      return
    case 'source':
    case 'frontend':
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.globalAlpha *= 0.5
      ctx.arc(x, y, r + 3.5, 0, Math.PI * 2)
      ctx.stroke()
      return
    default:
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
  }
}

export default function ConstellationCanvas({
  graph,
  placed,
  mode,
  focus,
  path,
  selected,
  hiddenLayers,
  onSelect,
}: {
  graph: Graph
  placed: Map<string, Placed>
  mode: Mode
  /** Nodes kept bright by the domain filter; null means all. */
  focus: Set<string> | null
  /** The selected node's lineage; null when nothing is selected. */
  path: Set<string> | null
  selected: string | null
  hiddenLayers: Set<string>
  onSelect: (id: string | null) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<Placed | null>(null)
  const height = Math.max(520, Math.round(width * 0.62))

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const px = (n: { x: number; y: number }): [number, number] => [
    PAD_X + n.x * (width - PAD_X * 2),
    PAD_TOP + n.y * (height - PAD_TOP - PAD_BOTTOM),
  ]
  const visible = useMemo(
    () => [...placed.values()].filter((n) => !hiddenLayers.has(n.type)),
    [placed, hiddenLayers],
  )

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || !width) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    el.width = width * dpr
    el.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const lanes = [...graph.domains].sort((a, b) => a.lane - b.lane)
    const laneH = (height - PAD_TOP - PAD_BOTTOM) / lanes.length

    // Domain lanes: a faint name behind each, a hairline between them.
    ctx.textAlign = 'left'
    lanes.forEach((d, i) => {
      const y = PAD_TOP + i * laneH
      if (i > 0) {
        ctx.strokeStyle = 'rgba(241, 236, 226, 0.05)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(PAD_X, y)
        ctx.lineTo(width - PAD_X, y)
        ctx.stroke()
      }
      const dim = focus && !focus.has(`app:${d.id}`) && d.id !== 'shared'
      ctx.fillStyle = `rgba(241, 236, 226, ${dim ? 0.08 : 0.32})`
      ctx.font = '600 11px "Geist Mono", ui-monospace, monospace'
      ctx.fillText(d.label.toUpperCase(), PAD_X + 2, y + 16)
    })
    // Stage names along the top.
    const stages =
      mode === 'model'
        ? KIND_NAMES
        : graph.layers.map((s) => STAGE_NAMES[s] ?? [s, s])
    ctx.font = '500 10px "Geist Mono", ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(241, 236, 226, 0.45)'
    stages.forEach((s, i) => {
      const x = PAD_X + ((i + 0.5) / stages.length) * (width - PAD_X * 2)
      ctx.fillText(l(...s).toUpperCase(), x, 16)
    })

    const lit = (id: string) =>
      (!path || path.has(id)) && (!focus || focus.has(id))
    // Edges first, those on the selected path last and brightest.
    const shown = new Set(visible.map((n) => n.id))
    const edges = graph.edges.filter((e) => {
      if (!shown.has(e.source) || !shown.has(e.target)) return false
      if (mode === 'model') return e.type === 'relationship'
      if (e.type === 'relationship') return false
      if (e.type === 'infrastructure') return !!path && path.has(e.source)
      return true
    })
    for (const pass of [false, true]) {
      for (const e of edges) {
        const on = lit(e.source) && lit(e.target)
        if (on !== pass) continue
        const a = placed.get(e.source)!
        const b = placed.get(e.target)!
        const [x1, y1] = px(a)
        const [x2, y2] = px(b)
        const strong = !!path && on
        const accent =
          e.type === 'delivery' || e.type === 'frontend-consumption'
        const alpha = !on ? 0.025 : strong ? 0.75 : path || focus ? 0.22 : 0.09
        ctx.strokeStyle = accent
          ? `rgba(143, 212, 196, ${alpha})`
          : `rgba(241, 236, 226, ${alpha})`
        ctx.lineWidth = strong ? 1.2 : 0.7
        ctx.setLineDash(
          e.type === 'relationship'
            ? [4, 4]
            : e.type === 'infrastructure'
              ? [1, 3]
              : [],
        )
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        // A slight curve keeps parallel lines apart without hiding their direction.
        const mx = (x1 + x2) / 2
        ctx.quadraticCurveTo(mx, (y1 + y2) / 2 - (x2 - x1) * 0.06, x2, y2)
        ctx.stroke()
      }
    }
    ctx.setLineDash([])

    // Nodes, with labels for the landmarks and for everything on a selected path.
    ctx.textAlign = 'left'
    for (const n of visible) {
      const [x, y] = px(n)
      const on = lit(n.id)
      const style = STYLE[n.type]
      ctx.globalAlpha = on ? (n.enabled === false ? 0.45 : 1) : 0.12
      if (
        on &&
        (n.type === 'frontend' || n.type === 'source' || n.id === selected)
      ) {
        ctx.shadowColor = style.colour
        ctx.shadowBlur = n.id === selected ? 16 : 8
      }
      shape(
        ctx,
        n.type,
        x,
        y,
        style.r * (n.id === selected ? 1.4 : 1),
        style.colour,
      )
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      const landmark =
        n.type === 'source' ||
        n.type === 'frontend' ||
        n.type === 'shared' ||
        n.type === 'ml' ||
        (mode === 'model' && n.kind === 'fact' && !!focus)
      const label =
        n.id === selected || (on && (landmark || (!!path && path.size < 40)))
      if (label && width > 640) {
        ctx.font =
          n.type === 'frontend'
            ? '600 12px Geist, Helvetica, Arial, sans-serif'
            : '400 10.5px Geist, Helvetica, Arial, sans-serif'
        ctx.fillStyle = on
          ? 'rgba(241, 236, 226, 0.85)'
          : 'rgba(241, 236, 226, 0.2)'
        const text = n.label.length > 34 ? n.label.slice(0, 33) + '…' : n.label
        const right = x > width - 170
        ctx.textAlign = right ? 'right' : 'left'
        ctx.fillText(text, x + (right ? -1 : 1) * (style.r + 6), y + 3.5)
        ctx.textAlign = 'left'
      }
    }
  }, [graph, placed, visible, mode, focus, path, selected, width, height])

  const nearest = (e: React.MouseEvent): Placed | null => {
    const box = canvas.current!.getBoundingClientRect()
    const mx = e.clientX - box.left
    const my = e.clientY - box.top
    let best: Placed | null = null
    let dist = HIT * HIT
    for (const n of visible) {
      const [x, y] = px(n)
      const d = (x - mx) ** 2 + (y - my) ** 2
      if (d < dist) {
        dist = d
        best = n
      }
    }
    return best
  }

  return (
    <div className="constellation-frame" ref={frame}>
      <canvas
        ref={canvas}
        className="constellation-canvas"
        style={{ width, height }}
        role="img"
        aria-label={l(
          'The data platform as a map: sources on the left, products on the right, one lane per domain. The list "Architecture by domain" below holds the same graph as text.',
          'Dataplattformen som karta: källor till vänster, produkter till höger, ett band per domän. Listan "Arkitekturen per domän" nedan innehåller samma graf som text.',
        )}
        onMouseMove={(e) => setHover(nearest(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => onSelect(nearest(e)?.id ?? null)}
      />
      {hover && (
        <Tip node={hover} at={px(hover)} right={px(hover)[0] > width * 0.62} />
      )}
    </div>
  )
}

function Tip({
  node,
  at,
  right,
}: {
  node: GraphNode
  at: [number, number]
  right: boolean
}) {
  return (
    <div
      className={`constellation-tip${right ? ' is-left' : ''}`}
      style={{ left: at[0], top: at[1] }}
    >
      <strong>{node.label}</strong>
      <span>
        {l(...STYLE[node.type].name)}
        {node.kind ? ` · ${node.kind}` : ''}
        {node.enabled === false
          ? l(' · off by default', ' · avstängd som standard')
          : ''}
      </span>
      {node.path && <code>{node.path}</code>}
    </div>
  )
}
