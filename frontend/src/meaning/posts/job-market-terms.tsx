/** Jobs: counties and conditions of employment, from market.json's regions and conditions. */
import { useState } from 'react'
import { color, focal, Frame, shade, Slicer, useData, type Post } from '../kit'
import { EndLabels, YAxis } from '../axes'
import { linearScale } from '../../charts/scales'
import { HOURS_EN } from '../../jobs/market'
import {
  Big,
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

/** The latest full year's share of ads asking for experience, of all ads that year. */
const experience = (m: Market) => {
  const year = m.latest_year - 1
  const e = m.conditions[year]?.all?.experience ?? {}
  return { year, share: (e.yes ?? 0) / (sum(Object.values(e)) || 1) }
}

function ExperienceWaffle() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const { year, share } = experience(m)
        return (
          <Big
            value={pct(share)}
            unit={`of ${year} ads ask for work experience`}
          />
        )
      }}
    </Frame>
  )
}

/** Hours keys in a fixed order: full time at the base of each column, not stated on top. */
const HOURS = ['Heltid', 'Deltid', 'Okänd']
const hoursShare = (m: Market, yr: number, k: string) => {
  const h = m.conditions[yr]?.all?.hours ?? {}
  return (h[k] ?? 0) / (sum(Object.values(h)) || 1)
}

function HoursStack() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const W = 300,
          H = 220,
          L = 34,
          R = 200,
          B = 196
        const y = linearScale([0, 1], [B, 8])
        const bw = (R - L) / m.years.length
        const tone = (j: number) => (j ? shade(j, HOURS.length) : focal(true))
        const lastYr = m.years.at(-1)!
        let mid = B
        return (
          <Svg
            w={W}
            h={H}
            label="Shares of full-time, part-time and unstated hours in ads per year"
          >
            <YAxis
              ticks={[0, 0.5, 1]}
              y={y}
              x0={L}
              x1={R}
              format={(v) => pct(v)}
            />
            {m.years.map((yr, i) => {
              let top = B
              return HOURS.map((k, j) => {
                const hh = hoursShare(m, yr, k) * (B - 8)
                top -= hh
                return (
                  <rect
                    key={`${yr}${k}`}
                    x={L + i * bw + 2}
                    y={top}
                    width={bw - 4}
                    height={hh}
                    fill={tone(j)}
                    stroke="var(--paper)"
                    strokeWidth={0.5}
                  >
                    <title>{`${yr} ${HOURS_EN[k] ?? k}: ${pct(hoursShare(m, yr, k), 1)}`}</title>
                  </rect>
                )
              })
            })}
            <EndLabels
              x={R + 6}
              top={8}
              bottom={B}
              items={HOURS.map((k, j) => {
                const v = hoursShare(m, lastYr, k) * (B - 8)
                mid -= v
                return {
                  y: mid + v / 2,
                  label: `${HOURS_EN[k] ?? k} ${pct(hoursShare(m, lastYr, k))}`,
                  color: j ? 'var(--mean-muted)' : focal(true),
                }
              })}
            />
            <XLabels
              y={H - 4}
              items={m.years.map((yr, i) => ({
                x: L + i * bw + bw / 2,
                label: i % 2 ? '' : String(yr),
              }))}
            />
          </Svg>
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
                className="mean-job-v"
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
    title: (m: Market) =>
      `${pct(experience(m).share)} of ads ask for work experience`,
    note: 'Share of all ads in the latest full year, including those that do not say; Arbetsförmedlingen',
    render: () => <ExperienceWaffle />,
  },
  {
    id: 'job-hours-stack',
    domain: D,
    sources: ['jobs/market.json'],
    title: (m: Market) => {
      const yr = m.latest_year - 1
      return `${pct(hoursShare(m, yr, 'Heltid'))} of ${yr} ads were for full-time work`
    },
    note: 'Share of ads per year by working hours; the latest year is January to the latest full month',
    render: () => <HoursStack />,
  },
  {
    id: 'job-region-swarm',
    domain: D,
    sources: ['jobs/market.json'],
    title: "Where a field's ads are concentrated, by county",
    note: "Each dot a county: the field's share of the county's ads, last full year",
    render: () => <RegionSwarm />,
  },
]
