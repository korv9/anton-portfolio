/**
 * When does a law arrive? (#lag-ankomst): how fast the EU AI Act reached Swedish job ads and the
 * Riksdag. Every figure is computed on load from the committed ai-act files (compute.ts).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { currentLocale, l } from '../i18n'
import { fetchJson } from '../dataSource'
import { ProjectHero, ProjectSection } from '../ui/Project'
import MultiLineChart from '../charts/MultiLineChart'
import RankBars from '../charts/RankBars'
import {
  amendedArticles,
  firstHit,
  jobYears,
  lagTest,
  proposal,
  sinceProposal,
  speechYears,
  type ActSummary,
  type Change,
  type Diffusion,
  type JobRow,
  type JobSummary,
  type SpeechRow,
  type SpeechSummary,
} from './compute'
import './aiclock.css'

function useJson<T>(path: string): T | null {
  const [value, setValue] = useState<T | null>(null)
  useEffect(() => {
    let live = true
    fetchJson<T>(path).then(
      (v) => live && setValue(v),
      (e: Error) => console.warn(e.message),
    )
    return () => {
      live = false
    }
  }, [path])
  return value
}

const locale = () => (currentLocale() === 'sv' ? 'sv-SE' : 'en-GB')
const num = (v: number, digits = 0) =>
  v.toLocaleString(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
/** A share between 0 and 1, as a percent. */
const sh = (v: number, digits = 1) =>
  l(`${num(v * 100, digits)}%`, `${num(v * 100, digits)} %`)
/** 'YYYY-MM' as "June 2023" / "juni 2023". */
const monthName = (m: string) =>
  new Date(`${m}-15`).toLocaleDateString(locale(), {
    month: 'long',
    year: 'numeric',
  })
const months = (n: number) => l(`${n} months`, `${n} månader`)

function Finding({ children }: { children: ReactNode }) {
  return <p className="ac-finding">{children}</p>
}
function Note({ children }: { children: ReactNode }) {
  return <p className="ac-note">{children}</p>
}

// ---------------------------------------------------------------- the question

function Timeline({ d, end }: { d: Diffusion; end: string }) {
  return (
    <ol
      className="ac-timeline"
      aria-label={l('The Act’s dates', 'Förordningens datum')}
    >
      {d.milestones.map((m) => (
        <li
          key={m.milestone_id}
          className={m.month > end ? 'is-ahead' : undefined}
        >
          <time dateTime={m.date}>{m.date}</time>
          <span>{l(m.title_en, m.title_sv)}</span>
        </li>
      ))}
    </ol>
  )
}

function QuestionSection({
  d,
  end,
}: {
  d: Diffusion | null
  end: string | null
}) {
  if (!d || !end) return null
  const p = proposal(d)
  return (
    <ProjectSection
      id="aiclock-question"
      label={l('The question', 'Frågan')}
      title={l(
        'A law is written in Brussels. When does it show up at work?',
        'En lag skrivs i Bryssel. När syns den på jobbet?',
      )}
    >
      <Finding>
        {l(
          `The Commission proposed the AI Act in ${monthName(p.month)}. When did Swedish job ads and the Riksdag start using its words?`,
          `Kommissionen föreslog AI-förordningen i ${monthName(p.month)}. När började svenska platsannonser och riksdagen använda dess ord?`,
        )}
      </Finding>
      <Timeline d={d} end={end} />
      <Note>
        {l(
          `Grey dates are after ${monthName(end)}, the last counted month.`,
          `Grå datum ligger efter ${monthName(end)}, den sista räknade månaden.`,
        )}
      </Note>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- job ads

function JobsSection({
  rows,
  summary,
  d,
}: {
  rows: JobRow[] | null
  summary: JobSummary | null
  d: Diffusion | null
}) {
  if (!rows || !summary || !d) return null
  const ai = jobYears(rows, 'ai_any')
  const act = jobYears(rows, 'ai_act')
  const [first, last] = [ai[0], ai.at(-1)!]
  const prev = ai.at(-2)!
  const named = act.find((y) => y.year === prev.year)!
  const actRows = rows.filter((r) => r.term_id === 'ai_act')
  const firstAd = firstHit(actRows, (r) => r.mention_count)
  const regular = firstHit(actRows, (r) => (r.mention_count >= 10 ? 1 : 0))
  const times = num(last.share / first.share, 1)
  const partial = (y: { year: string; months: number }) =>
    y.months < 12 ? l(` (${y.months} months)`, ` (${y.months} månader)`) : ''
  return (
    <ProjectSection
      id="aiclock-jobs"
      label={l('Job ads', 'Platsannonser')}
      title={l(
        `Employers write AI ${times} times as often. They rarely name the Act.`,
        `Arbetsgivare skriver AI ${times} gånger så ofta. Förordningen nämner de sällan.`,
      )}
    >
      <Finding>
        {l(
          `Of ${num(summary.ads)} Swedish job ads, ${sh(first.share, 2)} mentioned AI or machine learning in ${first.year} and ${sh(last.share, 2)} in ${last.year}${partial(last)}. The AI Act by name appeared in ${num(named.hits)} ads in ${prev.year}, ${sh(named.share, 2)} of them.`,
          `Av ${num(summary.ads)} svenska platsannonser nämnde ${sh(first.share, 2)} AI eller maskininlärning ${first.year} och ${sh(last.share, 2)} ${last.year}${partial(last)}. AI-förordningen vid namn fanns i ${num(named.hits)} annonser ${prev.year}, ${sh(named.share, 2)} av dem.`,
        )}
      </Finding>
      <MultiLineChart
        label={l(
          'Share of job ads mentioning AI or machine learning, three-month mean',
          'Andel platsannonser som nämner AI eller maskininlärning, tremånadersmedel',
        )}
        format={(v) => sh(v, 2)}
        colorOf={() => 0}
        series={[
          {
            key: 'ai',
            name: l('AI (any mention)', 'AI (alla omnämnanden)'),
            points: rows
              .filter(
                (r) => r.term_id === 'ai_any' && r.share_rolling_3m !== null,
              )
              .map((r) => ({
                date: `${r.month}-01`,
                label: r.month,
                value: r.share_rolling_3m!,
              })),
          },
        ]}
      />
      <div className="ac-pair">
        <div>
          <h3>
            {l(
              'Ads naming the AI Act, per year',
              'Annonser som nämner AI-förordningen, per år',
            )}
          </h3>
          <RankBars
            label={l(
              'Ads naming the AI Act, per year',
              'Annonser som nämner AI-förordningen, per år',
            )}
            format={(v) => num(v)}
            rows={act.map((y) => ({
              key: y.year,
              label: y.year + partial(y),
              value: y.hits,
            }))}
          />
        </div>
        <div>
          <Finding>
            {l(
              `The first ad to name the Act came in ${monthName(firstAd)}, ${months(sinceProposal(d, firstAd))} after the proposal. Ten or more ads a month first came in ${monthName(regular)}, ${months(sinceProposal(d, regular))} after it.`,
              `Den första annonsen som nämnde förordningen kom i ${monthName(firstAd)}, ${months(sinceProposal(d, firstAd))} efter förslaget. Tio eller fler annonser i månaden kom första gången i ${monthName(regular)}, ${months(sinceProposal(d, regular))} efter det.`,
            )}
          </Finding>
        </div>
      </div>
      <Note>
        {l(
          `Arbetsförmedlingen ads, ${summary.first_month} to ${summary.last_month}. An ad can discuss the Act without naming it.`,
          `Arbetsförmedlingens annonser, ${summary.first_month} till ${summary.last_month}. En annons kan handla om förordningen utan att nämna den.`,
        )}
      </Note>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- the Riksdag

function RiksdagSection({
  rows,
  summary,
  d,
}: {
  rows: SpeechRow[] | null
  summary: SpeechSummary | null
  d: Diffusion | null
}) {
  if (!rows || !summary || !d) return null
  const years = speechYears(rows)
  const firstSpeech = firstHit(rows, (r) => r.ai_act_speeches)
  const top = [...years].sort((a, b) => b.act - a.act)[0]
  const [first, last] = [years[0], years.at(-1)!]
  return (
    <ProjectSection
      id="aiclock-riksdag"
      label={l('The Riksdag', 'Riksdagen')}
      title={l(
        'AI talk in the Riksdag grew. The Act by name stayed rare.',
        'AI-talet i riksdagen växte. Förordningen vid namn förblev ovanlig.',
      )}
    >
      <Finding>
        {l(
          `Of ${num(summary.counts.speeches)} speeches from ${summary.first_date.slice(0, 4)} to ${summary.last_date.slice(0, 4)}, ${num(summary.counts.ai_speeches)} mention AI and ${num(summary.counts.ai_act_speeches)} name the AI Act. The first came in ${monthName(firstSpeech)}, ${months(sinceProposal(d, firstSpeech))} after the proposal; the most in one year was ${num(top.act)}, in ${top.year}.`,
          `Av ${num(summary.counts.speeches)} anföranden från ${summary.first_date.slice(0, 4)} till ${summary.last_date.slice(0, 4)} nämner ${num(summary.counts.ai_speeches)} AI och ${num(summary.counts.ai_act_speeches)} AI-förordningen vid namn. Det första kom i ${monthName(firstSpeech)}, ${months(sinceProposal(d, firstSpeech))} efter förslaget; flest på ett år var ${num(top.act)}, ${top.year}.`,
        )}
      </Finding>
      <div className="ac-pair">
        <div>
          <h3>
            {l(
              'Speeches mentioning AI, share per year',
              'Anföranden som nämner AI, andel per år',
            )}
          </h3>
          <MultiLineChart
            label={l(
              'Share of Riksdag speeches mentioning AI, per year',
              'Andel riksdagsanföranden som nämner AI, per år',
            )}
            format={(v) => sh(v, 2)}
            colorOf={() => 0}
            series={[
              {
                key: 'ai',
                name: l('AI (any mention)', 'AI (alla omnämnanden)'),
                points: years.map((y) => ({
                  date: `${y.year}-07-01`,
                  label: y.year,
                  value: y.share,
                })),
              },
            ]}
          />
        </div>
        <div>
          <h3>
            {l(
              'Speeches naming the AI Act, per year',
              'Anföranden som nämner AI-förordningen, per år',
            )}
          </h3>
          <RankBars
            label={l(
              'Speeches naming the AI Act, per year',
              'Anföranden som nämner AI-förordningen, per år',
            )}
            format={(v) => num(v)}
            rows={years
              .filter((y) => y.year >= firstSpeech.slice(0, 4))
              .map((y) => ({ key: y.year, label: y.year, value: y.act }))}
          />
        </div>
      </div>
      <Note>
        {l(
          `${first.year} and ${last.year} are partial years.`,
          `${first.year} och ${last.year} är ofullständiga år.`,
        )}
      </Note>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- the lag test

function LagSection({ d }: { d: Diffusion | null }) {
  if (!d) return null
  const t = lagTest(d)
  const where = (c: string) =>
    c === 'job_ads'
      ? l('job ads', 'platsannonser')
      : l('speeches', 'anföranden')
  return (
    <ProjectSection
      id="aiclock-lags"
      label={l('The lag test', 'Fördröjningstestet')}
      title={l(
        'Most of the lags are no shorter than chance',
        'De flesta fördröjningarna är inte kortare än slumpen',
      )}
    >
      <Finding>
        {l(
          `Months from each of the Act’s dates until a term’s share jumps, against ${t.rounds} random dates. Of ${num(t.total)} lags, ${num(t.censored)} never jump, ${num(t.notSig)} are no shorter than at random dates, and ${num(t.sig)} reach p ≤ 0.05.`,
          `Månader från förordningens datum tills ett begrepps andel tar ett skutt, mot ${t.rounds} slumpade datum. Av ${num(t.total)} fördröjningar tar ${num(t.censored)} aldrig något skutt, ${num(t.notSig)} är inte kortare än vid slumpade datum och ${num(t.sig)} når p ≤ 0,05.`,
        )}
      </Finding>
      <RankBars
        label={l('The lags by outcome', 'Fördröjningarna efter utfall')}
        format={(v) => num(v)}
        max={t.total}
        rows={[
          {
            key: 'censored',
            label: l('No jump in the data', 'Inget skutt i datan'),
            value: t.censored,
          },
          {
            key: 'ns',
            label: l('p above 0.05', 'p över 0,05'),
            value: t.notSig,
          },
          {
            key: 'sig',
            label: l('p at most 0.05', 'p högst 0,05'),
            value: t.sig,
          },
        ]}
      />
      <Finding>
        {l(
          `The ${num(t.sig)} rest on little. ${num(t.solid)} point at one month, ${t.solidMonths.map(monthName).join(', ')}: “${t.solidTerms.join('” and “')}” in at most ${num(t.solidMatches)} ${t.solidCorpora.map(where).join(' and ')} each. The other ${num(t.thin)} rest on at most ${num(t.thinMatches)} match${t.thinMatches === 1 ? '' : 'es'} each. The Act’s own words have not arrived in a way the test can tell from chance.`,
          `De ${num(t.sig)} vilar på lite. ${num(t.solid)} pekar på en månad, ${t.solidMonths.map(monthName).join(', ')}: ”${t.solidTerms.join('” och ”')}” i högst ${num(t.solidMatches)} ${t.solidCorpora.map(where).join(' och ')} vardera. De övriga ${num(t.thin)} vilar på högst ${num(t.thinMatches)} ${t.thinMatches === 1 ? 'träff' : 'träffar'} var. Förordningens egna ord har inte kommit fram på ett sätt som testet kan skilja från slumpen.`,
        )}
      </Finding>
      <Note>
        {l(
          `Pre-registered. No multiple-test adjustment: of ${num(t.tested)} p-values, about ${num(Math.round(t.tested * 0.05))} would reach 0.05 by chance. Timing, not cause.`,
          `Förregistrerat. Ingen justering för många test: av ${num(t.tested)} p-värden skulle ungefär ${num(Math.round(t.tested * 0.05))} nå 0,05 av slump. Tidpunkt, inte orsak.`,
        )}
      </Note>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- the law itself

function LawSection({
  s,
  changes,
}: {
  s: ActSummary | null
  changes: Change[] | null
}) {
  if (!s || !changes) return null
  const { amended, inserted } = amendedArticles(changes)
  const by = s.amended_by[0]
  return (
    <ProjectSection
      id="aiclock-law"
      label={l('The law itself', 'Lagen själv')}
      title={l(
        'The law moved faster than its words',
        'Lagen rörde sig snabbare än dess ord',
      )}
    >
      <Finding>
        {l(
          `${num(s.counts.articles_changed)} of its ${num(s.counts.articles)} articles are new or amended since ${s.original_version.published_at.slice(0, 4)}: ${num(amended.length)} amended, ${num(inserted.length)} inserted, by Regulation ${by.celex.slice(1, 5)}/${Number(by.celex.slice(6))}.`,
          `${num(s.counts.articles_changed)} av dess ${num(s.counts.articles)} artiklar är nya eller ändrade sedan ${s.original_version.published_at.slice(0, 4)}: ${num(amended.length)} ändrade, ${num(inserted.length)} införda, genom förordning ${by.celex.slice(1, 5)}/${Number(by.celex.slice(6))}.`,
        )}
      </Finding>
      <h3>{l('The new articles', 'De nya artiklarna')}</h3>
      <ul className="ac-articles">
        {inserted.map((a) => (
          <li key={a.n}>
            {l(`Article ${a.n}`, `Artikel ${a.n}`)}: {a.title}
          </li>
        ))}
      </ul>
      <Note>
        {l(
          `Amended articles: ${amended.map((a) => a.n).join(', ')}.`,
          `Ändrade artiklar: ${amended.map((a) => a.n).join(', ')}.`,
        )}
      </Note>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- page

function Stats({
  jobs,
  speeches,
  act,
  rows,
}: {
  jobs: JobSummary | null
  speeches: SpeechSummary | null
  act: ActSummary | null
  rows: JobRow[] | null
}) {
  const items: [string, string][] = []
  if (jobs)
    items.push([num(jobs.ads), l('job ads read', 'lästa platsannonser')])
  if (rows) {
    const ai = jobYears(rows, 'ai_any')
    const last = ai.at(-1)!
    items.push([
      sh(last.share, 1),
      l(
        `of ads mention AI in ${last.year}${last.months < 12 ? ` (${last.months} months)` : ''}, from ${sh(ai[0].share, 2)} in ${ai[0].year}`,
        `av annonserna nämner AI ${last.year}${last.months < 12 ? ` (${last.months} månader)` : ''}, från ${sh(ai[0].share, 2)} ${ai[0].year}`,
      ),
    ])
  }
  if (speeches)
    items.push([
      num(speeches.counts.ai_act_speeches),
      l(
        `Riksdag speeches name the AI Act, of ${num(speeches.counts.speeches)}`,
        `riksdagsanföranden nämner AI-förordningen, av ${num(speeches.counts.speeches)}`,
      ),
    ])
  if (act)
    items.push([
      num(act.counts.articles_changed),
      l(
        'articles of the Act already new or amended',
        'artiklar i förordningen redan nya eller ändrade',
      ),
    ])
  if (!items.length) return null
  return (
    <dl className="ac-stats">
      {items.map(([value, label]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function AiClockPage() {
  const d = useJson<Diffusion>('ai-act/diffusion.json')
  const jobRows = useJson<JobRow[]>('ai-act/jobs/monthly.json')
  const jobs = useJson<JobSummary>('ai-act/jobs/summary.json')
  const speechRows = useJson<SpeechRow[]>('ai-act/politics/monthly.json')
  const speeches = useJson<SpeechSummary>('ai-act/politics/summary.json')
  const act = useJson<ActSummary>('ai-act/summary.json')
  const changes = useJson<Change[]>('ai-act/changes.json')
  return (
    <article className="project-page aiclock">
      <ProjectHero
        eyebrow={l(
          'The EU AI Act in Swedish job ads and the Riksdag',
          'EU:s AI-förordning i svenska platsannonser och riksdagen',
        )}
        title={l('When does a law arrive?', 'När kommer en lag fram?')}
        question={l(
          'How fast does a law reach working life and the Riksdag?',
          'Hur snabbt når en lag arbetslivet och riksdagen?',
        )}
      >
        <p>
          {l(
            'The EU wrote “AI system” into law in 2024. When did Swedish employers and MPs start using the Act’s words?',
            'EU skrev in ”AI-system” i lag 2024. När började svenska arbetsgivare och riksdagsledamöter använda förordningens ord?',
          )}
        </p>
        <Stats jobs={jobs} speeches={speeches} act={act} rows={jobRows} />
      </ProjectHero>
      <QuestionSection
        d={d}
        end={
          d
            ? d.corpora
                .map((c) => c.last_month)
                .sort()
                .at(-1)!
            : null
        }
      />
      <JobsSection rows={jobRows} summary={jobs} d={d} />
      <RiksdagSection rows={speechRows} summary={speeches} d={d} />
      <LagSection d={d} />
      <LawSection s={act} changes={changes} />
    </article>
  )
}
