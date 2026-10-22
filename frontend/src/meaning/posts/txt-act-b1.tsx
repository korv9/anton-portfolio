/** AI Act duties, actors, cross-references and outside signals: heatmap, donut, flows, arcs, lines. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { Legend, Svg, arc, count, palette, uniq } from './txt-kit'

type Obligation = {
  actor_id: string
  requirement_type: string
  risk_class_id: string
  applies_from: string
}
const OBL = 'ai-act/obligations.json'
const mix = (c: string, p: number) =>
  `color-mix(in srgb, ${c} ${Math.round(p)}%, var(--paper))`
const d = 'ai-act'

function ObligationHeatmap() {
  const data = useData<Obligation[]>(OBL)
  return (
    <Frame data={data}>
      {(rows) => {
        const reqs = [...count(rows, (o) => o.requirement_type)]
          .sort((a, b) => b[1] - a[1])
          .map(([k]) => k)
        const actors = [...count(rows, (o) => o.actor_id)]
          .sort((a, b) => b[1] - a[1])
          .map(([k]) => k)
        const c = count(rows, (o) => `${o.actor_id}|${o.requirement_type}`)
        const max = Math.max(...c.values())
        const [W, H, mx, my] = [300, 600, 100, 50]
        const cw = (W - mx) / actors.length
        const ch = (H - my) / reqs.length
        return (
          <Svg
            w={W}
            h={H}
            label="Obligations of the AI Act by actor and requirement"
          >
            {actors.map((a, j) => (
              <text
                key={a}
                className="mean-txt-t"
                transform={`translate(${mx + (j + 0.5) * cw},${my - 4}) rotate(-40)`}
              >
                {a}
              </text>
            ))}
            {reqs.map((r, i) => (
              <g key={r}>
                <text
                  className="mean-txt-t"
                  x={mx - 4}
                  y={my + (i + 0.5) * ch + 3}
                  textAnchor="end"
                >
                  {r.replace(/_/g, ' ')}
                </text>
                {actors.map((a, j) => {
                  const n = c.get(`${a}|${r}`) ?? 0
                  return (
                    <rect
                      key={a}
                      x={mx + j * cw + 1}
                      y={my + i * ch + 1}
                      width={cw - 2}
                      height={ch - 2}
                      rx={3}
                      fill={
                        n ? mix(color(j), 25 + (75 * n) / max) : 'var(--wash)'
                      }
                    >
                      <title>{`${a} · ${r}: ${n}`}</title>
                    </rect>
                  )
                })}
              </g>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}
function RiskDonut() {
  const data = useData<Obligation[]>(OBL)
  const [actor, setActor] = useState('all')
  return (
    <Frame data={data}>
      {(rows) => {
        const risks = uniq(rows.map((o) => o.risk_class_id))
        const cols = palette(risks)
        const sel = rows.filter((o) => actor === 'all' || o.actor_id === actor)
        const c = count(sel, (o) => o.risk_class_id)
        let a = 0
        return (
          <>
            <Slicer
              label="Actor"
              options={['all', ...uniq(rows.map((o) => o.actor_id))]}
              value={actor}
              onChange={setActor}
            />
            <Svg w={300} h={300} label="Obligations by risk class">
              {risks.map((r) => {
                const a0 = a
                a += ((c.get(r) ?? 0) / sel.length) * 2 * Math.PI
                return c.get(r) ? (
                  <path
                    key={r}
                    d={arc(150, 150, 70, 140, a0, a - 0.005)}
                    fill={cols.get(r)}
                  >
                    <title>{`${r}: ${c.get(r)}`}</title>
                  </path>
                ) : null
              })}
              <text
                x={150}
                y={162}
                textAnchor="middle"
                fontSize={40}
                fontWeight={600}
                fill="var(--ink)"
              >
                {sel.length}
              </text>
            </Svg>
            <Legend items={[...cols]} />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-obligation-heatmap',
    domain: d,
    size: 'tall',
    render: () => <ObligationHeatmap />,
  },
  { id: 'txt-act-risk-donut', domain: d, render: () => <RiskDonut /> },
]
