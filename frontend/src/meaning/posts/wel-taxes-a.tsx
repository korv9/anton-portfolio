/** OECD revenue statistics: Sweden's tax mix over time, its largest taxes, and the league. */
import { Frame, OTHER, focal, useData, type Post } from '../kit'
import { EndLabels, XAxis, YAxis } from '../axes'
import {
  Ranked,
  Svg,
  axis,
  fmt,
  maxOf,
  ordinal,
  path,
  pct,
  scale,
} from './wel-kit'
import { l } from '../../i18n'

type TaxType = {
  tax_code: string
  name_en: string
  name_sv?: string
  parent_code: string | null
}
const taxName = (t: TaxType) => l(t.name_en, t.name_sv ?? t.name_en)

type Country = {
  country_code: string
  name_en: string
  name_sv?: string
  is_nordic: boolean
}

/** year, tax code, % of GDP, SEK bn. */
type Sweden = {
  types: TaxType[]
  rows: [number, string, number | null, number | null][]
}

/** country, year, tax code, % of GDP. */
type Countries = {
  types: TaxType[]
  countries: Country[]
  rows: [string, number, string, number | null][]
}

/** Short names for the six top-level tax types, for direct labels. The Swedish ones name the
 * tax itself, so they read alone in the title as well. */
const SHORT: Record<string, [string, string]> = {
  T_1000: ['Income and profits', 'Skatt på inkomst och vinst'],
  T_2000: ['Social security', 'Socialavgifter'],
  T_3000: ['Payroll', 'Löneskatter'],
  T_4000: ['Property', 'Fastighetsskatter'],
  T_5000: ['Goods and services', 'Skatt på varor och tjänster'],
  T_6000: ['Other', 'Övriga skatter'],
}

const useSweden = () => useData<Sweden>('taxes/sweden.json')

const tops = (types: TaxType[]) => types.filter((t) => t.parent_code === '_T')

/** Each top-level type's % of GDP by year, largest in the latest year first. */
function mix(d: Sweden) {
  const years = [...new Set(d.rows.map((r) => r[0]))].sort()
  const at = new Map(d.rows.map((r) => [`${r[0]}:${r[1]}`, r[2]]))
  return {
    years,
    series: tops(d.types)
      .map((t) => ({
        code: t.tax_code,
        name: SHORT[t.tax_code] ? l(...SHORT[t.tax_code]) : taxName(t),
        v: years.map((y) => at.get(`${y}:${t.tax_code}`) ?? null),
      }))
      // Types without a latest value sort last; their lines still draw.
      .sort((a, b) => (b.v.at(-1) ?? -Infinity) - (a.v.at(-1) ?? -Infinity)),
  }
}

function MixLines() {
  return (
    <Frame data={useSweden()}>
      {(d) => {
        const { years, series } = mix(d)
        const ax = axis(
          series.flatMap((s) => s.v.filter((v): v is number => v !== null)),
          [196, 12],
        )
        // The plot leaves the right third to the six end labels, which are long.
        const x = scale([0, years.length - 1], [30, 390])
        return (
          <Svg
            w={600}
            h={220}
            label={l(
              "Sweden's tax revenue by type of tax, % of GDP",
              'Sveriges skatteintäkter efter skatteslag, % av BNP',
            )}
          >
            <YAxis
              y={ax.y}
              ticks={ax.ticks}
              x0={30}
              x1={390}
              format={(v) => pct(v, 0)}
            />
            {series.map((s, j) => (
              <path
                key={s.code}
                d={path(
                  s.v
                    .map((v, i) => [i, v] as const)
                    .filter(([, v]) => v !== null)
                    .map(([i, v]) => [x(i), ax.y(v!)]),
                )}
                fill="none"
                stroke={j === 0 ? focal(true) : OTHER}
                strokeWidth={j === 0 ? 2.2 : 1.2}
              />
            ))}
            <EndLabels
              x={396}
              top={12}
              bottom={196}
              items={series
                .filter((s) => s.v.at(-1) != null)
                .map((s, j) => ({
                  y: ax.y(s.v.at(-1)!),
                  label: `${s.name} ${fmt(s.v.at(-1)!, 1)}`,
                  color: j ? 'var(--mean-muted)' : undefined,
                }))}
            />
            <XAxis
              x={x}
              y={214}
              ticks={years
                .map((y, i) => ({ value: i, label: String(y) }))
                .filter((t) => +t.label % 10 === 0)}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

/** The latest year's taxes with no sub-types, by % of GDP. */
function leaves(d: Sweden) {
  const year = maxOf(d.rows.filter((r) => r[2] != null).map((r) => r[0]))
  const parents = new Set(d.types.map((t) => t.parent_code))
  // Only taxes with a published value that year; a missing one is left out, not zero.
  const at = new Map(
    d.rows
      .filter((r) => r[0] === year && r[2] != null)
      .map((r) => [r[1], r[2]!]),
  )
  return {
    year,
    rows: d.types
      .filter(
        (t) =>
          !parents.has(t.tax_code) && t.tax_code !== '_T' && at.has(t.tax_code),
      )
      .map((t) => ({
        key: t.tax_code,
        label: taxName(t),
        value: at.get(t.tax_code)!,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
  }
}

function LargestTaxes() {
  return (
    <Frame data={useSweden()}>
      {(d) => (
        <Ranked
          wrap
          head={4}
          tail={0}
          label={l(
            "Sweden's six largest taxes, % of GDP",
            'Sveriges sex största skatter, % av BNP',
          )}
          format={(v) => pct(v)}
          rows={leaves(d).rows}
        />
      )}
    </Frame>
  )
}

function League() {
  return (
    <Frame data={useData<Countries>('taxes/countries.json')}>
      {(d) => {
        const rows = d.rows.filter((r) => r[2] === '_T' && r[3] != null)
        const year = maxOf(rows.map((r) => r[1]))
        if (year === null) return null
        const names = new Map(
          d.countries.map((c) => [
            c.country_code,
            l(c.name_en, c.name_sv ?? c.name_en),
          ]),
        )
        return (
          <Ranked
            label={l(
              `OECD countries ranked by total tax revenue, % of GDP, ${year}`,
              `OECD-länder rangordnade efter totala skatteintäkter, % av BNP, ${year}`,
            )}
            format={(v) => pct(v)}
            focus="SWE"
            rows={rows
              .filter((r) => r[1] === year)
              .map((r) => ({
                key: r[0],
                label: names.get(r[0]) ?? r[0],
                value: r[3]!,
              }))}
          />
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-tax-mix-area',
    domain: 'taxes',
    sources: ['taxes/sweden.json'],
    size: 'wide',
    title: (d: Sweden) => {
      const { years, series } = mix(d)
      const s = series[0]
      const v = s?.v.at(-1)
      return s && v != null
        ? l(
            `Taxes on ${s.name.toLowerCase()} raised the most in ${years.at(-1)}: ${pct(v)} of GDP`,
            `${s.name} drog in mest ${years.at(-1)}: ${pct(v)} av BNP`,
          )
        : l("Sweden's tax mix", 'Sveriges skattemix')
    },
    note: [
      'Tax revenue by type, % of GDP. Source: OECD Revenue Statistics',
      'Skatteintäkter efter skatteslag, % av BNP. Källa: OECD Revenue Statistics',
    ],
    render: () => <MixLines />,
  },
  {
    id: 'wel-tax-league',
    domain: 'taxes',
    sources: ['taxes/countries.json'],
    size: 'tall',
    title: (d: Countries) => {
      const rows = d.rows.filter((r) => r[2] === '_T' && r[3] != null)
      const year = maxOf(rows.map((r) => r[1]))
      const ranked = rows
        .filter((r) => r[1] === year)
        .sort((a, b) => b[3]! - a[3]!)
      const i = ranked.findIndex((r) => r[0] === 'SWE')
      return i < 0
        ? l(
            'Tax revenue as a share of GDP, OECD countries',
            'Skatteintäkter som andel av BNP, OECD-länder',
          )
        : l(
            `Sweden had the ${ordinal(i + 1)}-highest tax take of ${ranked.length} OECD countries in ${year}`,
            `Sverige hade ${i ? `det ${ordinal(i + 1)} högsta` : 'det högsta'} skattetrycket av ${ranked.length} OECD-länder ${year}`,
          )
    },
    note: [
      'Total tax revenue, % of GDP. Source: OECD Revenue Statistics',
      'Totala skatteintäkter, % av BNP. Källa: OECD Revenue Statistics',
    ],
    render: () => <League />,
  },
  {
    id: 'wel-tax-treemap',
    domain: 'taxes',
    sources: ['taxes/sweden.json'],
    title: (d: Sweden) => {
      const { year, rows } = leaves(d)
      return rows[0] && year !== null
        ? l(
            `${rows[0].label} was Sweden's largest single tax in ${year}`,
            `${rows[0].label} var Sveriges största enskilda skatt ${year}`,
          )
        : l("Sweden's largest taxes", 'Sveriges största skatter')
    },
    note: [
      'The six largest, % of GDP. Source: OECD Revenue Statistics',
      'De sex största, % av BNP. Källa: OECD Revenue Statistics',
    ],
    render: () => <LargestTaxes />,
  },
]
