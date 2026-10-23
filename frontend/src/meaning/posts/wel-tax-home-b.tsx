/** Taxes close to home: the VAT in a household's spending, and the tax wedge on a wage. */
import { useState } from 'react'
import { Frame, OTHER, Slicer, focal, useData, type Post } from '../kit'
import { EndLabels, XAxis, YAxis } from '../axes'
import {
  Ranked,
  Svg,
  axis,
  extent,
  fmt,
  sek,
  groupBy,
  num,
  path,
  scale,
} from './wel-kit'

type Household = {
  year: string
  households: {
    key: string
    name: [string, string]
    groups: { group: string; name: [string, string]; vat: number }[]
  }[]
}

/** country, year, household type, tax wedge %. */
type Wedge = {
  countries: { country_code: string; name_en: string; is_nordic: boolean }[]
  series: [string, number, string, number | null][]
  /** Household code -> [English, Swedish] name. */
  households: Record<string, [string, string]>
}

const ALL = 'E90'

const household = (d: Household, key: string) =>
  d.households.find((x) => x.key === key) ?? d.households.at(0)

function Vat() {
  const data = useData<Household>('taxes/household.json')
  const [h, setH] = useState(ALL)
  return (
    <Frame data={data}>
      {(d) => {
        const hh = household(d, h)
        if (!hh) return null
        return (
          <>
            <Slicer
              label="Household"
              options={d.households.map((x) => x.key)}
              format={(k) => household(d, k)?.name[0] ?? k}
              value={hh.key}
              onChange={setH}
            />
            <Ranked
              wrap
              head={4}
              tail={0}
              label={`VAT per household and year by spending group, SEK: ${hh.name[0]}`}
              format={sek}
              rows={hh.groups.map((g) => ({
                key: g.group,
                label: g.name[0],
                value: g.vat,
              }))}
            />
          </>
        )
      }}
    </Frame>
  )
}

function WedgeLines() {
  const data = useData<Wedge>('taxes/wedge.json')
  const [hh, setHh] = useState('S_C0')
  return (
    <Frame data={data}>
      {(d) => {
        const rows = d.series.filter((r) => r[2] === hh && num(r[3]))
        const nordic = new Map(
          d.countries
            .filter((c) => c.is_nordic)
            .map((c) => [c.country_code, c.name_en]),
        )
        const [y0, y1] = extent(rows.map((r) => r[1]))
        const x = scale([y0, y1], [30, 500])
        const ax = axis(
          rows.map((r) => r[3]!),
          [196, 12],
        )
        const lines = [...groupBy(rows, (r) => r[0])]
          .map(([c, list]) => ({ c, list: list.sort((a, b) => a[1] - b[1]) }))
          // Grey first, Nordics over them, Sweden on top.
          .sort(
            (a, b) =>
              +nordic.has(a.c) +
              +(a.c === 'SWE') -
              (+nordic.has(b.c) + +(b.c === 'SWE')),
          )
        return (
          <>
            <Slicer
              label="Household"
              options={[...new Set(d.series.map((r) => r[2]))]}
              format={(k) => d.households[k]?.[0] ?? k}
              value={hh}
              onChange={setHh}
            />
            <Svg
              w={600}
              h={220}
              label="Tax wedge on an average wage by year, % of labour costs, every OECD country"
            >
              <YAxis
                y={ax.y}
                ticks={ax.ticks}
                x0={30}
                x1={500}
                format={(v) => `${v}%`}
              />
              {lines.map(({ c, list }) => (
                <path
                  key={c}
                  d={path(list.map((r) => [x(r[1]), ax.y(r[3]!)]))}
                  fill="none"
                  stroke={c === 'SWE' ? focal(true) : OTHER}
                  strokeWidth={c === 'SWE' ? 2.4 : nordic.has(c) ? 1.4 : 0.6}
                  opacity={nordic.has(c) ? 1 : 0.35}
                />
              ))}
              <EndLabels
                x={506}
                top={12}
                bottom={196}
                items={lines
                  .filter(
                    ({ c, list }) => nordic.has(c) && list.at(-1)![1] === y1,
                  )
                  .map(({ c, list }) => ({
                    y: ax.y(list.at(-1)![3]!),
                    label: nordic.get(c)!,
                    color: c === 'SWE' ? undefined : 'var(--mean-muted)',
                  }))}
              />
              <XAxis
                x={x}
                y={214}
                ticks={[...new Set(rows.map((r) => r[1]))]
                  .filter((y) => y % 5 === 0)
                  .map((y) => ({ value: y, label: String(y) }))}
              />
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

/** Sweden's wedge for a single earner without children, first and latest year. */
function swedenWedge(d: Wedge) {
  const se = d.series
    .filter((r) => r[0] === 'SWE' && r[2] === 'S_C0' && num(r[3]))
    .sort((a, b) => a[1] - b[1])
  return se.length > 1 ? [se[0], se.at(-1)!] : null
}

export const posts: Post[] = [
  {
    id: 'wel-vat-donut',
    domain: 'taxes',
    sources: ['taxes/household.json'],
    title: (d: Household) => {
      const hh = household(d, ALL)
      const top = [...(hh?.groups ?? [])].sort((a, b) => b.vat - a.vat)[0]
      return top
        ? `${top.name[0]} carried the most VAT in household spending in ${d.year}`
        : 'VAT in household spending'
    },
    note: 'SEK per household and year, by type of household; a floor, as mixed-rate groups are left out. Source: SCB',
    render: () => <Vat />,
  },
  {
    id: 'wel-wedge-lines',
    domain: 'taxes',
    sources: ['taxes/wedge.json'],
    size: 'wide',
    title: (d: Wedge) => {
      const s = swedenWedge(d)
      if (!s) return 'The tax wedge on an average wage'
      const [a, b] = [s[0][3]!, s[1][3]!]
      const who = 'For a single earner without children on an average wage'
      const span = `${s[0][1]}–${s[1][1]}`
      return fmt(a, 1) === fmt(b, 1)
        ? `${who}, Sweden's tax wedge stayed at ${fmt(a, 1)}%, ${span}`
        : `${who}, Sweden's tax wedge ${b < a ? 'fell' : 'rose'} from ${fmt(a, 1)}% to ${fmt(b, 1)}%, ${span}`
    },
    note: 'Income tax and social contributions, % of labour costs, average wage. Source: OECD Taxing Wages',
    render: () => <WedgeLines />,
  },
]
