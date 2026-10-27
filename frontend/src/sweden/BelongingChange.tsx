/**
 * D before and after 2019 (sweden/belonging/change.json, export_belonging.py's change()): the
 * visits headline split into 2014–2019 and 2019–2025, and the change by SKR municipality group
 * as two small multiples on one scale. Split from Belonging.tsx, which keeps data, other findings
 * and the map. Every number is the export's; this file only words and draws them.
 */
import { l } from '../i18n'
import RankBars from '../charts/RankBars'
import type { Finding } from './template'

/** SKR's 2023 municipality groups in SKR's own English; the data carries the Swedish names. */
const SKR_EN: Record<string, string> = {
  Storstäder: 'Large cities',
  'Pendlingskommun nära storstad': 'Commuter municipality near a large city',
  'Större stad': 'Medium-sized town',
  'Pendlingskommun nära större stad':
    'Commuter municipality near a medium-sized town',
  'Lågpendlingskommun nära större stad':
    'Low-commuting municipality near a medium-sized town',
  'Mindre stad/tätort': 'Small town or urban area',
  'Pendlingskommun nära mindre tätort':
    'Commuter municipality near a small town',
  'Landsbygdskommun, ej nära större stad': 'Rural municipality',
  'Landsbygdskommun med besöksnäring':
    'Rural municipality with a visitor industry',
}
export const skrName = (g: string) => l(SKR_EN[g] ?? g, g)

type Total = { n: number; from: number; to: number; change_pct: number | null }
type Median = { n: number; median: number; ci95: [number, number] }
type Slope = {
  years: [number, number]
  municipalities: number
  log_visits_per_service_point: number
  ci95_county_bootstrap: [number, number]
}
export type Change = {
  balanced_visits: { municipalities: number; totals: Record<string, number> }
  periods: {
    from: number
    to: number
    visits: Record<'balanced' | 'paired' | 'zeros_restored', Total>
  }[]
  lost_service_point: {
    years: [number, number]
    n: number
    lost_a_point: number
    median_visit_change_pct: { lost: number; rest: number }
  }
  recovery: {
    from: number
    to: number
    all: Median
    groups: Record<string, Median>
  }[]
  within: Slope[]
  supply_use: Record<
    string,
    { n: number; rho: number; partial_rho_log_population: number }
  >
}

const pct = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 1 })} %`
const ratio = (r: number) => pct(Math.round((r - 1) * 1000) / 10)
const slope = (b: number) => pct(Math.round(Math.expm1(b) * 1000) / 10)
/** The visits sentence and its values for the decline finding. */
export function visitsSplit(c: Change) {
  const [early, late] = c.periods
  const lost = c.lost_service_point
  const { lost: a, rest: b } = lost.median_visit_change_pct
  // Within 2 percentage points reads as "about as much": a stated convention, not a test.
  const same = Math.abs(a - b) < 2
  const n = c.balanced_visits.municipalities
  const t = c.balanced_visits.totals
  const mn = (y: number) =>
    (t[y] / 1e6).toLocaleString(l('en-GB', 'sv-SE'), {
      maximumFractionDigits: 1,
    })
  return {
    statement: l(
      `In the ${n} municipalities reporting visits every year, physical visits changed ${pct(early.visits.balanced.change_pct ?? 0)} from ${early.from} to ${early.to} and ${pct(late.visits.balanced.change_pct ?? 0)} from ${late.from} to ${late.to}. Before ${early.to + 1}, municipalities that lost a service point saw visits change ${same ? 'about as much as' : a < b ? 'more than' : 'less than'} the rest (median ${pct(a)} against ${pct(b)}).`,
      `I de ${n} kommuner som rapporterat besök varje år förändrades de fysiska besöken med ${pct(early.visits.balanced.change_pct ?? 0)} från ${early.from} till ${early.to} och ${pct(late.visits.balanced.change_pct ?? 0)} från ${late.from} till ${late.to}. Före ${early.to + 1} förändrades besöken i kommuner som förlorade ett serviceställe ${same ? 'ungefär lika mycket som' : a < b ? 'mer än' : 'mindre än'} i övriga (median ${pct(a)} mot ${pct(b)}).`,
    ),
    values: (
      <>
        <li>
          {l('Visits', 'Besök')}: {mn(early.from)} → {mn(early.to)} →{' '}
          {mn(late.to)} {l('million', 'miljoner')}, {n}{' '}
          {l(
            'municipalities reporting every year',
            'kommuner som rapporterat varje år',
          )}
        </li>
        <li>
          {l(
            'All municipalities reporting both years',
            'Alla kommuner som rapporterat båda åren',
          )}
          : {pct(early.visits.paired.change_pct ?? 0)} ({early.visits.paired.n})
          · {pct(late.visits.paired.change_pct ?? 0)} ({late.visits.paired.n});{' '}
          {l(
            'with the repaired zeros counted as 0',
            'med de rättade nollorna räknade som 0',
          )}
          : {pct(early.visits.zeros_restored.change_pct ?? 0)} ·{' '}
          {pct(late.visits.zeros_restored.change_pct ?? 0)}
        </li>
        <li>
          {l(
            `${lost.lost_a_point} of ${lost.n} municipalities lost a staffed service point ${lost.years[0]}–${lost.years[1]}`,
            `${lost.lost_a_point} av ${lost.n} kommuner förlorade ett bemannat serviceställe ${lost.years[0]}–${lost.years[1]}`,
          )}
        </li>
      </>
    ),
  }
}

/** Median change in visits per SKR group, before and after 2019, as two small multiples. */
export function recoveryFinding(c: Change): Finding {
  const [early, late] = c.recovery
  const meds = (p: Change['recovery'][number]) =>
    Object.values(p.groups).map((g) => g.median)
  const lo = Math.min(...meds(late))
  const hi = Math.max(...meds(late))
  const top = Math.max(
    ...[...meds(early), ...meds(late)].map((m) => Math.abs(m - 1) * 100),
  )
  const panel = (p: Change['recovery'][number]) => (
    <>
      <p>
        <b>
          {p.from}–{p.to}
        </b>
      </p>
      <RankBars
        label={l(
          `Median change in visits per municipality, ${p.from}–${p.to}, by SKR group`,
          `Medianförändring i besök per kommun, ${p.from}–${p.to}, per SKR-grupp`,
        )}
        format={(v) => pct(Math.round(v * 10) / 10)}
        max={top}
        rows={Object.entries(p.groups).map(([g, m]) => ({
          key: g,
          label: skrName(g),
          value: (m.median - 1) * 100,
          note: `${ratio(m.ci95[0])} ${l('to', 'till')} ${ratio(m.ci95[1])}, ${m.n} ${l('municipalities', 'kommuner')}`,
        }))}
      />
    </>
  )
  const [full, before] = c.within
  return {
    key: 'recovery',
    statement: l(
      `From ${late.from} to ${late.to} the median municipality's visits changed ${ratio(late.all.median)}, against ${ratio(early.all.median)} from ${early.from} to ${early.to}. By SKR group the ${late.from}–${late.to} medians run from ${ratio(lo)} to ${ratio(hi)}.`,
      `Från ${late.from} till ${late.to} förändrades besöken i mediankommunen med ${ratio(late.all.median)}, mot ${ratio(early.all.median)} från ${early.from} till ${early.to}. Per SKR-grupp ligger medianerna ${late.from}–${late.to} mellan ${ratio(lo)} och ${ratio(hi)}.`,
    ),
    values: (
      <>
        {panel(early)}
        {panel(late)}
        <p>
          {l(
            `Bars: median change; text: 95 % bootstrap interval. Within municipalities (fixed effects for municipality and year), one more staffed service point goes with ${slope(full.log_visits_per_service_point)} visits, ${full.years[0]}–${full.years[1]} (county-bootstrap interval ${slope(full.ci95_county_bootstrap[0])} to ${slope(full.ci95_county_bootstrap[1])}, ${full.municipalities} municipalities); ${before.years[0]}–${before.years[1]}: ${slope(before.log_visits_per_service_point)} (${slope(before.ci95_county_bootstrap[0])} to ${slope(before.ci95_county_bootstrap[1])}).`,
            `Staplar: medianförändring; text: 95 % bootstrapintervall. Inom kommuner (fixa effekter för kommun och år) går ett bemannat serviceställe till med ${slope(full.log_visits_per_service_point)} besök, ${full.years[0]}–${full.years[1]} (länsvis bootstrapintervall ${slope(full.ci95_county_bootstrap[0])} till ${slope(full.ci95_county_bootstrap[1])}, ${full.municipalities} kommuner); ${before.years[0]}–${before.years[1]}: ${slope(before.log_visits_per_service_point)} (${slope(before.ci95_county_bootstrap[0])} till ${slope(before.ci95_county_bootstrap[1])}).`,
          )}
        </p>
      </>
    ),
    evidence: 'descriptive',
    source: l(
      "KB library statistics; SKR's municipality groups",
      'KB:s biblioteksstatistik; SKR:s kommungrupper',
    ),
  }
}
