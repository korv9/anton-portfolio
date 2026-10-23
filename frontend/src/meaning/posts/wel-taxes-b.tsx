/** OECD revenue statistics: Sweden's total tax take, and the Nordics against the OECD. */
import { Frame, OTHER, focal, useData, type Post } from '../kit'
import { EndLabels, XAxis, YAxis } from '../axes'
import {
  Kpi,
  Svg,
  axis,
  extent,
  fmt,
  groupBy,
  path,
  scale,
  signed,
} from './wel-kit'

type Country = { country_code: string; name_en: string; is_nordic: boolean }

/** country, year, tax code, % of GDP. */
type Countries = {
  countries: Country[]
  rows: [string, number, string, number | null][]
}

const useCountries = () => useData<Countries>('taxes/countries.json')

const totals = (d: Countries) =>
  d.rows.filter((r) => r[2] === '_T' && r[3] !== null)

/** Sweden's total in the latest year, and the year before. */
function sweden(d: Countries) {
  const se = totals(d).filter((r) => r[0] === 'SWE')
  const year = Math.max(...se.map((r) => r[1]))
  return {
    year,
    now: se.find((r) => r[1] === year)?.[3] ?? null,
    before: se.find((r) => r[1] === year - 1)?.[3] ?? null,
  }
}

function NordicLines() {
  return (
    <Frame data={useCountries()}>
      {(d) => {
        const rows = totals(d)
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
          <Svg
            w={600}
            h={220}
            label="Total tax revenue as a share of GDP by year: the Nordic countries against the rest of the OECD"
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
                .filter((y) => y % 10 === 0)
                .map((y) => ({ value: y, label: String(y) }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

function SwedenKpi() {
  return (
    <Frame data={useCountries()}>
      {(d) => {
        const s = sweden(d)
        return s.now === null ? null : (
          <Kpi
            value={fmt(s.now, 1)}
            unit="% of GDP"
            label={`Total tax revenue, ${s.year}`}
            delta={
              s.before === null
                ? undefined
                : signed(s.now - s.before, ' points')
            }
            since={String(s.year - 1)}
          />
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-tax-kpi',
    domain: 'taxes',
    sources: ['taxes/countries.json'],
    title: (d: Countries) => `Sweden's total tax take in ${sweden(d).year}`,
    note: 'Taxes and social contributions, % of GDP. Source: OECD Revenue Statistics',
    render: () => <SwedenKpi />,
  },
  {
    id: 'wel-tax-nordic-lines',
    domain: 'taxes',
    sources: ['taxes/countries.json'],
    size: 'wide',
    title: (d: Countries) => {
      const rows = totals(d)
      const year = Math.max(...rows.map((r) => r[1]))
      const nordic = new Set(
        d.countries.filter((c) => c.is_nordic).map((c) => c.country_code),
      )
      const top = rows
        .filter((r) => r[1] === year && nordic.has(r[0]))
        .sort((a, b) => b[3]! - a[3]!)[0]
      const name = d.countries.find((c) => c.country_code === top?.[0])?.name_en
      return top && name
        ? `${name} had the highest tax take of the Nordic countries in ${year}: ${fmt(top[3]!, 1)}% of GDP`
        : 'Tax revenue in the Nordic countries and the rest of the OECD'
    },
    note: '% of GDP; grey lines: other OECD countries. Source: OECD Revenue Statistics',
    render: () => <NordicLines />,
  },
]
