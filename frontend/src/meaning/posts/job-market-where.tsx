/** Jobs: counties and conditions of employment, from market.json's regions and conditions. */
import { useState } from 'react'
import { focal, Frame, Slicer, useData, type Post } from '../kit'
import {
  Bars,
  Big,
  change,
  compact,
  D,
  ends,
  fieldName,
  knownRegion,
  MARKET,
  pct,
  sum,
  type Market,
} from './job-kit'

const short = (r: string) => r.replace(/s? län$/, '')

/** Ads per named county in a year, most first. */
const byCounty = (m: Market, year: number) =>
  m.regions
    .filter(knownRegion)
    .map((r) => ({ name: short(r.region), v: r.ads.all?.[year] ?? 0 }))
    .sort((a, b) => b.v - a.v)

/** Each county's change in a field's ads, the year so far against the same months before. */
const countyChange = (m: Market, id: string) =>
  m.regions
    .filter(knownRegion)
    .map((r) => {
      const now = r.ytd[id]?.[m.latest_year] ?? 0
      const before = r.ytd[id]?.[m.latest_year - 1] ?? 0
      return { name: short(r.region), ch: before ? now / before - 1 : 0 }
    })
    .sort((a, b) => b.ch - a.ch)

function RegionLollipop() {
  const data = useData<Market>(MARKET)
  const [year, setYear] = useState<number | null>(null)
  return (
    <Frame data={data}>
      {(m) => {
        const yr = year ?? m.latest_year - 1
        return (
          <>
            <Slicer
              label="Year"
              options={m.years.filter((y) => y < m.latest_year)}
              value={yr}
              onChange={setYear}
            />
            <Bars
              n={21}
              label={`Job ads per county, ${yr}`}
              format={compact}
              rows={byCounty(m, yr).map((r, j) => ({
                key: r.name,
                label: r.name,
                value: r.v,
                color: focal(j === 0),
              }))}
            />
          </>
        )
      }}
    </Frame>
  )
}

function RegionHeatmap() {
  const data = useData<Market>(MARKET)
  const [field, setField] = useState('all')
  return (
    <Frame data={data}>
      {(m) => {
        const rows = countyChange(m, field).map((r) => ({
          key: r.name,
          label: r.name,
          value: r.ch,
        }))
        const name = (id: string) =>
          id === 'all'
            ? 'All fields'
            : fieldName(m.fields.find((f) => f.id === id)?.name ?? id)
        return (
          <>
            <Slicer
              label="Field"
              options={['all', ...m.fields.slice(0, 8).map((f) => f.id)]}
              format={name}
              value={field}
              onChange={setField}
            />
            <p className="mean-job-cap">{name(field)}</p>
            <Bars
              label={`Change in ads per county, ${m.latest_year} so far against the same months of ${m.latest_year - 1}`}
              format={change}
              rows={rows}
              thumb={ends(rows)}
            />
          </>
        )
      }}
    </Frame>
  )
}

/** The latest full year's share of ads offering regular employment. */
const regular = (m: Market) => {
  const year = m.latest_year - 1
  const e = m.conditions[year]?.all?.employment ?? {}
  return {
    year,
    share: (e['Vanlig anställning'] ?? 0) / (sum(Object.values(e)) || 1),
  }
}

function EmploymentDonut() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const { year, share } = regular(m)
        return (
          <Big
            value={pct(share)}
            unit={`of ${year} ads offer regular employment`}
          />
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-region-heatmap',
    domain: D,
    sources: ['jobs/market.json'],
    title: (m: Market) => {
      const c = countyChange(m, 'all')
      const down = c.filter((r) => r.ch < 0).length
      return `Ads fell in ${down} of ${c.length} counties this year`
    },
    note: 'Change in ads by workplace county, January to the latest full month against the same months a year earlier',
    render: () => <RegionHeatmap />,
  },
  {
    id: 'job-employment-sunburst',
    domain: D,
    sources: ['jobs/market.json'],
    title: (m: Market) =>
      `${pct(regular(m).share)} of ads offer regular employment`,
    note: 'Latest full year; the rest are other kinds, such as on-call and summer jobs; Arbetsförmedlingen',
    render: () => <EmploymentDonut />,
  },
  {
    id: 'job-region-lollipop',
    domain: D,
    sources: ['jobs/market.json'],
    size: 'tall',
    title: (m: Market) => {
      const yr = m.latest_year - 1
      const c = byCounty(m, yr)
      const all = sum(c.map((r) => r.v))
      return c[0]
        ? `${c[0].name} had the most ads in ${yr}: ${pct(c[0].v / (all || 1))} of those with a named county`
        : 'Job ads per county'
    },
    note: 'Ads per year by workplace county; Arbetsförmedlingen',
    render: () => <RegionLollipop />,
  },
]
