/**
 * The EU AI Act report: what applies and when, who must do what, and how Sweden talks about AI.
 * One question per tab and at most three charts in each. The reader follows roles; the first
 * two tabs then answer for those roles. The article reader, the navigator and the full
 * analyses are the deep dives behind it.
 */
import { useEffect, useMemo, useState } from 'react'
import { AI_ACT_TABS, setHashParams, type Route } from '../router'
import ReportShell, { ReportFrame } from '../report/ReportShell'
import { Feature } from '../charts/feature/Feature'
import RankBars from '../charts/RankBars'
import MultiLineChart from '../charts/MultiLineChart'
import { Stacked } from '../charts/Compare'
import { loadJobs, loadPolitics, useAiAct } from './data'
import { isoToday, partyTotals, yearlyFromMonths, yearlyShare } from './logic'
import { fmtDate, requirementLabel } from './shared'
import type { JobsData } from './jobsTypes'
import type { PoliticsData } from './politicsTypes'
import type { AiActData } from './types'
import { partyName } from '../parties/identity'
import { FIELD_EN } from '../jobs/market'

const TABS = [
  {
    label: 'What applies and when',
    question: 'What applies now, and what comes next?',
  },
  { label: 'Roles and obligations', question: 'Who must do what?' },
  {
    label: 'Society and working life',
    question: 'Does Sweden talk about AI?',
  },
].map((tab, i) => ({ ...tab, path: AI_ACT_TABS[i] }))

const DEEPER = [
  {
    href: '#ai-act-today',
    label: 'Article by article',
    about: 'Every article, what applies today and the official text',
  },
  {
    href: '#ai-act-timeline',
    label: 'Timeline',
    about: 'When each part of the Act starts to apply',
  },
  {
    href: '#ai-act-obligations',
    label: 'Obligations',
    about: 'Each duty with its article, its quote and its date',
  },
  {
    href: '#ai-act-actors',
    label: 'Roles defined',
    about: 'The Act’s own definition of every role',
  },
  {
    href: '#ai-act-risk',
    label: 'Risk classes',
    about: 'How the Act scales its rules by risk',
  },
  {
    href: '#ai-act-startups',
    label: 'Startup navigator',
    about: 'Questions that point to the parts that may matter to you',
  },
  {
    href: '#ai-act-politics',
    label: 'The Riksdag and AI',
    about: 'How political language about AI has changed',
  },
  {
    href: '#ai-act-jobs',
    label: 'In the job ads',
    about: 'AI governance, compliance and model risk in Swedish ads',
  },
  {
    href: '#ai-act-signals',
    label: 'AI governance timeline',
    about: 'The Act, the Riksdag and the job market on one time axis',
  },
  {
    href: '#ai-act-changes',
    label: 'Changes',
    about: 'Amendments, corrections and guidance, dated',
  },
  {
    href: '#ai-act-sources',
    label: 'Sources and method',
    about: 'Where every statement comes from',
  },
]

const APPLIES = 'var(--color-chart-neutral)'
const AHEAD = 'var(--color-chart-muted)'
const SOURCE = 'Regulation (EU) 2024/1689, consolidated text, EUR-Lex'

const count = (v: number) => String(Math.round(v))
const pct = (v: number) =>
  `${v.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
/** The Act writes its chapter titles in capitals; the report sets them as a sentence. */
const sentence = (s: string) =>
  (s.charAt(0) + s.slice(1).toLowerCase()).replace(/\b(ai|eu)\b/gi, (m) =>
    m.toUpperCase(),
  )

type Props = { data: AiActData; today: string; roles: string[] }

function Applies({ data, today, roles }: Props) {
  const articles = data.articles.filter(
    (a) => !roles.length || a.actors.some((actor) => roles.includes(actor)),
  )
  const dates = [...new Set(articles.map((a) => a.applies_from))].sort()
  const now = articles.filter((a) => a.applies_from <= today).length
  const chapters = [...new Set(articles.map((a) => a.chapter))].map((c) => {
    const own = articles.filter((a) => a.chapter === c)
    const applies = own.filter((a) => a.applies_from <= today).length
    const title = data.chapters.find((x) => x.chapter === c)?.chapter_title_en
    return {
      key: c,
      label: title ? `${c}. ${sentence(title)}` : c,
      values: [applies, own.length - applies],
      text: `${applies} / ${own.length}`,
    }
  })
  const parts = [
    { label: 'Applies today', colour: APPLIES },
    { label: 'Still ahead', colour: AHEAD },
  ]
  return (
    <>
      <div className="report-main">
        <Feature
          id="tillampning"
          title="Articles by the date they start to apply"
          source={`${SOURCE}, Article 113; an article with two dates is counted on its first`}
        >
          <RankBars
            rows={dates.map((d) => ({
              key: d,
              label: fmtDate(d),
              value: articles.filter((a) => a.applies_from === d).length,
              color: d <= today ? APPLIES : AHEAD,
              note: d <= today ? 'applies' : 'ahead',
            }))}
            format={count}
            label="Number of articles per application date"
          />
        </Feature>
      </div>
      <div className="report-pair">
        <Feature
          id="galler-nu"
          title={`Articles that apply on ${fmtDate(today)}`}
          source={SOURCE}
        >
          <Stacked
            rows={[{ key: 'all', values: [now, articles.length - now] }]}
            parts={parts}
            format={count}
            label="Share of the articles that apply today"
          />
        </Feature>
        <Feature
          id="kapitel"
          title="Chapter by chapter"
          source={`${SOURCE}; articles that apply today of all in the chapter`}
        >
          <Stacked
            rows={chapters}
            parts={parts}
            format={count}
            label="Articles that apply today, per chapter"
          />
        </Feature>
      </div>
    </>
  )
}

function Duties({
  data,
  roles,
  toggle,
}: Props & { toggle: (role: string) => void }) {
  const own = data.obligations.filter(
    (o) => !roles.length || roles.includes(o.actor_id),
  )
  const ranked = <T extends string>(
    rows: typeof own,
    key: (o: (typeof own)[number]) => T,
    label: (id: T) => string,
  ) =>
    [...new Set(rows.map(key))]
      .map((id) => ({
        key: id,
        label: label(id),
        value: rows.filter((o) => key(o) === id).length,
      }))
      .sort((a, b) => b.value - a.value)
  const source = `${SOURCE}; obligations read from the articles, each linked to its quote under Obligations`
  return (
    <>
      <div className="report-main">
        <Feature id="roller" title="Obligations per role" source={source}>
          <RankBars
            rows={ranked(
              data.obligations,
              (o) => o.actor_id,
              (id) =>
                data.actors.find((a) => a.actor_id === id)?.label_en ?? id,
            )}
            format={count}
            onPick={toggle}
            picked={roles.length === 1 ? roles[0] : null}
            label="Number of obligations per role"
          />
        </Feature>
      </div>
      <div className="report-pair">
        <Feature id="krav" title="What the obligations ask for" source={source}>
          <RankBars
            rows={ranked(
              own,
              (o) => o.requirement_type,
              (id) => requirementLabel(id),
            )}
            format={count}
            limit={12}
            label="Number of obligations per kind of requirement"
          />
        </Feature>
        <Feature
          id="risk"
          title="The risk class they belong to"
          source={source}
        >
          <RankBars
            rows={ranked(
              own,
              (o) => o.risk_class_id,
              (id) =>
                data.riskClasses.find((r) => r.risk_class_id === id)
                  ?.label_en ?? id,
            )}
            format={count}
            label="Number of obligations per risk class"
          />
        </Feature>
      </div>
    </>
  )
}

function Society() {
  const [politics, setPolitics] = useState<PoliticsData | null>(null)
  const [jobs, setJobs] = useState<JobsData | null>(null)
  useEffect(() => {
    loadPolitics()
      .then(setPolitics)
      .catch(() => setPolitics(null))
    loadJobs()
      .then(setJobs)
      .catch(() => setJobs(null))
  }, [])
  if (!politics || !jobs) return <p role="status">Loading…</p>
  const speeches = yearlyShare(politics.monthly)
  const ads = yearlyFromMonths(
    jobs.monthly
      .filter((m) => m.term_id === 'ai_any')
      .map((m) => ({
        month: m.month,
        numerator: m.mention_count,
        denominator: m.ads,
      })),
  )
  const point = (year: string, share: number) => ({
    date: `${year}-01-01`,
    label: year,
    value: share * 100,
  })
  const series = [
    {
      key: 'riksdag',
      name: 'Riksdag speeches that mention AI',
      points: speeches.map((y) => point(y.year, y.share)),
    },
    {
      key: 'ads',
      name: 'Job ads that mention AI',
      points: ads.map((y) => point(y.year, y.share)),
    },
  ]
  const year = Math.max(...jobs.fields.map((f) => f.year))
  const fields = jobs.fields
    .filter((f) => f.year === year && f.term_id === 'ai_any')
    .sort((a, b) => b.share - a.share)
  return (
    <>
      <div className="report-main">
        <Feature
          id="ai-i-sverige"
          title="AI in the Riksdag and in job ads, year by year"
          source={`${politics.summary.source.label} and ${jobs.summary.source.label}; share of all speeches and of all ads in the year, words counted by a published dictionary`}
        >
          <MultiLineChart
            series={series}
            format={pct}
            colorOf={(key) => series.findIndex((s) => s.key === key) + 1}
            label="Share of Riksdag speeches and of job ads that mention AI, per year"
          />
        </Feature>
      </div>
      <div className="report-pair">
        <Feature
          id="partier-ai"
          title="How often each party speaks of AI"
          source={`${politics.summary.source.label}; share of the party’s speeches, ${politics.summary.first_date.slice(0, 4)}–${politics.summary.last_date.slice(0, 4)}`}
        >
          <RankBars
            rows={partyTotals(politics.partyYear).map((p) => ({
              key: p.party,
              label: partyName(p.party),
              value: p.share * 100,
              party: p.party,
              note: `${p.ai}`,
            }))}
            format={pct}
            label="Share of each party’s speeches that mention AI"
          />
        </Feature>
        <Feature
          id="omraden-ai"
          title={`Fields whose ads mention AI, ${year}`}
          source={`${jobs.summary.source.label}; share of the field’s ads`}
        >
          <RankBars
            rows={fields.map((f) => ({
              key: f.field_id,
              label: FIELD_EN[f.field] ?? f.field,
              value: f.share * 100,
              note: `${f.mention_count}`,
            }))}
            format={pct}
            limit={10}
            label="Share of ads that mention AI, per occupation field"
          />
        </Feature>
      </div>
    </>
  )
}

export default function AiActReport({ route }: { route: Route }) {
  const { data, error } = useAiAct()
  // The reader's date decides what applies now; ?idag=2027-01-01 previews another day.
  const today = useMemo(() => {
    const preview = route.params.get('idag')
    return preview && /^\d{4}-\d{2}-\d{2}$/.test(preview) ? preview : isoToday()
  }, [route.params.toString()])
  const at = Math.max(0, AI_ACT_TABS.indexOf(route.path))
  const roles = (route.params.get('roller') ?? '').split(',').filter(Boolean)
  const toggle = (role: string) => {
    const next = roles.includes(role)
      ? roles.filter((r) => r !== role)
      : [...roles, role]
    const params = new URLSearchParams(route.params)
    if (next.length) params.set('roller', next.join(','))
    else params.delete('roller')
    setHashParams(route.path, params)
  }
  // The roles the Act gives obligations: the ones a reader can follow.
  const followable = (data?.actors ?? []).filter((a) =>
    data!.obligations.some((o) => o.actor_id === a.actor_id),
  )
  return (
    <ReportFrame>
      <ReportShell
        name="EU AI Act Observatory"
        intro={`Regulation (EU) 2024/1689 read from official EU sources: what applies, to whom and from when.${data ? ` Consolidated text of ${fmtDate(data.summary.current_version.published_at)}.` : ''} An overview, not legal advice.`}
        tabs={TABS}
        path={route.path}
        hrefOf={(p) =>
          roles.length && AI_ACT_TABS.includes(p)
            ? `${p}?roller=${roles.join(',')}`
            : p
        }
        slicerLabel={at < 2 ? 'Follow roles' : undefined}
        slicer={
          at < 2 && (
            <div className="report-chips" role="group" aria-label="Roles">
              {followable.map((a) => (
                <button
                  key={a.actor_id}
                  type="button"
                  aria-pressed={roles.includes(a.actor_id)}
                  onClick={() => toggle(a.actor_id)}
                >
                  {a.label_en}
                </button>
              ))}
            </div>
          )
        }
        deeper={DEEPER}
      >
        {error && <p role="alert">The AI Act data could not be loaded.</p>}
        {!data && !error && <p role="status">Loading…</p>}
        {data && at === 0 && (
          <Applies data={data} today={today} roles={roles} />
        )}
        {data && at === 1 && (
          <Duties data={data} today={today} roles={roles} toggle={toggle} />
        )}
        {data && at === 2 && <Society />}
      </ReportShell>
    </ReportFrame>
  )
}
