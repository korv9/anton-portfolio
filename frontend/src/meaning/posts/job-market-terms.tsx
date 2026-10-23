/** Jobs: counties and conditions of employment, from market.json's regions and conditions. */
import { useState } from 'react'
import { color, focal, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { HOURS_EN } from '../../jobs/market'
import {
  knownRegion,
  compact,
  D,
  fieldName,
  Legend,
  MARKET,
  pct,
  sum,
  Svg,
  XLabels,
  type Market,
} from './job-kit'

const short = (r: string) => r.replace(/s? län$/, '')

function ExperienceWaffle() {
  const data = useData<Market>(MARKET)
  const [year, setYear] = useState(2025)
  return (
    <Frame data={data}>
      {(m) => {
        const e = m.conditions[year]?.all?.experience ?? {}
        const keys = Object.keys(e).sort()
        const t = sum(Object.values(e)) || 1
        const counts = keys.map((k) => Math.round((e[k] / t) * 100))
        const cells = keys.flatMap((_, i) =>
          Array.from({ length: counts[i] }, () => i),
        )
        return (
          <>
            <Slicer
              label="Year"
              cycles
              // 2026 is partial and uses new experience categories, so it is not a step.
              options={m.years.filter((y) => y < m.latest_year)}
              value={year}
              onChange={setYear}
            />
            <Svg
              w={400}
              h={400}
              label="Waffle of ads asking for experience, per hundred ads"
            >
              {cells.slice(0, 100).map((c, n) => (
                <rect
                  key={n}
                  x={(n % 10) * 40 + 3}
                  y={Math.floor(n / 10) * 40 + 3}
                  width={34}
                  height={34}
                  rx={8}
                  fill={color(c)}
                />
              ))}
            </Svg>
            <Legend
              items={keys.map((k, i) => [
                `experience ${k} ${counts[i]} %`,
                color(i),
              ])}
            />
          </>
        )
      }}
    </Frame>
  )
}

function HoursStack() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const keys = Object.keys(m.conditions[m.years[0]]?.all?.hours ?? {})
        const W = 400,
          H = 380,
          B = 350
        const bw = (W - 20) / m.years.length
        return (
          <>
            <Svg
              w={W}
              h={H}
              label="Stacked shares of full-time and part-time ads per year"
            >
              {m.years.map((yr, i) => {
                const h = m.conditions[yr]?.all?.hours ?? {}
                const t = sum(Object.values(h)) || 1
                let top = B
                return keys.map((k, j) => {
                  const hh = ((h[k] ?? 0) / t) * (B - 10)
                  top -= hh
                  return (
                    <rect
                      key={`${yr}${k}`}
                      x={10 + i * bw + 3}
                      y={top}
                      width={bw - 6}
                      height={hh}
                      fill={color(j + 1)}
                      stroke="var(--paper)"
                    >
                      <title>{`${yr} ${HOURS_EN[k] ?? k}: ${pct((h[k] ?? 0) / t, 1)}`}</title>
                    </rect>
                  )
                })
              })}
              <XLabels
                y={H - 12}
                items={m.years.map((yr, i) => ({
                  x: 10 + i * bw + bw / 2,
                  label: String(yr),
                }))}
              />
            </Svg>
            <Legend
              items={keys.map((k, j) => [HOURS_EN[k] ?? k, color(j + 1)])}
            />
          </>
        )
      }}
    </Frame>
  )
}

function RegionSwarm() {
  const data = useData<Market>(MARKET)
  const [field, setField] = useState('Data/IT')
  return (
    <Frame data={data}>
      {(m) => {
        const opts = m.fields.slice(0, 10).map((f) => fieldName(f.name))
        const id =
          m.fields.find((f) => fieldName(f.name) === field)?.id ??
          m.fields[0].id
        const yr = m.latest_year - 1
        const pts = m.regions
          .filter((r) => knownRegion(r) && r.ads.all?.[yr])
          .map((r) => ({
            name: short(r.region),
            s: (r.ads[id]?.[yr] ?? 0) / r.ads.all[yr],
          }))
          .sort((a, b) => a.s - b.s)
        // The domain fits the counties' range, not zero to max: shares bunch in a narrow band,
        // and a zero-based axis piled them into a tall stack on narrow cards.
        const min = Math.min(...pts.map((p) => p.s))
        const max = Math.max(min + 0.001, ...pts.map((p) => p.s))
        const x = linearScale([min, max], [30, 370])
        const placed: { x: number; y: number }[] = []
        const nodes = pts.map((p) => {
          const px = x(p.s)
          let py = 170
          for (
            let k = 1;
            placed.some((q) => Math.hypot(q.x - px, q.y - py) < 19);
            k++
          )
            py = 170 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 10
          placed.push({ x: px, y: py })
          return { ...p, x: px, y: py }
        })
        // The view crops to the stack's height, with room for the axis labels below it. The
        // focal county is named on its left, level with its dot, so the name reads as its own.
        const top = Math.min(...nodes.map((n) => n.y)) - 14
        const lead = nodes.at(-1)!
        const H = Math.max(...nodes.map((n) => n.y)) - top + 44
        return (
          <>
            <Slicer
              label="Field"
              options={opts}
              value={field}
              onChange={setField}
            />
            <Svg
              w={400}
              h={H}
              label="Beeswarm of counties by the field's share of their ads"
            >
              {nodes.map((n, i) => (
                <circle
                  key={n.name}
                  cx={n.x}
                  cy={n.y - top}
                  r={9}
                  fill={focal(i === nodes.length - 1)}
                  stroke="var(--paper)"
                >
                  <title>{`${n.name}: ${pct(n.s, 1)}`}</title>
                </circle>
              ))}
              <text
                x={lead.x - 14}
                y={lead.y - top + 5}
                textAnchor="end"
                fontSize={16}
                fontWeight={600}
                stroke="var(--paper)"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {lead.name}
              </text>
              <XLabels
                y={H - 10}
                items={[min, (min + max) / 2, max].map((v) => ({
                  x: x(v),
                  label: pct(v, 1),
                }))}
              />
            </Svg>
            <Legend
              items={[
                [
                  compact(sum(m.regions.map((r) => r.ads[id]?.[yr] ?? 0))) +
                    ' ads',
                  color(0),
                ],
              ]}
            />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-experience-waffle',
    domain: D,
    sources: ['jobs/market.json'],
    render: () => <ExperienceWaffle />,
  },
  {
    id: 'job-hours-stack',
    domain: D,
    sources: ['jobs/market.json'],
    render: () => <HoursStack />,
  },
  {
    id: 'job-region-swarm',
    domain: D,
    sources: ['jobs/market.json'],
    render: () => <RegionSwarm />,
  },
]
