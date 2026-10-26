/** Cluster checks on Sweden: whether municipal neighbours agree, and Sweden's tax mix. */
import { focal, Frame, OTHER, useData, type Post } from '../kit'
import { l } from '../../i18n'

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

const SPACE: Record<string, [string, string]> = {
  social: ['Social profile', 'Social profil'],
  jobs: ['Job ads', 'Jobbannonser'],
  votes: ['Votes', 'Röster'],
}
const space = (p: string) => (SPACE[p] ? l(...SPACE[p]) : p)
const pairName = (t: Test) =>
  t.pair
    .map((p, i) => (i ? space(p).toLowerCase() : space(p)))
    .join(l(' and ', ' och '))
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
            label={l(
              'Mantel correlation between municipal distance matrices, per pair of spaces',
              'Mantelkorrelation mellan kommunernas avståndsmatriser, per par av rum',
            )}
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
const PARTS: [
  string,
  readonly [string, string],
  (c: Record<string, number>) => number,
][] = [
  [
    'personal_income',
    ['Personal income', 'Inkomstskatt, personer'],
    (c) => c.T_1100,
  ],
  ['social_security', ['Social security', 'Socialavgifter'], (c) => c.T_2000],
  ['vat', ['VAT', 'Moms'], (c) => c.T_5111],
  ['payroll', ['Payroll', 'Löneskatt'], (c) => c.T_3000],
  ['corporate_income', ['Corporate income', 'Bolagsskatt'], (c) => c.T_1200],
  [
    'other_goods_services',
    ['Other goods and services', 'Övriga varor och tjänster'],
    (c) => c.T_5000 - c.T_5111,
  ],
  ['property', ['Property', 'Fastighet'], (c) => c.T_4000],
  [
    'other_income',
    ['Other income', 'Övrig inkomst'],
    (c) => c.T_1000 - c.T_1100 - c.T_1200,
  ],
  ['other', ['Other', 'Övrigt'], (c) => c.T_6000],
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
                  label={l(
                    `Sweden's tax mix in ${year}, with the mean of its ${group.size}-country group as a tick`,
                    `Sveriges skattemix ${year}, med snittet för dess grupp på ${group.size} länder som streck`,
                  )}
                  format={(v) => pct(v * 100, 0)}
                  rows={PARTS.map(([k, name]) => ({
                    key: k,
                    label: l(...name),
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
        ? l(
            `Municipalities that are socially alike vote alike (r ${r2(top.r)}); their job ads match far less (r ${rest.map((t) => r2(t.r)).join(', ')})`,
            `Kommuner som liknar varandra socialt röstar lika (r ${r2(top.r)}); deras jobbannonser stämmer mycket sämre överens (r ${rest.map((t) => r2(t.r)).join('; ')})`,
          )
        : l(
            'How far three maps of Swedish municipalities agree',
            'Hur väl tre kartor över Sveriges kommuner stämmer överens',
          )
    },
    note: [
      'Bar: Mantel r between distance matrices of 246 municipalities; tick: r with geographic distance removed. Turnout is one of the social indicators, so part of the social–votes r is shared',
      'Stapel: Mantels r mellan avståndsmatriser för 246 kommuner; streck: r när det geografiska avståndet räknats bort. Valdeltagandet är en av de sociala indikatorerna, så en del av r mellan socialt och röster är gemensam',
    ],
    render: () => <NeighbourBars />,
  },
  {
    id: 'wel-tax-mix-sweden-dots',
    domain: 'taxes',
    sources: ['clusters/tax-mix.json', 'taxes/countries.json'],
    size: 'wide',
    title: [
      'Sweden raises a far larger share of its taxes as payroll tax than the OECD countries it clusters with',
      'Sverige tar in en betydligt större del av skatterna som löneskatt än de OECD-länder det grupperas med',
    ],
    note: [
      'Bar: Sweden’s share of total tax per part, latest year; tick: mean of its 35-country cluster, Sweden included. The clustering is unstable under resampling, so read the group as loose. Source: OECD',
      'Stapel: Sveriges andel av de totala skatterna per del, senaste året; streck: snittet för dess kluster på 35 länder, Sverige inräknat. Klustringen är instabil vid omsampling, så läs gruppen som lös. Källa: OECD',
    ],
    render: () => <MixBars />,
  },
]
