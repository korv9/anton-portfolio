/** Cluster checks on Sweden: whether municipal neighbours agree, and Sweden's tax mix. */
import { focal, Frame, OTHER, useData, type Post } from '../kit'

import RankBars from '../../charts/RankBars'
import { fmt, pct } from './wel-kit'

type Test = {
  pair: [string, string]
  r: number
  partial_r: number
  range: { r: [number, number] }
}
type Swedens = { diagnostics: { n: number; tests: Test[] } }
type TaxMix = {
  method: { floor: number; latest_year: Record<string, number> }
  clusters: {
    size: number
    members: string[]
    mean_share: Record<string, number>
  }[]
}
type Countries = { rows: [string, number, string, number][] }

const SWEDENS = 'clusters/three-swedens.json'
const TAX_MIX = 'clusters/tax-mix.json'
const COUNTRIES = 'taxes/countries.json'

const SPACE: Record<string, string> = {
  social: 'Social profile',
  jobs: 'Job ads',
  votes: 'Votes',
}
const pairName = (t: Test) =>
  t.pair
    .map((p, i) => (i ? (SPACE[p] ?? p).toLowerCase() : (SPACE[p] ?? p)))
    .join(' and ')
const r2 = (v: number) => fmt(v, 2)
const ranked = (d: Swedens) =>
  [...d.diagnostics.tests].sort((a, b) => b.r - a.r)

/** r per pair of spaces as ranked bars; the tick on each track is r once geography is removed. */
function NeighbourBars() {
  return (
    <Frame data={useData<Swedens>(SWEDENS)}>
      {(d) => (
        <div className="mean-bars mean-wel-wrap">
          <RankBars
            label="Mantel correlation between municipal distance matrices, per pair of spaces"
            format={r2}
            max={1}
            rows={ranked(d).map((t, i) => ({
              key: pairName(t),
              label: pairName(t),
              value: t.r,
              color: focal(i === 0),
              ref: t.partial_r,
            }))}
          />
        </div>
      )}
    </Frame>
  )
}

/** Tax parts as tax-mix.py builds them from OECD codes, each a share of total tax. */
const PARTS: [string, string, (c: Record<string, number>) => number][] = [
  ['personal_income', 'Personal income', (c) => c.T_1100],
  ['social_security', 'Social security', (c) => c.T_2000],
  ['vat', 'VAT', (c) => c.T_5111],
  ['payroll', 'Payroll', (c) => c.T_3000],
  ['corporate_income', 'Corporate income', (c) => c.T_1200],
  [
    'other_goods_services',
    'Other goods and services',
    (c) => c.T_5000 - c.T_5111,
  ],
  ['property', 'Property', (c) => c.T_4000],
  ['other_income', 'Other income', (c) => c.T_1000 - c.T_1100 - c.T_1200],
  ['other', 'Other', (c) => c.T_6000],
]

/** Sweden's nine shares in the year the clustering used, clipped and closed as tax_mix.py does. */
function swedenMix(c: Countries, year: number, floor: number) {
  const codes: Record<string, number> = {}
  for (const [cc, y, code, v] of c.rows)
    if (cc === 'SWE' && y === year) codes[code] = v
  // Every code a part reads must be there, or a bar would be NaN.
  const need = ['_T', 'T_1000', 'T_1100', 'T_1200', 'T_2000', 'T_3000']
  need.push('T_4000', 'T_5000', 'T_5111', 'T_6000')
  if (!need.every((k) => Number.isFinite(codes[k])) || !(codes._T > 0))
    return null
  const raw = PARTS.map(
    ([k, , f]) =>
      [k, Math.max(floor, Math.max(0, f(codes)) / codes._T)] as const,
  )
  const total = raw.reduce((a, [, v]) => a + v, 0)
  return Object.fromEntries(raw.map(([k, v]) => [k, v / total]))
}

/** Sweden's share per part as bars, largest first; the tick is the mean of its cluster. */
function MixBars() {
  const mix = useData<TaxMix>(TAX_MIX)
  const countries = useData<Countries>(COUNTRIES)
  return (
    <Frame data={mix}>
      {(m) => (
        <Frame data={countries}>
          {(c) => {
            const group = m.clusters.find((k) => k.members.includes('SWE'))
            const year = m.method.latest_year.SWE
            const swe =
              group && year ? swedenMix(c, year, m.method.floor) : null
            if (!group || !swe) return null
            // The part where Sweden differs most from its group takes the accent.
            const gap = (k: string) => Math.abs(swe[k] - group.mean_share[k])
            const widest = PARTS.map(([k]) => k).sort(
              (a, b) => gap(b) - gap(a),
            )[0]
            return (
              <div className="mean-bars mean-wel-wrap">
                <RankBars
                  label={`Sweden's tax mix in ${year}, with the mean of its ${group.size}-country group as a tick`}
                  format={(v) => pct(v * 100, 0)}
                  rows={PARTS.map(([k, name]) => ({
                    key: k,
                    label: name,
                    value: swe[k],
                    color: k === widest ? focal(true) : OTHER,
                    ref: group.mean_share[k],
                  })).sort((a, b) => b.value - a.value)}
                />
              </div>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-three-swedens-bars',
    domain: 'sweden',
    sources: ['clusters/three-swedens.json'],
    title: (d: Swedens) => {
      const [top, ...rest] = ranked(d)
      return top && rest.length
        ? `Municipalities that are socially alike vote alike (r ${r2(top.r)}); their job ads match far less (r ${rest.map((t) => r2(t.r)).join(', ')})`
        : 'How far three maps of Swedish municipalities agree'
    },
    note: 'Bar: Mantel r between distance matrices of 246 municipalities; tick: r with geographic distance removed. Turnout is one of the social indicators, so part of the social–votes r is shared',
    render: () => <NeighbourBars />,
  },
  {
    id: 'wel-tax-mix-sweden-dots',
    domain: 'taxes',
    sources: ['clusters/tax-mix.json', 'taxes/countries.json'],
    size: 'wide',
    title:
      'Sweden raises a far larger share of its taxes as payroll tax than the OECD countries it clusters with',
    note: 'Bar: Sweden’s share of total tax per part, latest year; tick: mean of its 35-country cluster, Sweden included. The clustering is unstable under resampling, so read the group as loose. Source: OECD',
    render: () => <MixBars />,
  },
]
