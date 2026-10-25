/** Jobs: conditions of employment, from market.json's conditions. */
import { focal, Frame, shade, useData, type Post } from '../kit'
import { EndLabels, YAxis } from '../axes'
import { linearScale } from '../../charts/scales'
import { HOURS_EN } from '../../jobs/market'
import {
  Big,
  D,
  fullYear,
  MARKET,
  pct,
  sum,
  Svg,
  XLabels,
  type Market,
} from './job-kit'

/** The latest full year's share of ads asking for experience, of the ads that answer yes or
 * no; null when that year has no answers. */
const experience = (m: Market) => {
  const year = fullYear(m)
  const e = m.conditions[year]?.all?.experience ?? {}
  const answered = (e.yes ?? 0) + (e.no ?? 0)
  return answered ? { year, share: (e.yes ?? 0) / answered } : null
}

function ExperienceWaffle() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const e = experience(m)
        return e ? (
          <Big
            value={pct(e.share)}
            unit={`of ${e.year} ads ask for work experience`}
          />
        ) : null
      }}
    </Frame>
  )
}

/** Hours keys in a fixed order: full time at the base of each column, not stated on top. */
const HOURS = ['Heltid', 'Deltid', 'Okänd']
/** A year's share of ads with these hours, or null when the year has no hours counted. */
const hoursShare = (m: Market, yr: number, k: string) => {
  const h = m.conditions[yr]?.all?.hours ?? {}
  const t = sum(Object.values(h))
  return t ? (h[k] ?? 0) / t : null
}

function HoursStack() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        // Full years only, so the last bar and its labels are the year the title names.
        const years = m.years.filter(
          (yr) => yr <= fullYear(m) && hoursShare(m, yr, 'Heltid') != null,
        )
        const yr = years.at(-1)
        if (yr == null) return null
        const W = 300,
          H = 220,
          L = 34,
          R = 200,
          B = 196
        const y = linearScale([0, 1], [B, 8])
        const bw = (R - L) / years.length
        const tone = (j: number) => (j ? shade(j, HOURS.length) : focal(true))
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
            {years.map((year, i) => {
              let top = B
              return HOURS.map((k, j) => {
                const s = hoursShare(m, year, k)!
                const hh = s * (B - 8)
                top -= hh
                return (
                  <rect
                    key={`${year}${k}`}
                    x={L + i * bw + 2}
                    y={top}
                    width={bw - 4}
                    height={hh}
                    fill={tone(j)}
                    stroke="var(--paper)"
                    strokeWidth={0.5}
                  >
                    <title>{`${year} ${HOURS_EN[k] ?? k}: ${pct(s, 1)}`}</title>
                  </rect>
                )
              })
            })}
            <EndLabels
              x={R + 6}
              top={8}
              bottom={B}
              items={HOURS.map((k, j) => {
                const s = hoursShare(m, yr, k)!
                const v = s * (B - 8)
                mid -= v
                return {
                  y: mid + v / 2,
                  label: `${HOURS_EN[k] ?? k} ${pct(s)}`,
                  color: j ? 'var(--mean-muted)' : focal(true),
                }
              })}
            />
            <XLabels
              y={H - 4}
              items={[0, years.length - 1].map((i) => ({
                x: L + i * bw + bw / 2,
                label: String(years[i]),
              }))}
            />
          </Svg>
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
    title: (m: Market) => {
      const e = experience(m)
      return e
        ? `${pct(e.share)} of ads ask for work experience`
        : 'Ads that ask for work experience'
    },
    note: 'Share of ads in the latest full year that state whether experience is needed; Arbetsförmedlingen',
    render: () => <ExperienceWaffle />,
  },
  {
    id: 'job-hours-stack',
    domain: D,
    sources: ['jobs/market.json'],
    title: (m: Market) => {
      const yr = fullYear(m)
      const s = hoursShare(m, yr, 'Heltid')
      return s == null
        ? 'Full-time and part-time job ads per year'
        : `${pct(s)} of ${yr} ads were for full-time work`
    },
    note: 'Share of ads per full year by working hours; Arbetsförmedlingen',
    render: () => <HoursStack />,
  },
]
