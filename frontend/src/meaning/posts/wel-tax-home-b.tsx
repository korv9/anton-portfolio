/** Taxes close to home: the VAT in a household's spending, and the tax wedge on a wage. */
import { useState } from 'react'
import { Frame, OTHER, Slicer, focal, useData, type Post } from '../kit'
import { EndLabels, XAxis, YAxis } from '../axes'
import {
  Ranked,
  Svg,
  axis,
  extent,
  pct,
  sek,
  groupBy,
  num,
  path,
  scale,
} from './wel-kit'
import { l } from '../../i18n'

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
  countries: {
    country_code: string
    name_en: string
    name_sv?: string
    is_nordic: boolean
  }[]
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
              label={l('Household', 'Hushåll')}
              options={d.households.map((x) => x.key)}
              format={(k) => {
                const n = household(d, k)?.name
                return n ? l(...n) : k
              }}
              value={hh.key}
              onChange={setH}
            />
            <Ranked
              wrap
              head={4}
              tail={0}
              label={l(
                `VAT per household and year by spending group, SEK: ${hh.name[0]}`,
                `Moms per hushåll och år efter utgiftsgrupp, kr: ${hh.name[1]}`,
              )}
              format={sek}
              rows={hh.groups.map((g) => ({
                key: g.group,
                label: l(...g.name),
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
            .map((c) => [c.country_code, l(c.name_en, c.name_sv ?? c.name_en)]),
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
              label={l('Household', 'Hushåll')}
              options={[...new Set(d.series.map((r) => r[2]))]}
              format={(k) => (d.households[k] ? l(...d.households[k]) : k)}
              value={hh}
              onChange={setHh}
            />
            <Svg
              w={600}
              h={220}
              label={l(
                'Tax wedge on an average wage by year, % of labour costs, every OECD country',
                'Skattekil på en genomsnittslön per år, % av arbetskostnaden, alla OECD-länder',
              )}
            >
              <YAxis
                y={ax.y}
                ticks={ax.ticks}
                x0={30}
                x1={500}
                format={(v) => pct(v, 0)}
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
        ? l(
            `${top.name[0]} carried the most VAT in household spending in ${d.year}`,
            `${top.name[1]} stod för mest moms i hushållens konsumtion ${d.year}`,
          )
        : l('VAT in household spending', 'Moms i hushållens konsumtion')
    },
    note: [
      'SEK per household and year, by type of household; a floor, as mixed-rate groups are left out. Source: SCB',
      'Kronor per hushåll och år, efter hushållstyp; ett minimum, eftersom grupper med blandad momssats är borttagna. Källa: SCB',
    ],
    render: () => <Vat />,
  },
  {
    id: 'wel-wedge-lines',
    domain: 'taxes',
    sources: ['taxes/wedge.json'],
    size: 'wide',
    title: (d: Wedge) => {
      const s = swedenWedge(d)
      if (!s)
        return l(
          'The tax wedge on an average wage',
          'Skattekilen på en genomsnittslön',
        )
      const [a, b] = [s[0][3]!, s[1][3]!]
      const span = `${s[0][1]}–${s[1][1]}`
      const [from, to] = [pct(a, 1), pct(b, 1)]
      if (from === to)
        return l(
          `For a single earner without children on an average wage, Sweden's tax wedge stayed at ${from}, ${span}`,
          `För en ensamstående utan barn med genomsnittslön låg Sveriges skattekil kvar på ${from}, ${span}`,
        )
      return l(
        `For a single earner without children on an average wage, Sweden's tax wedge ${b < a ? 'fell' : 'rose'} from ${from} to ${to}, ${span}`,
        `För en ensamstående utan barn med genomsnittslön ${b < a ? 'sjönk' : 'steg'} Sveriges skattekil från ${from} till ${to}, ${span}`,
      )
    },
    note: [
      'Income tax and social contributions, % of labour costs, average wage. Source: OECD Taxing Wages',
      'Inkomstskatt och sociala avgifter, % av arbetskostnaden, genomsnittslön. Källa: OECD Taxing Wages',
    ],
    render: () => <WedgeLines />,
  },
]
