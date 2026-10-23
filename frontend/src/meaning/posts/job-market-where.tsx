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
  fullYear,
  knownRegion,
  MARKET,
  pct,
  ratio,
  sum,
  type Market,
} from './job-kit'

const short = (r: string) => r.replace(/s? län$/, '')

/** Ads per named county in a year, most first. */
const byCounty = (m: Market, year: number) =>
  m.regions
    .filter(knownRegion)
    .flatMap((r) => {
      const v = r.ads.all?.[year]
      return v == null ? [] : [{ name: short(r.region), v }]
    })
    .sort((a, b) => b.v - a.v)

/** Each county's change in a field's ads, the year so far against the same months before;
 * counties without both counts are left out. */
const countyChange = (m: Market, id: string) =>
  m.regions
    .filter(knownRegion)
    .flatMap((r) => {
      const ch = ratio(
        r.ytd[id]?.[m.latest_year],
        r.ytd[id]?.[m.latest_year - 1],
      )
      return ch == null ? [] : [{ name: short(r.region), ch }]
    })
    .sort((a, b) => b.ch - a.ch)

function RegionLollipop() {
  const data = useData<Market>(MARKET)
  const [year, setYear] = useState<number | null>(null)
  return (
    <Frame data={data}>
      {(m) => {
        const yr = year ?? fullYear(m)
        return (
          <>
            <Slicer
              label="Year"
              options={m.years.filter((y) => y <= fullYear(m))}
              value={yr}
              onChange={setYear}
            />
            <p className="mean-cap">{yr}</p>
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
            <p className="mean-cap">{name(field)}</p>
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

/** The latest full year's share of ads offering regular employment, or null without counts. */
const regular = (m: Market) => {
  const year = fullYear(m)
  const e = m.conditions[year]?.all?.employment ?? {}
  const t = sum(Object.values(e))
  return t ? { year, share: (e['Vanlig anställning'] ?? 0) / t } : null
}

function EmploymentDonut() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const r = regular(m)
        return r ? (
          <Big
            value={pct(r.share)}
            unit={`of ${r.year} ads offer regular employment`}
          />
        ) : null
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
      return c.length
        ? `Across all fields, ads fell in ${down} of ${c.length} counties this year`
        : 'Change in ads per county against a year earlier'
    },
    note: 'Change in ads by workplace county, January to the latest full month against the same months a year earlier',
    render: () => <RegionHeatmap />,
  },
  {
    id: 'job-employment-sunburst',
    domain: D,
    sources: ['jobs/market.json'],
    title: (m: Market) => {
      const r = regular(m)
      return r
        ? `${pct(r.share)} of ads offer regular employment`
        : 'Kinds of employment in job ads'
    },
    note: 'Latest full year; the rest are other kinds, such as on-call and summer jobs; Arbetsförmedlingen',
    render: () => <EmploymentDonut />,
  },
  {
    id: 'job-region-lollipop',
    domain: D,
    sources: ['jobs/market.json'],
    size: 'tall',
    title: (m: Market) => {
      const yr = fullYear(m)
      const c = byCounty(m, yr)
      const all = sum(c.map((r) => r.v))
      return c[0] && all
        ? `${c[0].name} had the most ads in ${yr}: ${pct(c[0].v / all)} of those with a named county`
        : 'Job ads per county'
    },
    note: 'Ads per full year by workplace county; the title is about the latest full year; Arbetsförmedlingen',
    render: () => <RegionLollipop />,
  },
]
