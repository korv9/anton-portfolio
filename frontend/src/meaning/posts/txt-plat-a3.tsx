/** The platform itself: quality checks, the architecture graph and the gold model. */
import { Frame, color, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { Legend, Svg, count, fmt, palette, squarify, uniq } from './txt-kit'

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

function ArchDegree() {
  const data = useData<Graph>('architecture/graph.json')
  return (
    <Frame data={data}>
      {({ nodes, edges }) => {
        const deg = new Map(nodes.map((n) => [n.id, 0]))
        for (const e of edges)
          for (const id of [e.source, e.target])
            deg.set(id, (deg.get(id) ?? 0) + 1)
        const hist = count([...deg.values()], (d) => String(d))
        const maxDeg = Math.max(...deg.values())
        const [W, H, m] = [400, 400, 30]
        const yt = niceTicks(Math.max(...hist.values()))
        const y = linearScale([0, yt.at(-1)!], [H - 14, 6])
        const bw = (W - m) / (maxDeg + 1)
        return (
          <Svg w={W} h={H} label="How many edges each architecture node has">
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
            {niceTicks(maxDeg, 5).map((t) => (
              <text
                key={t}
                className="mean-txt-t"
                x={m + (t + 0.5) * bw}
                y={H - 2}
                textAnchor="middle"
              >
                {t}
              </text>
            ))}
            {[...hist].map(([k, n]) => (
              <rect
                key={k}
                x={m + +k * bw}
                width={Math.max(bw - 1, 1)}
                y={y(n)}
                height={H - 14 - y(n)}
                fill={color(+k % 6)}
              >
                <title>{`${k}: ${n}`}</title>
              </rect>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}
function GoldBytes() {
  const data = useData<Semantic>('gold/semantic-model.json')
  return (
    <Frame data={data}>
      {({ materializations }) => {
        const files = Object.entries(materializations).map(([path, m]) => ({
          path,
          bytes: m.bytes,
          dir: path.split('/').slice(0, -1).join('/') || '.',
        }))
        const dirs = palette(uniq(files.map((f) => f.dir)).sort())
        return (
          <>
            <Svg w={400} h={400} label="Gold model files sized by bytes">
              {squarify(files, (f) => f.bytes, {
                x: 0,
                y: 0,
                w: 400,
                h: 400,
              }).map((c) => (
                <rect
                  key={c.t.path}
                  x={c.x}
                  y={c.y}
                  width={c.w}
                  height={c.h}
                  fill={dirs.get(c.t.dir)}
                  stroke="var(--paper)"
                  className="mean-txt-hover"
                >
                  <title>{`${c.t.path}: ${fmt(c.t.bytes)} B`}</title>
                </rect>
              ))}
            </Svg>
            <Legend items={[...dirs]} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  { id: 'txt-plat-arch-degree', domain: d, render: () => <ArchDegree /> },
  { id: 'txt-plat-gold-bytes', domain: d, render: () => <GoldBytes /> },
]
