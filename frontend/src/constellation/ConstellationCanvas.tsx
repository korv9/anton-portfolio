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
/** Below this width the map stands upright: stages run top to bottom, domains become columns. */
export const UPRIGHT_BELOW = 700
const PAD_SIDE_UPRIGHT = 30
const PAD_TOP_UPRIGHT = 30
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
  const upright = width > 0 && width < UPRIGHT_BELOW
  // Upright, the map fills about a screen: tall enough for nine stages to breathe.
  const height = upright
    ? Math.max(
        640,
        Math.round(Math.min(window.innerHeight * 1.15, width * 2.1)),
      )
    : Math.max(520, Math.round(width * 0.62))

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Upright, the layout's axes swap: its x (stage) runs down the screen, its y (domain) across.
  const px = (n: { x: number; y: number }): [number, number] =>
    upright
      ? [
          PAD_SIDE_UPRIGHT + n.y * (width - PAD_SIDE_UPRIGHT - 8),
          PAD_TOP_UPRIGHT + n.x * (height - PAD_TOP_UPRIGHT - PAD_BOTTOM),
        ]
      : [
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
    const stages =
      mode === 'model'
        ? KIND_NAMES
        : graph.layers.map((s) => STAGE_NAMES[s] ?? [s, s])

    if (upright) {
      // Domain columns with their names on top; stage names up the left edge.
      const laneW = (width - PAD_SIDE_UPRIGHT - 8) / lanes.length
      ctx.textAlign = 'center'
      ctx.font = '600 9px "Geist Mono", ui-monospace, monospace'
      lanes.forEach((d, i) => {
        const x = PAD_SIDE_UPRIGHT + i * laneW
        if (i > 0) {
          ctx.strokeStyle = 'rgba(241, 236, 226, 0.06)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x, PAD_TOP_UPRIGHT - 6)
          ctx.lineTo(x, height - PAD_BOTTOM)
          ctx.stroke()
        }
        const dim = focus && !focus.has(`app:${d.id}`) && d.id !== 'shared'
        ctx.fillStyle = `rgba(241, 236, 226, ${dim ? 0.12 : 0.55})`
        const words = d.label.toUpperCase().split(' ')
        words
          .slice(0, 2)
          .forEach((w, j) => ctx.fillText(w, x + laneW / 2, 11 + j * 10))
      })
      ctx.save()
      ctx.font = '500 9px "Geist Mono", ui-monospace, monospace'
      ctx.fillStyle = 'rgba(241, 236, 226, 0.62)'
      stages.forEach((s, i) => {
        const y =
          PAD_TOP_UPRIGHT +
          ((i + 0.5) / stages.length) * (height - PAD_TOP_UPRIGHT - PAD_BOTTOM)
        ctx.save()
        ctx.translate(11, y)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(l(...s).toUpperCase(), 0, 0)
        ctx.restore()
        if (i > 0) {
          const line =
            PAD_TOP_UPRIGHT +
            (i / stages.length) * (height - PAD_TOP_UPRIGHT - PAD_BOTTOM)
          ctx.strokeStyle = 'rgba(241, 236, 226, 0.03)'
          ctx.beginPath()
          ctx.moveTo(PAD_SIDE_UPRIGHT, line)
          ctx.lineTo(width - 8, line)
          ctx.stroke()
        }
      })
      ctx.restore()
    }

    // Domain lanes: a faint name behind each, a hairline between them.
    ctx.textAlign = 'left'
    if (!upright)
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
    if (!upright) {
      ctx.font = '500 10px "Geist Mono", ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(241, 236, 226, 0.45)'
      stages.forEach((s, i) => {
        const x = PAD_X + ((i + 0.5) / stages.length) * (width - PAD_X * 2)
        ctx.fillText(l(...s).toUpperCase(), x, 16)
      })
    }

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
        const my = (y1 + y2) / 2
        if (upright) ctx.quadraticCurveTo(mx - (y2 - y1) * 0.06, my, x2, y2)
        else ctx.quadraticCurveTo(mx, my - (x2 - x1) * 0.06, x2, y2)
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
      // On a selected path, label the models and stages, and the files only on short paths.
      // Upright, columns are narrow: only products, the selection and short paths get names.
      const pathLabel =
        !!path &&
        path.size < (upright ? 16 : 40) &&
        n.type !== 'seed' &&
        (n.type !== 'delivery' || path.size <= 12)
      const label =
        n.id === selected ||
        (on && ((upright ? n.type === 'frontend' : landmark) || pathLabel))
      if (label) {
        ctx.font =
          n.type === 'frontend'
            ? `600 ${upright ? 10.5 : 12}px Geist, Helvetica, Arial, sans-serif`
            : `400 ${upright ? 9.5 : 10.5}px Geist, Helvetica, Arial, sans-serif`
        ctx.fillStyle = on
          ? 'rgba(241, 236, 226, 0.85)'
          : 'rgba(241, 236, 226, 0.2)'
        const max = upright ? 22 : 34
        const text =
          n.label.length > max ? n.label.slice(0, max - 1) + '…' : n.label
        if (upright && n.type === 'frontend') {
          // Products sit side by side at the bottom: name centred above, at most two lines.
          const words = n.label.split(' ')
          const lines: string[] = []
          const limit = Math.max(8, Math.floor(width / lanes.length / 6))
          for (const w of words) {
            const last = lines[lines.length - 1]
            if (last && (last + ' ' + w).length <= limit)
              lines[lines.length - 1] = `${last} ${w}`
            else lines.push(w)
          }
          const shown2 = lines.slice(0, 2)
          if (lines.length > 2) shown2[1] += '…'
          ctx.textAlign = 'center'
          shown2.forEach((line, j) =>
            ctx.fillText(
              line,
              x,
              y - style.r - 8 - (shown2.length - 1 - j) * 12,
            ),
          )
          ctx.textAlign = 'left'
        } else {
          const right = x > width - (upright ? width / 2 : 170)
          ctx.textAlign = right ? 'right' : 'left'
          ctx.fillText(text, x + (right ? -1 : 1) * (style.r + 6), y + 3.5)
          ctx.textAlign = 'left'
        }
      }
    }
  }, [
    graph,
    placed,
    visible,
    mode,
    focus,
    path,
    selected,
    width,
    height,
    upright,
  ])

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
