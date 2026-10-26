/** State budget: the opposition's alternative budgets, and how far outturn lands from plan. */
import { l } from '../../i18n'
import { focal, Frame, OTHER, useData, type Post } from '../kit'
import { partyName } from '../../parties/identity'
import { Bars, pct, signed } from './pol-kit'

type Budgets = {
  data: { budget_year: number; actor: string; deviation_msek: number | null }[]
}
type Outturn = {
  data: {
    budget_year: number
    expenditure_area: number
    expenditure_area_name: string
    approved_budget_msek: number
    outturn_msek: number
  }[]
}

const BUDGETS = 'debates/budgets/summary.json'
const OUTTURN = 'politics/parliament/budgets/outturn-areas.json'

/** The Government Offices' English names for the 27 expenditure areas. */
const AREA: Record<number, string> = {
  1: 'Swedish system of government',
  2: 'Economy and financial administration',
  3: 'Taxes, customs and enforcement',
  4: 'Justice',
  5: 'International cooperation',
  6: 'Defence and civil contingencies',
  7: 'International development cooperation',
  8: 'Migration',
  9: 'Health care and social services',
  10: 'Financial security in illness and disability',
  11: 'Financial security in old age',
  12: 'Financial security for families and children',
  13: 'Integration and gender equality',
  14: 'Labour market and working life',
  15: 'Student finance',
  16: 'Education and academic research',
  17: 'Culture, media and leisure',
  18: 'Housing, community planning and consumer policy',
  19: 'Regional growth',
  20: 'Climate, environment and nature',
  21: 'Energy',
  22: 'Communications',
  23: 'Rural affairs and food',
  24: 'Enterprise',
  25: 'General grants to municipalities',
  26: 'Interest on central government debt',
  27: 'Contribution to the EU',
}

const bn = (msek: number) => `${signed(msek / 1000, 0)} ${l('bn', 'mdkr')}`

/** Each opposition party's total change to the government's spending in the latest year. */
function deviations(d: Budgets) {
  const year = Math.max(...d.data.map((r) => r.budget_year))
  const m = new Map<string, number>()
  for (const r of d.data)
    if (r.budget_year === year && r.actor !== 'GOV' && r.deviation_msek != null)
      m.set(r.actor, (m.get(r.actor) ?? 0) + r.deviation_msek)
  const rows = [...m]
    .map(([party, msek]) => ({ party, msek }))
    .sort((a, b) => b.msek - a.msek)
  return { year, rows }
}

function DeviationBars() {
  return (
    <Frame data={useData<Budgets>(BUDGETS)}>
      {(d) => {
        const { year, rows } = deviations(d)
        const top = Math.max(...rows.map((r) => Math.abs(r.msek)))
        return (
          <Bars
            wrap
            label={l(
              `Each party's change to the government's spending for ${year}, billion kronor`,
              `Varje partis ändring av regeringens utgifter för ${year}, miljarder kronor`,
            )}
            format={bn}
            rows={rows.map((r) => ({
              key: r.party,
              label: partyName(r.party),
              value: r.msek,
              color: Math.abs(r.msek) === top ? focal(true) : OTHER,
            }))}
          />
        )
      }}
    </Frame>
  )
}

/** Median gap between outturn and the approved budget per area, over every year with a budget. */
function gaps(d: Outturn) {
  const m = new Map<number, number[]>()
  for (const r of d.data)
    if (r.approved_budget_msek > 0)
      m.set(r.expenditure_area, [
        ...(m.get(r.expenditure_area) ?? []),
        Math.abs(r.outturn_msek / r.approved_budget_msek - 1),
      ])
  const median = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b)
    const h = s.length >> 1
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2
  }
  const years = d.data.map((r) => r.budget_year)
  return {
    from: Math.min(...years),
    to: Math.max(...years),
    rows: [...m]
      .map(([area, v]) => ({ area, gap: median(v) }))
      .sort((a, b) => b.gap - a.gap),
  }
}
/** The area's name: English from AREA, Swedish as the data names it. */
const areaName = (d: Outturn, area: number) => {
  const sv = d.data.find(
    (r) => r.expenditure_area === area,
  )?.expenditure_area_name
  return l(AREA[area] ?? sv ?? String(area), sv ?? AREA[area] ?? String(area))
}

function OutturnBars() {
  return (
    <Frame data={useData<Outturn>(OUTTURN)}>
      {(d) => (
        <Bars
          wrap
          label={l(
            'Median gap between outturn and approved budget per expenditure area',
            'Medianavvikelse mellan utfall och beslutad budget per utgiftsområde',
          )}
          format={(v) => pct(v * 100)}
          rows={gaps(d).rows.map((r, i) => ({
            key: String(r.area),
            label: areaName(d, r.area),
            value: r.gap,
            color: i ? OTHER : focal(true),
          }))}
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-budget-deviation-bars',
    domain: 'politics',
    sources: ['debates/budgets/summary.json'],
    size: 'wide',
    title: (d: Budgets) => {
      const { year, rows } = deviations(d)
      const [hi, lo] = [rows[0], rows.at(-1)]
      if (!hi || !lo || hi === lo)
        return l(
          'Alternative budgets against the government’s',
          'Alternativa budgetar mot regeringens',
        )
      // Each end reads by its own sign: a party can add to or cut the government's spending.
      const bnOf = (msek: number) => Math.abs(Math.round(msek / 1000))
      const side = (msek: number) =>
        l(
          `${bnOf(msek)} bn ${msek < 0 ? 'less' : 'more'}`,
          `${bnOf(msek)} miljarder ${msek < 0 ? 'mindre' : 'mer'}`,
        )
      return l(
        `The ${partyName(hi.party)} would spend ${side(hi.msek)} than the government in ${year}; the ${partyName(lo.party)} ${side(lo.msek)}`,
        `${partyName(hi.party)} skulle lägga ${side(hi.msek)} än regeringen ${year}; ${partyName(lo.party)} ${side(lo.msek)}`,
      )
    },
    note: [
      'Each party’s changes to government spending, SEK billion. Source: Riksdagen',
      'Varje partis ändringar av regeringens utgifter, miljarder kronor. Källa: Riksdagen',
    ],
    render: () => <DeviationBars />,
  },
  {
    id: 'pol-budget-outturn-multiples',
    domain: 'politics',
    sources: ['politics/parliament/budgets/outturn-areas.json'],
    title: (d: Outturn) => {
      const { rows } = gaps(d)
      const [hi, lo] = [rows[0], rows.at(-1)]
      return hi && lo
        ? l(
            `${areaName(d, hi.area)} lands furthest from its first approved budget, a median ${pct(hi.gap * 100, 0)} a year; ${areaName(d, lo.area).toLowerCase()} ${pct(lo.gap * 100)}`,
            `${areaName(d, hi.area)} hamnar längst från sin först beslutade budget, i median ${pct(hi.gap * 100, 0)} per år; ${areaName(d, lo.area).toLowerCase()} ${pct(lo.gap * 100)}`,
          )
        : l(
            'How far spending lands from the first approved budget',
            'Hur långt utfallet hamnar från den först beslutade budgeten',
          )
    },
    note: [
      'Median gap between outturn and first approved budget, per area and year. Source: Statskontoret',
      'Medianavvikelse mellan utfall och först beslutad budget, per område och år. Källa: Statskontoret',
    ],
    render: () => <OutturnBars />,
  },
]
