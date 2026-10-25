/**
 * The flow's picture: the seven steps as boxes in a row, left to right on a wide screen and top
 * to bottom on a phone, each with its live count. The chosen project's path is one line in the
 * focal accent that runs along the boxes it passes through, drawing itself when the map is first
 * seen and again whenever another project is chosen; the steps it skips are dimmed. The list
 * below is the text the picture summarises.
 */
import { useEffect, useRef, useState } from 'react'
import { l } from '../i18n'

export type MapNode = {
  id: string
  short: string
  value?: string
  unit: string
  used: boolean
}

const H = { w: 1000, h: 140, box: 120, top: 8, boxH: 100, path: 126 }
const V = { w: 320, box: 64, gap: 22, inset: 18 }

function Box(props: {
  node: MapNode
  x: number
  y: number
  w: number
  h: number
  vertical: boolean
}) {
  const { node, x, y, w, h, vertical } = props
  return (
    <g className="hub-map-node" data-off={!node.used || undefined}>
      <rect x={x} y={y} width={w} height={h} rx="6" />
      <text className="hub-map-name" x={x + 14} y={y + (vertical ? 27 : 30)}>
        {node.short}
      </text>
      {node.value && (
        <text
          className="hub-map-value"
          x={vertical ? x + w - 14 : x + 14}
          y={vertical ? y + 40 : y + 68}
          textAnchor={vertical ? 'end' : 'start'}
        >
          {node.value}
        </text>
      )}
      <text className="hub-map-unit" x={x + 14} y={vertical ? y + 48 : y + 88}>
        {node.unit}
      </text>
    </g>
  )
}

export default function PlatformMap(props: {
  nodes: MapNode[]
  /** Changes when another project is chosen, so its path draws again. */
  chosen?: string
  summary: string
}) {
  const { nodes, chosen, summary } = props
  const wrap = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true)
          observer.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const gap = (H.w - nodes.length * H.box) / (nodes.length - 1)
  const vh = nodes.length * V.box + (nodes.length - 1) * V.gap
  // A stretch of the path is on while the project's data is still travelling: some step at or
  // before it is used and some step after it is, so the line runs on through a skipped step.
  const first = nodes.findIndex((n) => n.used)
  const last = nodes.map((n) => n.used).lastIndexOf(true)
  const on = (i: number) => first >= 0 && first <= i && last > i
  const title = l('The platform, step by step', 'Plattformen steg för steg')
  const hx = (i: number) => i * (H.box + gap)
  const vy = (i: number) => i * (V.box + V.gap)
  return (
    <div className="hub-map" ref={wrap} data-seen={seen || undefined}>
      <svg
        className="hub-map-h"
        viewBox={`0 0 ${H.w} ${H.h}`}
        role="img"
        aria-labelledby="hub-map-h-title hub-map-h-desc"
      >
        <title id="hub-map-h-title">{title}</title>
        <desc id="hub-map-h-desc">{summary}</desc>
        {nodes.slice(0, -1).map((node, i) => (
          <path
            key={node.id}
            className="hub-map-link"
            d={`M${(hx(i) + H.box).toFixed(1)},${H.top + H.boxH / 2}H${hx(i + 1).toFixed(1)}`}
          />
        ))}
        {nodes.map((node, i) => (
          <Box
            key={node.id}
            node={node}
            x={hx(i)}
            y={H.top}
            w={H.box}
            h={H.boxH}
            vertical={false}
          />
        ))}
        <g key={chosen}>
          {nodes
            .slice(0, -1)
            .map(
              (node, i) =>
                on(i) && (
                  <path
                    key={node.id}
                    className="hub-map-path"
                    style={{ '--i': i } as React.CSSProperties}
                    pathLength={1}
                    d={`M${hx(i).toFixed(1)},${H.path}H${(hx(i + 1) + (i + 1 === last ? H.box : 0)).toFixed(1)}`}
                  />
                ),
            )}
        </g>
      </svg>
      <svg
        className="hub-map-v"
        viewBox={`0 0 ${V.w} ${vh}`}
        role="img"
        aria-labelledby="hub-map-v-title hub-map-v-desc"
      >
        <title id="hub-map-v-title">{title}</title>
        <desc id="hub-map-v-desc">{summary}</desc>
        {nodes.slice(0, -1).map((node, i) => (
          <path
            key={node.id}
            className="hub-map-link"
            d={`M${(V.w + V.inset) / 2},${vy(i) + V.box}V${vy(i + 1)}`}
          />
        ))}
        {nodes.map((node, i) => (
          <Box
            key={node.id}
            node={node}
            x={V.inset}
            y={vy(i)}
            w={V.w - V.inset}
            h={V.box}
            vertical
          />
        ))}
        <g key={chosen}>
          {nodes
            .slice(0, -1)
            .map(
              (node, i) =>
                on(i) && (
                  <path
                    key={node.id}
                    className="hub-map-path"
                    style={{ '--i': i } as React.CSSProperties}
                    pathLength={1}
                    d={`M4,${vy(i)}V${vy(i + 1) + (i + 1 === last ? V.box : 0)}`}
                  />
                ),
            )}
        </g>
      </svg>
    </div>
  )
}
