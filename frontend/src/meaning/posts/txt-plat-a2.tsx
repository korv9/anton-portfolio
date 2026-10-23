/** The platform itself: quality checks, the architecture graph and the gold model. */
import { Frame, color, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Legend, Svg, arc, count, fmt, sum, uniq } from './txt-kit'

type QSummary = {
  product_dimensions: {
    product_id: string
    dimension: string
    check_count: number
    pass_count: number
  }[]
}
type Graph = {
  nodes: { id: string; type: string }[]
  edges: { source: string; target: string; type: string }[]
  domains: { id: string; label: string; counts: Record<string, number> }[]
}
type Semantic = {
  materializations: Record<string, { bytes: number }>
  tables: Record<string, { rows: number }>
}
const mix = (c: string, p: number) =>
  `color-mix(in srgb, ${c} ${Math.round(p)}%, var(--paper))`
const d = 'platform'

function QualityMatrix() {
  const data = useData<QSummary>('quality/summary.json')
  return (
    <Frame data={data}>
      {({ product_dimensions: rows }) => {
        const products = uniq(rows.map((r) => r.product_id))
        const dims = uniq(rows.map((r) => r.dimension))
        const v = new Map(
          rows.map((r) => [`${r.product_id}|${r.dimension}`, r]),
        )
        const [W, H, mx, my] = [400, 400, 70, 40]
        const cw = (W - mx) / dims.length
        const ch = (H - my) / products.length
        const max = Math.max(...rows.map((r) => r.check_count))
        return (
          <Svg w={W} h={H} label="Quality checks per product and dimension">
            {dims.map((dm, j) => (
              <text
                key={dm}
                className="mean-txt-t"
                transform={`translate(${mx + (j + 0.3) * cw},${my - 4}) rotate(-30)`}
              >
                {dm}
              </text>
            ))}
            {products.map((p, i) => (
              <g key={p}>
                <text
                  className="mean-txt-t"
                  x={mx - 4}
                  y={my + (i + 0.5) * ch + 3}
                  textAnchor="end"
                >
                  {p}
                </text>
                {dims.map((dm, j) => {
                  const r = v.get(`${p}|${dm}`)
                  const cx = mx + (j + 0.5) * cw
                  const cy = my + (i + 0.5) * ch
                  return r ? (
                    <g key={dm}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={
                          (Math.min(cw, ch) / 2.2) *
                          Math.sqrt(r.check_count / max)
                        }
                        fill={mix(color(i), 85)}
                      >
                        <title>{`${p} · ${dm}: ${r.pass_count}/${r.check_count}`}</title>
                      </circle>
                      <text
                        className="mean-txt-t"
                        x={cx}
                        y={cy + 3}
                        textAnchor="middle"
                      >
                        {r.pass_count}
                      </text>
                    </g>
                  ) : null
                })}
              </g>
            ))}
          </Svg>
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
function GoldRows() {
  const data = useData<Semantic>('gold/semantic-model.json')
  return (
    <Frame data={data}>
      {({ tables }) => {
        const rows = Object.entries(tables)
          .filter(([, t]) => t.rows > 0)
          .sort((a, b) => b[1].rows - a[1].rows)
        const [W, H, m] = [300, 600, 120]
        const pt = niceTicks(Math.log10(rows[0]?.[1].rows ?? 10), 4)
        const x = linearScale([0, pt.at(-1)!], [m, W - 8])
        const rh = (H - 14) / rows.length
        return (
          <Svg w={W} h={H} label="Rows per gold table on a log scale">
            {pt.map((p) => (
              <text
                key={p}
                className="mean-txt-t"
                x={x(p)}
                y={H - 2}
                textAnchor="middle"
              >
                {fmt(10 ** p)}
              </text>
            ))}
            {rows.map(([name, t], i) => (
              <g key={name}>
                <text
                  className="mean-txt-t"
                  x={m - 4}
                  y={(i + 0.5) * rh + 3}
                  textAnchor="end"
                >
                  {name}
                </text>
                <line
                  x1={m}
                  x2={x(Math.log10(t.rows))}
                  y1={(i + 0.5) * rh}
                  y2={(i + 0.5) * rh}
                  stroke="var(--line-strong)"
                />
                <circle
                  cx={x(Math.log10(t.rows))}
                  cy={(i + 0.5) * rh}
                  r={Math.min(4, rh / 2)}
                  fill={color(i)}
                >
                  <title>{`${name}: ${fmt(t.rows)}`}</title>
                </circle>
              </g>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-plat-quality-matrix',
    domain: d,
    sources: ['quality/summary.json'],
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
    size: 'tall',
    render: () => <GoldRows />,
  },
]
