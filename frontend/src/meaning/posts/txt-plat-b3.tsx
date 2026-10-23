/** Swedish statutes, idea lineage, compliance review and delivery: streams, units, funnels, bubbles. */
import { Frame, color, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Bars, Legend, Svg, arc, fmt, sum, uniq } from './txt-kit'

type Sfs = {
  kinds: { kind: string; documents: number; repealed: number }[]
  years: (Record<string, number> & { year: number })[]
  lengths: { kind: string; up_to: number | null; passages: number }[]
  largest: { sfs: string; title: string; sections: number }[]
  tests: Record<string, number>
}
type Delivery = {
  shard_prefixes: string[]
  parquet_datasets: Record<string, string[]>
}
type Dataset = { id: string; label: string; rows: number; columns: string[] }
const SFS = 'sfs/overview.json'
const d = 'platform'

function DeliveryDonut() {
  const data = useData<Delivery>('delivery.json')
  return (
    <Frame data={data}>
      {({ parquet_datasets, shard_prefixes }) => {
        const rows = Object.entries(parquet_datasets)
          .map(([k, v]) => [k, v.length] as [string, number])
          .sort((a, b) => b[1] - a[1])
        const total = sum(rows.map((r) => r[1]))
        let a = 0
        return (
          <>
            <Svg w={300} h={300} label="Parquet files per published dataset">
              {rows.map(([k, n], i) => {
                const a0 = a
                a += (n / total) * 2 * Math.PI
                return (
                  <path
                    key={k}
                    d={arc(150, 150, 90, 140, a0, a - 0.01)}
                    fill={color(i)}
                  >
                    <title>{`${k}: ${n}`}</title>
                  </path>
                )
              })}
              {uniq(shard_prefixes).map((s, i, all) => (
                <path
                  key={s}
                  d={arc(
                    150,
                    150,
                    60,
                    80,
                    (i / all.length) * 2 * Math.PI,
                    ((i + 1) / all.length) * 2 * Math.PI - 0.06,
                  )}
                  fill="var(--ink-2)"
                >
                  <title>{s}</title>
                </path>
              ))}
              <text
                x={150}
                y={160}
                textAnchor="middle"
                fontSize={28}
                fontWeight={600}
                fill="var(--ink)"
              >
                {total}
              </text>
            </Svg>
            <Legend items={rows.map(([k], i) => [k, color(i)])} />
          </>
        )
      }}
    </Frame>
  )
}
const bySections = ({ largest }: Sfs) =>
  [...largest].sort((a, b) => b.sections - a.sections)

function SfsLargest() {
  const data = useData<Sfs>(SFS)
  return (
    <Frame data={data}>
      {(s) => (
        <Bars
          label="The largest Swedish statutes by number of sections"
          format={fmt}
          long
          rows={bySections(s).map((l) => ({
            key: l.sfs,
            label: l.title,
            value: l.sections,
          }))}
        />
      )}
    </Frame>
  )
}
function DatasetBubbles() {
  const data = useData<Dataset[]>('products/datasets.json')
  return (
    <Frame data={data}>
      {(rows) => {
        const [W, H, m] = [400, 400, 30]
        const lx = Math.log10(Math.max(...rows.map((r) => r.rows), 10))
        const yt = niceTicks(Math.max(...rows.map((r) => r.columns.length)))
        const x = (v: number) => m + ((W - m - 20) * Math.log10(v)) / lx
        const y = linearScale([0, yt.at(-1)!], [H - 14, 10])
        return (
          <Svg w={W} h={H} label="Published product tables by rows and columns">
            {yt.map((t) => (
              <g key={t}>
                <line
                  className="mean-txt-grid"
                  x1={m}
                  x2={W}
                  y1={y(t)}
                  y2={y(t)}
                />
                <text
                  className="mean-txt-t"
                  x={m - 3}
                  y={y(t) + 3}
                  textAnchor="end"
                >
                  {t}
                </text>
              </g>
            ))}
            {[1, 10, 100, 1000]
              .filter((t) => Math.log10(t) <= lx)
              .map((t) => (
                <text
                  key={t}
                  className="mean-txt-t"
                  x={x(t)}
                  y={H - 2}
                  textAnchor="middle"
                >
                  {fmt(t)}
                </text>
              ))}
            {rows.map((r, i) => (
              <circle
                key={r.id}
                cx={x(r.rows)}
                cy={y(r.columns.length)}
                r={6 + Math.sqrt(r.rows * r.columns.length) / 4}
                fill={color(i)}
                fillOpacity={0.6}
                stroke="var(--paper)"
              >
                <title>{`${r.label}: ${r.rows} × ${r.columns.length}`}</title>
              </circle>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-plat-delivery-donut',
    domain: d,
    sources: ['delivery.json'],
    render: () => <DeliveryDonut />,
  },
  {
    id: 'txt-plat-sfs-largest',
    domain: d,
    sources: ['sfs/overview.json'],
    title: (s: Sfs) => {
      const [a] = bySections(s)
      return `${a.title} is the largest statute, with ${fmt(a.sections)} sections`
    },
    note: 'Sections (paragrafer) per statute, the largest in the SFS collection',
    render: () => <SfsLargest />,
  },
  {
    id: 'txt-plat-dataset-bubbles',
    domain: d,
    sources: ['products/datasets.json'],
    render: () => <DatasetBubbles />,
  },
]
