/** Public libraries: where they are, how much they are used, and a relationship tested. */
import { useState } from 'react'
import { Frame, Slicer, focal, shade, useData, type Post } from '../kit'
import { EndLabels, XAxis, YAxis } from '../axes'
import { Scatter } from './wel-charts'
import {
  Legend,
  Svg,
  axis,
  band,
  extent,
  fmt,
  groupBy,
  num,
  path,
  scale,
} from './wel-kit'
import { l } from '../../i18n'
import { count } from '../../format'

type Connections = {
  relationships: {
    id: string
    x?: { name: string; unit: string }
    y?: { name: string; unit: string }
    result: {
      rho?: number
      n?: number
      points?: [string, number, number][]
    }
  }[]
}

type Libraries = {
  libraries: {
    code: string
    type: string
    x: number | null
    y: number | null
  }[]
}

type Belonging = {
  rows: ({ code: string; year: number } & Partial<
    Record<Rate, number | null>
  >)[]
}

type Rate =
  | 'visits_rate'
  | 'active_borrowers_rate'
  | 'activities_rate'
  | 'service_points_rate'

/** The rates' units, as export_belonging.py writes them. */
const LIBRARY_RATES: Record<Rate, [string, string]> = {
  active_borrowers_rate: [
    'Active borrowers per 100 inhabitants',
    'Aktiva låntagare per 100 invånare',
  ],
  visits_rate: [
    'Library visits per inhabitant',
    'Biblioteksbesök per invånare',
  ],
  activities_rate: [
    'Public activities per 1,000 inhabitants',
    'Publika aktiviteter per 1 000 invånare',
  ],
  service_points_rate: [
    'Service points per 10,000 inhabitants',
    'Serviceställen per 10 000 invånare',
  ],
}
const rate = (k: Rate) => l(...LIBRARY_RATES[k])

/** KB's library types in plain words; the combined type is the focal one. */
const TYPES: Record<string, [string, string]> = {
  folkbib: ['Public library', 'Folkbibliotek'],
  folkskolbib: [
    'Public and school library in one',
    'Kombinerat folk- och skolbibliotek',
  ],
}

/** The one relationship tested on municipality points, which a scatter can show. */
const scattered = (d: Connections) =>
  d.relationships.find((r) => r.result.points?.length && r.x && r.y)

function Relation() {
  return (
    <Frame data={useData<Connections>('sweden/connections/connections.json')}>
      {(d) => {
        const r = scattered(d)
        if (!r) return null
        return (
          <Scatter
            r={2.2}
            label={l(
              `${r.x!.name} against ${r.y!.name}, one dot per municipality`,
              `${r.x!.name} mot ${r.y!.name}, en punkt per kommun`,
            )}
            xFormat={(v) => `${fmt(v / 1000, 0)}${l('k', '\u00a0tkr')}`}
            yFormat={(v) => fmt(v, 1)}
            dots={r.result
              .points!.filter((p) => num(p[1]) && num(p[2]))
              .map((p) => ({
                key: p[0],
                name: l(`Municipality code ${p[0]}`, `Kommunkod ${p[0]}`),
                x: p[1],
                y: p[2],
              }))}
          />
        )
      }}
    </Frame>
  )
}

const located = (d: Libraries) =>
  d.libraries.filter((l) => num(l.x) && num(l.y))

function LibraryMap() {
  return (
    <Frame data={useData<Libraries>('sweden/belonging/libraries.json')}>
      {(d) => {
        const libs = located(d)
        if (!libs.length) return null
        const [x0, x1] = extent(libs.map((l) => l.x!))
        const [y0, y1] = extent(libs.map((l) => l.y!))
        const k = Math.min(280 / (x1 - x0 || 1), 580 / (y1 - y0 || 1))
        const types = Object.keys(TYPES)
        const fill = (t: string) => focal(t === 'folkskolbib')
        return (
          <>
            <Svg
              w={300}
              h={600}
              label={l(
                'Every public library in Sweden as a dot',
                'Varje folkbibliotek i Sverige som en punkt',
              )}
            >
              {/* The focal type is drawn last, on top. */}
              {[...libs]
                .sort((a, b) => types.indexOf(a.type) - types.indexOf(b.type))
                .map((l, i) => (
                  <circle
                    key={i}
                    cx={10 + (l.x! - x0) * k}
                    cy={590 - (l.y! - y0) * k}
                    r={2.2}
                    fill={fill(l.type)}
                    opacity={0.85}
                  />
                ))}
            </Svg>
            <Legend
              items={types.map((t) => l(...TYPES[t]))}
              colors={types.map(fill)}
            />
          </>
        )
      }}
    </Frame>
  )
}

/** Per year, the 10th, 25th, 50th, 75th and 90th percentile across municipalities. */
function quantiles(d: Belonging, m: Rate) {
  return [
    ...groupBy(
      d.rows.filter((r) => num(r[m])),
      (r) => r.year,
    ),
  ]
    .sort((a, b) => a[0] - b[0])
    .map(([yr, list]) => {
      const v = list.map((r) => r[m]!).sort((a, b) => a - b)
      // Linear between the two nearest values, so an even count's median is their mean.
      const q = (p: number) => {
        const h = p * (v.length - 1)
        const lo = Math.floor(h)
        return v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (h - lo)
      }
      return { yr, q: [q(0.1), q(0.25), q(0.5), q(0.75), q(0.9)] }
    })
}

const BANDS = [shade(3, 5), shade(1, 5), focal(true)]

function LibraryTrend() {
  const data = useData<Belonging>('sweden/belonging/municipalities.json')
  const [m, setM] = useState<Rate>('active_borrowers_rate')
  return (
    <Frame data={data}>
      {(d) => {
        const qs = quantiles(d, m)
        const ax = axis(
          qs.map((q) => q.q[4]),
          [176, 12],
        )
        const x = scale([0, qs.length - 1], [34, 250])
        const xs = qs.map((_, i) => x(i))
        const at = (j: number) => qs.map((q) => ax.y(q.q[j]))
        const last = qs.at(-1)
        if (!last) return null
        return (
          <>
            <Slicer
              label={l('Rate', 'Mått')}
              options={Object.keys(LIBRARY_RATES) as Rate[]}
              format={rate}
              value={m}
              onChange={setM}
            />
            <Svg
              label={l(
                `${rate(m)} across municipalities: median with the middle 50 and 80 percent`,
                `${rate(m)} i kommunerna: median med mittersta 50 och 80 procent`,
              )}
            >
              <YAxis
                y={ax.y}
                ticks={ax.ticks}
                x0={34}
                x1={250}
                format={(v) => fmt(v, 1)}
              />
              <path d={band(xs, at(4), at(0))} fill={BANDS[0]} />
              <path d={band(xs, at(3), at(1))} fill={BANDS[1]} />
              <path
                d={path(qs.map((q, i) => [x(i), ax.y(q.q[2])]))}
                fill="none"
                stroke={BANDS[2]}
                strokeWidth={2}
              />
              <EndLabels
                x={255}
                top={12}
                bottom={176}
                items={[{ y: ax.y(last.q[2]), label: fmt(last.q[2], 1) }]}
              />
              <XAxis
                x={x}
                y={194}
                ticks={qs
                  .map((q, i) => ({ value: i, label: String(q.yr) }))
                  .filter((_, i) => i % 4 === 0 || i === qs.length - 1)}
              />
            </Svg>
            <Legend
              items={[
                l('Median', 'Median'),
                l('Middle 50%', 'Mittersta 50 %'),
                l('Middle 80%', 'Mittersta 80 %'),
              ]}
              colors={[BANDS[2], BANDS[1], BANDS[0]]}
            />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-library-map',
    domain: 'sweden',
    sources: ['sweden/belonging/libraries.json'],
    size: 'tall',
    title: (d: Libraries) => {
      const libs = located(d)
      if (!libs.length)
        return l('Public libraries in Sweden', 'Folkbibliotek i Sverige')
      const both = libs.filter((b) => b.type === 'folkskolbib').length
      return l(
        `${count(libs.length)} public libraries on the map; ${both} of them are combined public and school libraries`,
        `${count(libs.length)} folkbibliotek på kartan; ${both} av dem är kombinerade folk- och skolbibliotek`,
      )
    },
    note: [
      'One dot per library; accent: combined public and school libraries. Source: KB library statistics',
      'En punkt per bibliotek; markerade: kombinerade folk- och skolbibliotek. Källa: KB:s biblioteksstatistik',
    ],
    render: () => <LibraryMap />,
  },
  {
    id: 'wel-connections-scatter',
    domain: 'sweden',
    sources: ['sweden/connections/connections.json'],
    title: (d: Connections) => {
      const r = scattered(d)
      const rho = r?.result.rho
      if (!r || !num(rho))
        return l(
          'Library visits and income by municipality',
          'Biblioteksbesök och inkomst per kommun',
        )
      const how =
        Math.abs(rho) < 0.3
          ? l('barely track', 'följer knappt')
          : rho > 0
            ? l('rise with', 'ökar med')
            : l('fall with', 'minskar med')
      const n = r.result.n ?? r.result.points!.length
      return l(
        `Library visits ${how} median income across ${n} municipalities (ρ = ${fmt(rho, 2)})`,
        `Biblioteksbesöken ${how} medianinkomsten i ${n} kommuner (ρ = ${fmt(rho, 2)})`,
      )
    },
    note: [
      'Across: median earned income, SEK. Up: library visits per inhabitant. ρ: rank correlation. Sources: Kolada, KB',
      'Vågrätt: medianförvärvsinkomst, kr. Lodrätt: biblioteksbesök per invånare. ρ: rangkorrelation. Källor: Kolada, KB',
    ],
    render: () => <Relation />,
  },
  {
    id: 'wel-library-bands',
    domain: 'sweden',
    sources: ['sweden/belonging/municipalities.json'],
    title: (d: Belonging) => {
      const qs = quantiles(d, 'active_borrowers_rate')
      if (qs.length < 2)
        return l(
          'Active library borrowers per municipality',
          'Aktiva låntagare per kommun',
        )
      const [a, b] = [qs[0], qs.at(-1)!]
      const [from, to] = [fmt(a.q[2], 1), fmt(b.q[2], 1)]
      const fell = b.q[2] < a.q[2]
      const change =
        from === to
          ? l(`stayed at ${to}`, `låg kvar på ${to}`)
          : l(
              `${fell ? 'fell' : 'rose'} from ${from} to ${to}`,
              `${fell ? 'minskade' : 'ökade'} från ${from} till ${to}`,
            )
      return l(
        `Library borrowers per 100 people ${change}, ${a.yr}–${b.yr}`,
        `Låntagare per 100 invånare ${change}, ${a.yr}–${b.yr}`,
      )
    },
    note: [
      'Active borrowers, median across municipalities by year; bands: the middle 50% and 80%. Source: KB library statistics',
      'Aktiva låntagare, median över kommunerna per år; band: mittersta 50 % och 80 %. Källa: KB:s biblioteksstatistik',
    ],
    render: () => <LibraryTrend />,
  },
]
