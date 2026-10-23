/** The platform itself: quality checks, the architecture graph and the gold model. */
import { Frame, color, useData, type Post } from '../kit'
import { Bars, Kpi, Legend, Svg, arc, count, fmt, sum } from './txt-kit'

type Graph = {
  nodes: { id: string; type: string }[]
  edges: { source: string; target: string; type: string }[]
  domains: { id: string; label: string; counts: Record<string, number> }[]
}
type Semantic = {
  materializations: Record<string, { bytes: number }>
  tables: Record<string, { rows: number }>
}
const d = 'platform'

type Check = {
  quality_check_id: string
  product_id: string
  dimension: string
  status: string
}
const STATUS: Record<string, string> = {
  not_measured: 'not measured yet',
  not_applicable: 'not applicable',
  warning: 'warning',
  fail: 'failed',
}
const passing = (rows: Check[]) =>
  rows.filter((c) => c.status === 'pass').length

/** The pass count as one number, then every check that did not pass, by name. */
function QualityMatrix() {
  const data = useData<Check[]>('quality/checks.json')
  return (
    <Frame data={data}>
      {(rows) => {
        const rest = rows
          .filter((c) => c.status !== 'pass')
          .sort((a, b) => a.status.localeCompare(b.status))
        return (
          <>
            <Kpi
              value={`${passing(rows)} / ${rows.length}`}
              unit="checks pass"
            />
            <ul className="mean-txt-list" aria-label="Checks that did not pass">
              {rest.map((c) => (
                <li key={c.quality_check_id}>
                  <span>{`${c.product_id.replace(/_/g, ' ')}, ${c.dimension}`}</span>
                  <b>{STATUS[c.status] ?? c.status.replace(/_/g, ' ')}</b>
                </li>
              ))}
            </ul>
          </>
        )
      }}
    </Frame>
  )
}
/** Inner ring: node types. Outer ring: edge types. */
function ArchRings() {
  const data = useData<Graph>('architecture/graph.json')
  return (
    <Frame data={data}>
      {({ nodes, edges }) => {
        const rings = [
          [...count(nodes, (n) => n.type)],
          [...count(edges, (e) => e.type)],
        ].map((r) => r.sort((a, b) => b[1] - a[1]))
        let ci = 0
        const legend: [string, string][] = []
        return (
          <>
            <Svg
              w={300}
              h={300}
              label="Architecture graph: node types inside, edge types outside"
            >
              {rings.map((ring, k) => {
                const total = sum(ring.map(([, n]) => n))
                let a = 0
                return ring.map(([t, n]) => {
                  const a0 = a
                  a += (n / total) * 2 * Math.PI
                  const c = color(ci++)
                  legend.push([t, c])
                  return (
                    <path
                      key={`${k}${t}`}
                      d={arc(
                        150,
                        150,
                        k ? 106 : 50,
                        k ? 144 : 100,
                        a0,
                        a - 0.01,
                      )}
                      fill={c}
                    >
                      <title>{`${t}: ${n}`}</title>
                    </path>
                  )
                })
              })}
              <text
                x={150}
                y={158}
                textAnchor="middle"
                fontSize={22}
                fontWeight={600}
                fill="var(--ink)"
              >
                {nodes.length}
              </text>
            </Svg>
            <Legend items={legend} />
          </>
        )
      }}
    </Frame>
  )
}
/** 'fact_law_provision' → 'law provision'. */
const tableName = (t: string) =>
  t.replace(/^(fact|dim|mart)_/, '').replace(/_/g, ' ')
const bySize = ({ tables }: Semantic) =>
  Object.entries(tables)
    .filter(([, t]) => t.rows > 0)
    .sort((a, b) => b[1].rows - a[1].rows)

function GoldRows() {
  const data = useData<Semantic>('gold/semantic-model.json')
  return (
    <Frame data={data}>
      {(g) => (
        <Bars
          label="Rows per gold table, largest first"
          format={fmt}
          long
          rows={bySize(g).map(([name, t]) => ({
            key: name,
            label: tableName(name),
            value: t.rows,
          }))}
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-plat-quality-matrix',
    domain: d,
    sources: ['quality/checks.json'],
    title: (rows: Check[]) => {
      const failed = rows.filter((c) => c.status === 'fail').length
      return `${passing(rows)} of ${rows.length} data quality checks pass; ${failed ? `${failed} fail` : 'none fail'}`
    },
    note: 'Checks across the data products; the list names each one that did not pass',
    render: () => <QualityMatrix />,
  },
  {
    id: 'txt-plat-arch-rings',
    domain: d,
    sources: ['architecture/graph.json'],
    render: () => <ArchRings />,
  },
  {
    id: 'txt-plat-gold-rows',
    domain: d,
    sources: ['gold/semantic-model.json'],
    title: (g: Semantic) => {
      const rows = bySize(g)
      return `“${tableName(rows[0][0])}” is the largest of ${rows.length} gold tables, with ${fmt(rows[0][1].rows)} rows`
    },
    note: 'Rows per table in the gold layer; fact, dim and mart prefixes left out of the names',
    render: () => <GoldRows />,
  },
]
