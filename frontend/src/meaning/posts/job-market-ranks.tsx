/** Jobs: occupations and fields, from market.json's yearly occupation and monthly field counts. */
import { useState } from 'react'
import { focal, Frame, Slicer, useData, type Post } from '../kit'
import { EndLabels, YAxis } from '../axes'
import { linearScale, niceTicks } from '../../charts/scales'
import {
  Bars,
  change,
  compact,
  D,
  ends,
  fieldName,
  linePath,
  MARKET,
  sum,
  Svg,
  XLabels,
  type Market,
} from './job-kit'

/** Ads per field in the months the latest year covers, so every year compares alike. */
const ytdByField = (m: Market, year: number) =>
  m.fields.map((f) => ({
    id: f.id,
    name: fieldName(f.name),
    ads: sum(
      (m.monthly[f.id] ?? [])
        .filter(
          (r) =>
            Number(r[0].slice(0, 4)) === year &&
            Number(r[0].slice(5, 7)) <= m.ytd_months,
        )
        .map((r) => r[1]),
    ),
  }))

/** 'January–September', the months every year is counted over. */
const span = (m: Market) =>
  `January–${new Date(2000, m.ytd_months - 1, 15).toLocaleString('en-GB', { month: 'long' })}`

/** Each field's change against the same months of the year before, largest rise first. */
const changes = (m: Market) => {
  const prev = ytdByField(m, m.latest_year - 1)
  return ytdByField(m, m.latest_year)
    .map((f, i) => ({ ...f, ch: prev[i].ads ? f.ads / prev[i].ads - 1 : 0 }))
    .sort((a, b) => b.ch - a.ch)
}

function FieldBump() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const byYear = m.years.map((yr) => ytdByField(m, yr))
        const shown = [...byYear.at(-1)!]
          .sort((a, b) => b.ads - a.ads)
          .slice(0, 5)
          .map((f) => f.id)
        const val = (i: number, id: string) =>
          byYear[i].find((f) => f.id === id)?.ads ?? 0
        const ticks = niceTicks(
          Math.max(...shown.flatMap((id) => m.years.map((_, i) => val(i, id)))),
        )
        const W = 600,
          H = 220,
          L = 40,
          R = 430,
          B = 196
        const x = linearScale([0, m.years.length - 1], [L + 8, R])
        const y = linearScale([0, ticks.at(-1)!], [B, 10])
        const name = (id: string) =>
          fieldName(m.fields.find((f) => f.id === id)?.name ?? id)
        return (
          <Svg w={W} h={H} label="Ads per year in the five largest fields">
            <YAxis ticks={ticks} y={y} x0={L} x1={R} format={compact} />
            {/* The leader draws last, on top of the grey lines. */}
            {[...shown].reverse().map((id) => (
              <path
                key={id}
                d={linePath(m.years.map((_, i) => [x(i), y(val(i, id))]))}
                fill="none"
                stroke={focal(id === shown[0])}
                strokeWidth={id === shown[0] ? 2.5 : 1.5}
              >
                <title>{name(id)}</title>
              </path>
            ))}
            <EndLabels
              x={R + 6}
              top={10}
              bottom={B}
              items={shown.map((id) => ({
                y: y(val(m.years.length - 1, id)),
                label: name(id).split(',')[0],
                color: id === shown[0] ? focal(true) : 'var(--mean-muted)',
              }))}
            />
            <XLabels
              y={H - 4}
              items={m.years.map((yr, i) => ({ x: x(i), label: String(yr) }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

function FieldRadial() {
  const data = useData<Market>(MARKET)
  const [year, setYear] = useState<number | null>(null)
  return (
    <Frame data={data}>
      {(m) => {
        const yr = year ?? m.latest_year
        return (
          <>
            <Slicer
              label="Year"
              options={m.years}
              value={yr}
              onChange={setYear}
            />
            <Bars
              label={`Ads per occupation field, ${span(m)} ${yr}`}
              format={compact}
              rows={ytdByField(m, yr)
                .sort((a, b) => b.ads - a.ads)
                .map((f, j) => ({
                  key: f.id,
                  label: f.name,
                  value: f.ads,
                  color: focal(j === 0),
                }))}
            />
          </>
        )
      }}
    </Frame>
  )
}

function FieldChange() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const rows = changes(m).map((f) => ({
          key: f.id,
          label: f.name,
          value: f.ch,
        }))
        return (
          <Bars
            label={`Change in ads per field, ${span(m)} ${m.latest_year} against ${m.latest_year - 1}`}
            format={change}
            rows={rows}
            thumb={ends(rows)}
          />
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-field-bump',
    domain: D,
    sources: ['jobs/market.json'],
    size: 'wide',
    title: (m: Market) => {
      const top = ytdByField(m, m.latest_year).sort((a, b) => b.ads - a.ads)[0]
      return top
        ? `${top.name} has the most ads in ${m.latest_year}`
        : 'Ads in the largest occupation fields'
    },
    note: 'Ads published January to the latest full month, each year; the five largest fields this year',
    render: () => <FieldBump />,
  },
  {
    id: 'job-field-radial',
    domain: D,
    sources: ['jobs/market.json'],
    title: (m: Market) => `Job ads per occupation field, ${m.latest_year}`,
    note: 'Ads published January to the latest full month; Arbetsförmedlingen',
    render: () => <FieldRadial />,
  },
  {
    id: 'job-field-change',
    domain: D,
    sources: ['jobs/market.json'],
    title: (m: Market) => {
      const c = changes(m)
      const down = c.filter((f) => f.ch < 0).length
      return `${down} of ${c.length} fields have fewer ads than a year earlier`
    },
    note: 'Change in ads, January to the latest full month against the same months a year earlier; the largest rises and falls',
    render: () => <FieldChange />,
  },
]
