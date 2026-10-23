/** The platform itself: quality checks, the architecture graph and the gold model. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { Bars, Kpi, Legend, Svg, fmt, palette, sum, uniq } from './txt-kit'

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
/** Pipeline nodes per domain, most first. */
const byDomain = ({ domains }: Graph) =>
  domains
    .map((d) => ({ d, n: sum(Object.values(d.counts)) }))
    .sort((a, b) => b.n - a.n)

function ArchStack() {
  const data = useData<Graph>('architecture/graph.json')
  return (
    <Frame data={data}>
      {(g) => (
        <Bars
          label="Pipeline nodes per domain, most first"
          format={String}
          long
          rows={byDomain(g).map(({ d, n }) => ({
            key: d.id,
            label: d.label,
            value: n,
          }))}
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-plat-quality-waffle',
    domain: d,
    sources: ['quality/checks.json'],
    render: () => <QualityWaffle />,
  },
  {
    id: 'txt-plat-gold-kpi',
    domain: d,
    sources: ['gold/overview.json'],
    render: () => <GoldKpi />,
  },
  {
    id: 'txt-plat-arch-stack',
    domain: d,
    sources: ['architecture/graph.json'],
    title: (g: Graph) => {
      const rows = byDomain(g)
      return `${rows[0].d.label} is the largest domain, with ${rows[0].n} of ${sum(rows.map((r) => r.n))} pipeline nodes`
    },
    note: 'Nodes per domain in the architecture graph: sources, ingestion, models, gold tables and outputs',
    render: () => <ArchStack />,
  },
]
