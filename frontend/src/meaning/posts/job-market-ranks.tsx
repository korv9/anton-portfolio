/** Jobs: occupation fields, from market.json's monthly field counts. */
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
  maxOf,
  present,
  ratio,
  span,
  sum,
  Svg,
  XLabels,
  type Market,
} from './job-kit'
import { l } from '../../i18n'

/** Ads per field in the months the latest year covers, so every year compares alike. A field
 * with no months in that span has no value (null), not zero ads. */
const ytdByField = (m: Market, year: number) =>
  m.fields.map((f) => {
    const rows = (m.monthly[f.id] ?? []).filter(
      (r) =>
        Number(r[0].slice(0, 4)) === year &&
        Number(r[0].slice(5, 7)) <= m.ytd_months,
    )
    return {
      id: f.id,
      name: fieldName(f.name),
      ads: rows.length ? sum(rows.map((r) => r[1])) : null,
    }
  })

/** Fields with a value in a year, most ads first. */
const ranked = (m: Market, year: number) =>
  ytdByField(m, year)
    .filter((f): f is typeof f & { ads: number } => f.ads != null)
    .sort((a, b) => b.ads - a.ads)

/** Each field's change against the same months of the year before, largest rise first;
 * fields without both values are left out. */
const changes = (m: Market) => {
  const prev = new Map(
    ytdByField(m, m.latest_year - 1).map((f) => [f.id, f.ads]),
  )
  return ytdByField(m, m.latest_year)
    .map((f) => ({
      ...f,
      ch: ratio(f.ads ?? undefined, prev.get(f.id) ?? undefined),
    }))
    .filter((f): f is typeof f & { ch: number } => f.ch != null)
    .sort((a, b) => b.ch - a.ch)
}

function FieldBump() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const byYear = m.years.map((yr) => ytdByField(m, yr))
        const shown = ranked(m, m.latest_year)
          .slice(0, 5)
          .map((f) => f.id)
        const val = (i: number, id: string) =>
          byYear[i].find((f) => f.id === id)?.ads ?? null
        const max = maxOf(
          present(shown.flatMap((id) => m.years.map((_, i) => val(i, id)))),
        )
        if (!shown.length || !max) return null
        const ticks = niceTicks(max)
        const W = 600,
          H = 220,
          L = 40,
          R = 430,
          B = 196
        const x = linearScale([0, Math.max(1, m.years.length - 1)], [L + 8, R])
        const y = linearScale([0, ticks.at(-1)!], [B, 10])
        const name = (id: string) =>
          fieldName(m.fields.find((f) => f.id === id)?.name ?? id)
        const lastI = m.years.length - 1
        return (
          <Svg
            w={W}
            h={H}
            label={l(
              'Ads per year in the five largest fields',
              'Annonser per år i de fem största yrkesområdena',
            )}
          >
            <YAxis ticks={ticks} y={y} x0={L} x1={R} format={compact} />
            {/* The leader draws last, on top of the grey lines. */}
            {[...shown].reverse().map((id) => (
              <path
                key={id}
                d={linePath(
                  m.years.map((_, i) => {
                    const v = val(i, id)
                    return v == null ? null : [x(i), y(v)]
                  }),
                )}
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
                y: y(val(lastI, id)!),
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
              label={l('Year', 'År')}
              options={m.years}
              value={yr}
              onChange={setYear}
            />
            <p className="mean-cap">
              {span(m)} {yr}
            </p>
            <Bars
              label={l(
                `Ads per occupation field, ${span(m)} ${yr}`,
                `Annonser per yrkesområde, ${span(m)} ${yr}`,
              )}
              format={compact}
              rows={ranked(m, yr).map((f, j) => ({
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
            label={l(
              `Change in ads per field, ${span(m)} ${m.latest_year} against ${m.latest_year - 1}`,
              `Förändring i annonser per yrkesområde, ${span(m)} ${m.latest_year} mot ${m.latest_year - 1}`,
            )}
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
      const top = ranked(m, m.latest_year)[0]
      return top
        ? l(
            `${top.name} has the most ads in ${m.latest_year}`,
            `${top.name} har flest annonser ${m.latest_year}`,
          )
        : l(
            'Ads in the largest occupation fields',
            'Annonser i de största yrkesområdena',
          )
    },
    note: [
      'Ads published January to the latest full month, each year; the five largest fields this year',
      'Annonser publicerade från januari till senaste hela månaden, varje år; årets fem största yrkesområden',
    ],
    render: () => <FieldBump />,
  },
  {
    id: 'job-field-radial',
    domain: D,
    sources: ['jobs/market.json'],
    title: ['Job ads per occupation field', 'Platsannonser per yrkesområde'],
    note: [
      'Ads published January to the latest full month of each year; Arbetsförmedlingen',
      'Annonser publicerade från januari till senaste hela månaden varje år; Arbetsförmedlingen',
    ],
    render: () => <FieldRadial />,
  },
  {
    id: 'job-field-change',
    domain: D,
    sources: ['jobs/market.json'],
    title: (m: Market) => {
      const c = changes(m)
      const down = c.filter((f) => f.ch < 0).length
      return c.length
        ? l(
            `${down} of ${c.length} fields have fewer ads than a year earlier`,
            `${down} av ${c.length} yrkesområden har färre annonser än ett år tidigare`,
          )
        : l(
            'Change in ads per field against a year earlier',
            'Förändring i annonser per yrkesområde mot ett år tidigare',
          )
    },
    note: [
      'Change in ads, January to the latest full month against the same months a year earlier; the largest rises and falls',
      'Förändring i annonser, januari till senaste hela månaden mot samma månader året innan; de största ökningarna och minskningarna',
    ],
    render: () => <FieldChange />,
  },
]
