/** The platform itself: quality checks, the architecture graph and the gold model. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Kpi, Legend, Svg, fmt, palette, sum, uniq } from './txt-kit'

type Check = {
  product_id: string
  dimension: string
  status: string
  quality_check_id: string
}
type Graph = {
  nodes: { id: string; type: string }[]
  edges: { source: string; target: string; type: string }[]
  domains: { id: string; label: string; counts: Record<string, number> }[]
}
type Gold = { parliament: Record<string, number | string> }
const SCALES = ['count', 'share'] as const
const d = 'platform'

function QualityWaffle() {
  const data = useData<Check[]>('quality/checks.json')
  const [product, setProduct] = useState('all')
  return (
    <Frame data={data}>
      {(rows) => {
        const statuses = palette(uniq(rows.map((c) => c.status)))
        const dims = uniq(rows.map((c) => c.dimension))
        const sel = rows
          .filter((c) => product === 'all' || c.product_id === product)
          .sort((a, b) => dims.indexOf(a.dimension) - dims.indexOf(b.dimension))
        const n = 7
        const s = 300 / n
        return (
          <>
            <Slicer
              label="Product"
              cycles={false}
              options={['all', ...uniq(rows.map((c) => c.product_id))]}
              value={product}
              onChange={setProduct}
            />
            <Svg
              w={300}
              h={300}
              label="Every quality check as a tile, coloured by status"
            >
              {sel.map((c, i) => (
                <circle
                  key={c.quality_check_id}
                  cx={(i % n) * s + s / 2}
                  cy={Math.floor(i / n) * s + s / 2}
                  r={s * 0.42}
                  fill={statuses.get(c.status)}
                  stroke={color(dims.indexOf(c.dimension) + 1)}
                  strokeWidth={3}
                >
                  <title>{`${c.quality_check_id} · ${c.dimension}: ${c.status}`}</title>
                </circle>
              ))}
            </Svg>
            <Legend
              items={[
                ...statuses,
                ...dims.map((d, i) => [d, color(i + 1)] as [string, string]),
              ]}
            />
          </>
        )
      }}
    </Frame>
  )
}
function GoldKpi() {
  const data = useData<Gold>('gold/overview.json')
  const [key, setKey] = useState('issue_speeches')
  return (
    <Frame data={data}>
      {({ parliament }) => {
        const keys = Object.keys(parliament).filter(
          (k) =>
            typeof parliament[k] === 'number' && (parliament[k] as number) >= 1,
        )
        const k = keys.includes(key) ? key : keys[0]
        return (
          <>
            <Slicer
              label="Measure"
              cycles={false}
              options={keys}
              value={k}
              onChange={setKey}
            />
            <Kpi
              value={fmt(parliament[k] as number)}
              unit={k.replace(/_/g, ' ')}
            />
          </>
        )
      }}
    </Frame>
  )
}
function ArchStack() {
  const data = useData<Graph>('architecture/graph.json')
  const [scale, setScale] = useState<(typeof SCALES)[number]>('count')
  return (
    <Frame data={data}>
      {({ domains }) => {
        const stages = palette(
          uniq(domains.flatMap((d) => Object.keys(d.counts))),
        )
        const max = Math.max(
          ...domains.map((d) => sum(Object.values(d.counts))),
        )
        const [W, H, m] = [600, 260, 90]
        const rh = (H - 14) / domains.length
        const ticks =
          scale === 'share' ? [0, 0.25, 0.5, 0.75, 1] : niceTicks(max)
        const x = linearScale([0, ticks.at(-1)!], [m, W - 6])
        return (
          <>
            <Slicer
              label="Scale"
              cycles={false}
              options={SCALES}
              value={scale}
              onChange={setScale}
            />
            <Svg w={W} h={H} label="Pipeline nodes per domain and stage">
              {ticks.map((t) => (
                <text
                  key={t}
                  className="mean-txt-t"
                  x={x(t)}
                  y={H - 2}
                  textAnchor="middle"
                >
                  {scale === 'share' ? `${t * 100}%` : t}
                </text>
              ))}
              {domains.map((d, i) => {
                const total = sum(Object.values(d.counts)) || 1
                let acc = 0
                return (
                  <g key={d.id}>
                    <text
                      className="mean-txt-t"
                      x={m - 4}
                      y={(i + 0.5) * rh + 3}
                      textAnchor="end"
                    >
                      {d.label}
                    </text>
                    {Object.entries(d.counts).map(([k, n]) => {
                      const v = scale === 'share' ? n / total : n
                      const x0 = x(acc)
                      acc += v
                      return n ? (
                        <rect
                          key={k}
                          x={x0}
                          y={i * rh + 3}
                          width={x(acc) - x0}
                          height={rh - 6}
                          fill={stages.get(k)}
                          stroke="var(--paper)"
                          strokeWidth={0.6}
                        >
                          <title>{`${d.label} · ${k}: ${n}`}</title>
                        </rect>
                      ) : null
                    })}
                  </g>
                )
              })}
            </Svg>
            <Legend items={[...stages]} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'txt-plat-quality-waffle', domain: d, render: () => <QualityWaffle /> },
  { id: 'txt-plat-gold-kpi', domain: d, render: () => <GoldKpi /> },
  {
    id: 'txt-plat-arch-stack',
    domain: d,
    size: 'wide',
    render: () => <ArchStack />,
  },
]
