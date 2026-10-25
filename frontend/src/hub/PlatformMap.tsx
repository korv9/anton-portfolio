/**
 * The flow's picture: the seven steps as boxes joined in a line, left to right on a wide screen
 * and top to bottom on a phone, each with its live count. The chosen project's path is drawn in
 * the focal accent, and it draws itself when the map first comes into view and again whenever
 * another project is chosen. The list below is the text the picture summarises.
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

const H = { w: 1000, h: 132, box: 120, top: 16, boxH: 100 }
const V = { w: 320, box: 64, gap: 22 }

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
    <g className="hub-map-node" data-on={node.used || undefined}>
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
  const on = (i: number) => nodes[i].used && nodes[i + 1]?.used
  const title = l('The platform, step by step', 'Plattformen steg för steg')
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
        <g key={chosen}>
          {nodes.slice(0, -1).map((node, i) => {
            const x1 = i * (H.box + gap) + H.box
            return (
              <path
                key={node.id}
                className="hub-map-line"
                data-on={on(i) || undefined}
                style={{ '--i': i } as React.CSSProperties}
                pathLength={1}
                d={`M${x1.toFixed(1)},${H.top + H.boxH / 2}H${(x1 + gap).toFixed(1)}`}
              />
            )
          })}
        </g>
        {nodes.map((node, i) => (
          <Box
            key={node.id}
            node={node}
            x={i * (H.box + gap)}
            y={H.top}
            w={H.box}
            h={H.boxH}
            vertical={false}
          />
        ))}
      </svg>
      <svg
        className="hub-map-v"
        viewBox={`0 0 ${V.w} ${vh}`}
        role="img"
        aria-labelledby="hub-map-v-title hub-map-v-desc"
      >
        <title id="hub-map-v-title">{title}</title>
        <desc id="hub-map-v-desc">{summary}</desc>
        <g key={chosen}>
          {nodes.slice(0, -1).map((node, i) => {
            const y1 = i * (V.box + V.gap) + V.box
            return (
              <path
                key={node.id}
                className="hub-map-line"
                data-on={on(i) || undefined}
                style={{ '--i': i } as React.CSSProperties}
                pathLength={1}
                d={`M${V.w / 2},${y1}V${y1 + V.gap}`}
              />
            )
          })}
        </g>
        {nodes.map((node, i) => (
          <Box
            key={node.id}
            node={node}
            x={0}
            y={i * (V.box + V.gap)}
            w={V.w}
            h={V.box}
            vertical
          />
        ))}
      </svg>
    </div>
  )
}
