/**
 * The market chart's ranked views: time to close (job-assistant/time-to-close.json), technology
 * shares (jobs/skill-trends.json), rising and falling terms (jobs/rising-terms.json), the
 * employers that post the most (jobs/employer-top.json) and the current ads by fit
 * (job-assistant/matches.json). Each returns null when its file or rows are missing.
 */
import { l } from '../i18n'
import { Pick } from '../charts/feature/Feature'
import RankBars from '../charts/RankBars'
import { SlicerSelect } from '../ui/dash/Dash'
import type { Delivered } from './data'
import { cap, fitName, monthName, num, pct } from './labels'
import {
  closeRows,
  families,
  funnel,
  termFamilies,
  type EmployerTop,
  type Outcome,
  type RisingTerms,
  type SkillTrends,
  type TimeToClose,
} from './market-figures'
import type { MarketView, SetView, Spec } from './Market'

type Props = { view: MarketView; set: SetView }
const pick = (value: string, options: string[]) =>
  options.includes(value) ? value : options[0]
const roleSlicer = (
  value: string,
  roles: string[],
  onChange: (v: string) => void,
) => (
  <SlicerSelect
    slicer={{
      label: l('Role', 'Roll'),
      value,
      options: roles.map((r) => ({ value: r, label: r })),
      onChange,
    }}
  />
)

const OUTCOMES: Partial<Record<Outcome, [string, string]>> = {
  before_deadline: [
    'Removed before the deadline',
    'Borttagen före sista dagen',
  ],
  to_deadline: ['Ran to the deadline', 'Låg kvar till sista dagen'],
}

export function closeSpec({
  t,
  view,
  set,
}: Props & { t?: TimeToClose }): Spec | null {
  const outcomes = (Object.keys(OUTCOMES) as Outcome[]).filter(
    (o) => closeRows(t, o).length,
  )
  if (!t || !outcomes.length) return null
  const outcome = pick(view.close, outcomes) as Outcome
  const name = l(...OUTCOMES[outcome]!)
  const title = l(
    `Median days open, Data/IT ads: ${name.toLocaleLowerCase()}`,
    `Mediandagar öppen, Data/IT-annonser: ${name.toLocaleLowerCase()}`,
  )
  return {
    title,
    controls: outcomes.length > 1 && (
      <Pick
        label={l('Outcome', 'Utfall')}
        value={outcome}
        options={outcomes.map((o) => ({ value: o, label: l(...OUTCOMES[o]!) }))}
        onChange={(o) => set({ close: o })}
      />
    ),
    chart: (
      <RankBars
        label={title}
        rows={closeRows(t, outcome).map((r) => ({
          key: r.occupation,
          label:
            r.occupation === 'all'
              ? l('All Data/IT ads', 'Alla Data/IT-annonser')
              : r.occupation,
          value: r.median_days_open!,
          note: l(`${num(r.ads)} ads`, `${num(r.ads)} annonser`),
        }))}
        format={(d) => l(`${num(d, 1)} days`, `${num(d, 1)} dagar`)}
      />
    ),
    notes: l(
      `Ads removed in the last ${t.window_days} days; a median needs at least ${t.min_ads} ads. Counting removals in a window gives long-running ads more weight than a full cohort would. The archives carry no removal date, so only the stream counts. An ad removed before its deadline is usually filled or withdrawn.`,
      `Annonser borttagna de senaste ${t.window_days} dagarna; en median kräver minst ${t.min_ads} annonser. Att räkna borttagningar i ett fönster ger annonser som legat länge större vikt än en hel årgång skulle. Arkiven har inget borttagningsdatum, så bara strömmen räknas. En annons som tas bort före sista dagen är oftast tillsatt eller återkallad.`,
    ),
    source: l('JobTech JobStream', 'JobTech JobStream'),
  }
}

export function techSpec({
  s,
  view,
  set,
}: Props & { s?: SkillTrends }): Spec | null {
  const roles = families(s)
  if (!s || !roles.length) return null
  const family = pick(view.tech, roles)
  const month = monthName(s.month)
  const title = l(
    `Change in technology share, ${family}, ${month} against a year before`,
    `Förändring i teknikandel, ${family}, ${month} mot ett år före`,
  )
  return {
    title,
    controls: roleSlicer(family, roles, (v) => set({ tech: v })),
    chart: (
      <RankBars
        label={title}
        rows={s.rows
          .filter((r) => r.role_family === family)
          .sort((a, b) => b.share_yoy_pp - a.share_yoy_pp)
          .map((r) => ({
            key: r.skill,
            label: r.skill,
            value: r.share_yoy_pp,
            note: l(
              `${pct(r.skill_share * 100)} of ${num(r.total_ads)}`,
              `${pct(r.skill_share * 100)} av ${num(r.total_ads)}`,
            ),
          }))}
        format={(v) => `${v > 0 ? '+' : ''}${num(v, 1)} ${l('pp', 'p.e.')}`}
      />
    ),
    notes: l(
      "Percentage points of the role's ads that name the technology. Only technologies named in at least five of at least 20 ads, with the month a year before complete: a descriptive threshold, not a significance test.",
      'Procentenheter av rollens annonser som nämner tekniken. Bara tekniker som nämns i minst fem av minst 20 annonser, med månaden ett år före komplett: en beskrivande gräns, inte ett signifikanstest.',
    ),
    source: l(
      "JobTech's archives and JobStream",
      'JobTechs arkiv och JobStream',
    ),
  }
}

/** Uses per 1,000 ads of the window, so windows of different size compare. */
const per1000 = (uses: number, ads: number) => (ads ? (uses / ads) * 1000 : 0)

export function termsSpec({
  t,
  view,
  set,
}: Props & { t?: RisingTerms }): Spec | null {
  const rows = termFamilies(t)
  if (!t || !rows.length) return null
  const roles = rows.map((r) => r.role_family)
  const row = rows.find((r) => r.role_family === pick(view.terms, roles))!
  const dirs = (['up', 'down'] as const).filter(
    (d) => (d === 'up' ? row.rising : row.falling).length,
  )
  const dir = dirs.includes(view.dir as 'up')
    ? (view.dir as 'up' | 'down')
    : dirs[0]
  const terms = dir === 'up' ? row.rising : row.falling
  const recent = `${t.recent.from} – ${t.recent.to}`
  const before = `${t.before.from} – ${t.before.to}`
  const rate = (u: number) => per1000(u, row.recent_ads)
  const was = (u: number) => per1000(u, row.before_ads)
  const title = l(
    `Words used ${dir === 'up' ? 'more' : 'less'} in ${row.role_family} ads, per 1,000 ads`,
    `Ord som används ${dir === 'up' ? 'mer' : 'mindre'} i ${row.role_family}-annonser, per 1 000 annonser`,
  )
  return {
    title,
    controls: (
      <>
        {dirs.length > 1 && (
          <Pick
            label={l('Direction', 'Riktning')}
            value={dir}
            options={dirs.map((d) => ({
              value: d,
              label:
                d === 'up'
                  ? l('Used more', 'Används mer')
                  : l('Used less', 'Används mindre'),
            }))}
            onChange={(d) => set({ dir: d })}
          />
        )}
        {roleSlicer(row.role_family, roles, (v) => set({ terms: v }))}
      </>
    ),
    chart: (
      <RankBars
        label={title}
        limit={10}
        rows={terms.map((x) => ({
          key: x.term,
          label: x.term,
          value: rate(x.recent_uses),
          ref: was(x.before_uses),
          text: num(x.recent_uses),
          note: l(`from ${num(x.before_uses)}`, `från ${num(x.before_uses)}`),
        }))}
        max={Math.max(
          ...terms.flatMap((x) => [rate(x.recent_uses), was(x.before_uses)]),
          1,
        )}
        format={(v) => num(v)}
      />
    ),
    notes: l(
      `Bar: uses per 1,000 ads in ${recent} (${num(row.recent_ads)} ads); tick: per 1,000 ads in ${before} (${num(row.before_ads)} ads); numbers: uses counted, now and before. Ranked by weighted log-odds. Function words, numbers, ad boilerplate, employer and place names, and terms mostly from one employer are left out; at least 20 uses by at least 10 employers.`,
      `Stapel: användningar per 1 000 annonser ${recent} (${num(row.recent_ads)} annonser); streck: per 1 000 annonser ${before} (${num(row.before_ads)} annonser); tal: räknade användningar, nu och före. Rangordnade med viktade log-odds. Funktionsord, tal, annonsfraser, arbetsgivar- och ortnamn samt ord mest från en arbetsgivare är bortplockade; minst 20 användningar av minst 10 arbetsgivare.`,
    ),
    source: l("JobTech's archives", 'JobTechs arkiv'),
  }
}

/** 2025-01-01 to 2026-01-01 (exclusive) as "January 2025 – December 2025". */
function periodName(r: EmployerTop['rows'][number]) {
  const until = new Date(r.until + 'T12:00:00Z')
  until.setUTCMonth(until.getUTCMonth() - 1)
  const name =
    r.period_kind === 'year'
      ? l(`Year ${r.from.slice(0, 4)}`, `År ${r.from.slice(0, 4)}`)
      : `${cap(monthName(r.from))} – ${monthName(until.toISOString())}`
  return r.complete ? name : l(`${name}, incomplete`, `${name}, ofullständigt`)
}

export function employersSpec({
  e,
  view,
  set,
}: Props & { e?: EmployerTop }): Spec | null {
  const rows = e?.rows.filter((r) => r.employers.length) ?? []
  if (!rows.length) return null
  const kind = pick(
    view.employers,
    rows.map((r) => r.period_kind),
  )
  const row = rows.find((r) => r.period_kind === kind)!
  const title = l(
    `IT ads per employer, ${periodName(row)}`,
    `IT-annonser per arbetsgivare, ${periodName(row)}`,
  )
  return {
    title,
    controls: rows.length > 1 && (
      <Pick
        label={l('Period', 'Period')}
        value={kind}
        options={rows.map((r) => ({
          value: r.period_kind,
          label: periodName(r),
        }))}
        onChange={(v) => set({ employers: v })}
      />
    ),
    chart: (
      <RankBars
        label={title}
        limit={10}
        rows={row.employers.map((x) => ({
          key: x.employer,
          label: x.employer,
          value: x.ads,
        }))}
        format={(v) => num(v)}
      />
    ),
    notes: l(
      'Counts who posted the ad, often a staffing or consultancy firm, not who hires.',
      'Räknar vem som publicerade annonsen, ofta ett bemannings- eller konsultbolag, inte vem som anställer.',
    ),
    source: l("JobTech's archives", 'JobTechs arkiv'),
  }
}

export function fitSpec(data: Delivered): Spec | null {
  const { matches, profile } = data.matches
  if (!profile || !matches.length) return null
  const title = l(
    `Current Data/IT ads by fit, ${num(matches.length)} ads`,
    `Aktuella Data/IT-annonser efter passform, ${num(matches.length)} annonser`,
  )
  return {
    title,
    chart: (
      <RankBars
        label={title}
        rows={funnel(matches).map((r) => ({
          key: r.class,
          label: fitName(r.class),
          value: r.ads,
        }))}
        format={(v) => num(v)}
      />
    ),
    notes: l(
      `Matched against CV profile v${profile.profile_version}. Each ad has one fit.`,
      `Matchade mot cv-profil v${profile.profile_version}. Varje annons har en passform.`,
    ),
    source: l(
      'JobTech JobStream and the job assistant',
      'JobTech JobStream och jobbassistenten',
    ),
  }
}
