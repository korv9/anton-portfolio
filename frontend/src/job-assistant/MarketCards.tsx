/**
 * The market tab's ranked cards: time to close (job-assistant/time-to-close.json), technology
 * shares (jobs/skill-trends.json), rising and falling terms (jobs/rising-terms.json), the
 * employers that post the most (jobs/employer-top.json) and the current ads by fit
 * (job-assistant/matches.json). Each returns nothing when its file or rows are missing.
 */
import { l } from '../i18n'
import { ChartCard } from '../ui/dash/Dash'
import { Pick } from '../charts/feature/Feature'
import RankBars from '../charts/RankBars'
import type { Delivered } from './data'
import { fitName, monthName, num } from './labels'
import {
  closeRows,
  families,
  funnel,
  termFamilies,
  type EmployerTop,
  type Outcome,
  type RisingTerms,
  type SkillTrends,
  type Term,
  type TimeToClose,
} from './market-figures'
import type { MarketView, SetView } from './Market'

type Props = { view: MarketView; set: SetView }
const pick = (value: string, options: string[]) =>
  options.includes(value) ? value : options[0]

const OUTCOMES: Partial<Record<Outcome, [string, string]>> = {
  before_deadline: [
    'Removed before the deadline',
    'Borttagen före sista dagen',
  ],
  to_deadline: ['Ran to the deadline', 'Låg kvar till sista dagen'],
}

export function Closing({ t, view, set }: Props & { t?: TimeToClose }) {
  const outcomes = (Object.keys(OUTCOMES) as Outcome[]).filter(
    (o) => closeRows(t, o).length,
  )
  if (!t || !outcomes.length) return null
  const outcome = pick(view.close, outcomes) as Outcome
  const days = (d: number) => l(`${num(d, 1)} days`, `${num(d, 1)} dagar`)
  return (
    <ChartCard
      span={6}
      title={l(
        'Days from publication to removal',
        'Dagar från publicering till borttagning',
      )}
      sub={l(
        `Median per occupation, over the Data/IT ads removed in the last ${t.window_days} days. The archives carry no removal date, so only the stream is counted.`,
        `Median per yrke, över de Data/IT-annonser som togs bort de senaste ${t.window_days} dagarna. Arkiven har inget borttagningsdatum, så bara strömmen räknas.`,
      )}
      foot={l(
        `A median is shown only over at least ${t.min_ads} ads. An ad removed before its deadline is usually filled or withdrawn.`,
        `En median visas bara över minst ${t.min_ads} annonser. En annons som tas bort före sista dagen är oftast tillsatt eller återkallad.`,
      )}
    >
      {outcomes.length > 1 && (
        <Pick
          label={l('Outcome', 'Utfall')}
          value={outcome}
          options={outcomes.map((o) => ({
            value: o,
            label: l(...OUTCOMES[o]!),
          }))}
          onChange={(o) => set({ close: o })}
        />
      )}
      <RankBars
        label={l(
          `Median days open per occupation: ${l(...OUTCOMES[outcome]!).toLocaleLowerCase()}`,
          `Mediandagar öppen per yrke: ${l(...OUTCOMES[outcome]!).toLocaleLowerCase()}`,
        )}
        rows={closeRows(t, outcome).map((r) => ({
          key: r.occupation,
          label:
            r.occupation === 'all'
              ? l('All Data/IT ads', 'Alla Data/IT-annonser')
              : r.occupation,
          value: r.median_days_open!,
          note: l(`${num(r.ads)} ads`, `${num(r.ads)} annonser`),
        }))}
        format={days}
      />
    </ChartCard>
  )
}

export function Technologies({ s, view, set }: Props & { s?: SkillTrends }) {
  const options = families(s)
  if (!s || !options.length) return null
  const family = pick(view.tech, options)
  const month = monthName(s.month)
  const pp = (v: number) => `${v > 0 ? '+' : ''}${num(v, 1)} ${l('pp', 'p.e.')}`
  return (
    <ChartCard
      span={6}
      title={l(
        'Technologies rising and falling',
        'Tekniker som ökar och minskar',
      )}
      sub={l(
        `Change in the share of ${family} ads that name each technology, ${month} against the same month a year before, in percentage points.`,
        `Förändring i andelen ${family}-annonser som nämner varje teknik, ${month} mot samma månad ett år före, i procentenheter.`,
      )}
      slicer={{
        label: l('Role', 'Roll'),
        value: family,
        options: options.map((f) => ({ value: f, label: f })),
        onChange: (v) => set({ tech: v }),
      }}
      foot={l(
        'Only technologies named in at least five of at least 20 ads of the role, with the month a year before complete. A descriptive threshold, not a significance test.',
        'Bara tekniker som nämns i minst fem av minst 20 annonser för rollen, med månaden ett år före komplett. En beskrivande gräns, inte ett signifikanstest.',
      )}
    >
      <RankBars
        label={l(
          `Change in technology share, ${family} ads, ${month}`,
          `Förändring i teknikandel, ${family}-annonser, ${month}`,
        )}
        rows={s.rows
          .filter((r) => r.role_family === family)
          .sort((a, b) => b.share_yoy_pp - a.share_yoy_pp)
          .map((r) => ({
            key: r.skill,
            label: r.skill,
            value: r.share_yoy_pp,
            note: l(
              `${num(r.skill_share * 100)} % of ${num(r.total_ads)}`,
              `${num(r.skill_share * 100)} % av ${num(r.total_ads)}`,
            ),
          }))}
        format={pp}
      />
    </ChartCard>
  )
}

function TermBars({ title, terms }: { title: string; terms: Term[] }) {
  if (!terms.length) return null
  return (
    <div>
      <h3>{title}</h3>
      <RankBars
        label={title}
        limit={10}
        rows={terms.map((t) => ({
          key: t.term,
          label: t.term,
          value: t.recent_uses,
          ref: t.before_uses,
          note: l(
            `from ${num(t.before_uses)}, ${num(t.employers)} employers`,
            `från ${num(t.before_uses)}, ${num(t.employers)} arbetsgivare`,
          ),
        }))}
        format={(v) => num(v)}
      />
    </div>
  )
}

export function Terms({ t, view, set }: Props & { t?: RisingTerms }) {
  const rows = termFamilies(t)
  if (!t || !rows.length) return null
  const family = pick(
    view.terms,
    rows.map((r) => r.role_family),
  )
  const row = rows.find((r) => r.role_family === family)!
  const recent = `${t.recent.from} – ${t.recent.to}`
  const before = `${t.before.from} – ${t.before.to}`
  return (
    <ChartCard
      title={l('Words and phrases rising', 'Ord och fraser som ökar')}
      sub={l(
        `Words and two-word phrases in the texts of ${family} ads, ${recent} against ${before}. The bar is the uses in ${recent}, the tick the uses in ${before}.`,
        `Ord och tvåordsfraser i texterna i ${family}-annonser, ${recent} mot ${before}. Stapeln är användningar ${recent}, strecket användningar ${before}.`,
      )}
      slicer={{
        label: l('Role', 'Roll'),
        value: family,
        options: rows.map((r) => ({
          value: r.role_family,
          label: r.role_family,
        })),
        onChange: (v) => set({ terms: v }),
      }}
      foot={l(
        'Ranked by weighted log-odds against the window before. Function words, numbers, ad boilerplate, employer and place names, and terms one employer wrote most of are left out; at least 20 uses by at least 10 employers.',
        'Rangordnade med viktade log-odds mot fönstret före. Funktionsord, tal, annonsfraser, arbetsgivar- och ortnamn samt ord som en arbetsgivare skrev de flesta av är bortplockade; minst 20 användningar av minst 10 arbetsgivare.',
      )}
    >
      <div className="ja-market-pair">
        <TermBars title={l('Used more', 'Används mer')} terms={row.rising} />
        <TermBars
          title={l('Used less', 'Används mindre')}
          terms={row.falling}
        />
      </div>
    </ChartCard>
  )
}

/** 2025-01-01 to 2026-01-01 (exclusive) as "January 2025 – December 2025". */
function periodName(r: EmployerTop['rows'][number]) {
  const until = new Date(r.until + 'T12:00:00Z')
  until.setUTCMonth(until.getUTCMonth() - 1)
  const name =
    r.period_kind === 'year'
      ? l(`Year ${r.from.slice(0, 4)}`, `År ${r.from.slice(0, 4)}`)
      : `${monthName(r.from)} – ${monthName(until.toISOString())}`
  return r.complete ? name : l(`${name}, incomplete`, `${name}, ofullständigt`)
}

export function Employers({ e, view, set }: Props & { e?: EmployerTop }) {
  const rows = e?.rows.filter((r) => r.employers.length) ?? []
  if (!rows.length) return null
  const kind = pick(
    view.employers,
    rows.map((r) => r.period_kind),
  )
  const row = rows.find((r) => r.period_kind === kind)!
  return (
    <ChartCard
      span={6}
      title={l(
        'Employers that posted the most IT ads',
        'Arbetsgivare som publicerade flest IT-annonser',
      )}
      sub={l(
        `${periodName(row)}. The list counts who posted the ad, often a staffing or consultancy firm, not who hires.`,
        `${periodName(row)}. Listan räknar vem som publicerade annonsen, ofta ett bemannings- eller konsultbolag, inte vem som anställer.`,
      )}
    >
      {rows.length > 1 && (
        <Pick
          label={l('Period', 'Period')}
          value={kind}
          options={rows.map((r) => ({
            value: r.period_kind,
            label: periodName(r),
          }))}
          onChange={(v) => set({ employers: v })}
        />
      )}
      <RankBars
        label={l(
          `Ads per employer, ${periodName(row)}`,
          `Annonser per arbetsgivare, ${periodName(row)}`,
        )}
        limit={10}
        rows={row.employers.map((x) => ({
          key: x.employer,
          label: x.employer,
          value: x.ads,
        }))}
        format={(v) => num(v)}
      />
    </ChartCard>
  )
}

export function Funnel({ data }: { data: Delivered }) {
  const { matches, profile } = data.matches
  if (!profile || !matches.length) return null
  return (
    <ChartCard
      span={6}
      title={l('Current ads by fit', 'Aktuella annonser efter passform')}
      sub={l(
        `The ${num(matches.length)} current Data/IT ads matched against CV profile v${profile.profile_version}, from outside the search to a good fit. Each ad has one fit.`,
        `De ${num(matches.length)} aktuella Data/IT-annonserna matchade mot cv-profil v${profile.profile_version}, från utanför sökningen till passar bra. Varje annons har en passform.`,
      )}
    >
      <RankBars
        label={l('Current ads per fit', 'Aktuella annonser per passform')}
        rows={funnel(matches).map((r) => ({
          key: r.class,
          label: fitName(r.class),
          value: r.ads,
        }))}
        format={(v) => num(v)}
      />
    </ChartCard>
  )
}
