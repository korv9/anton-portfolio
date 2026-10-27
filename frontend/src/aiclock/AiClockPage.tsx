/**
 * When does a law arrive? (#lag-ankomst): how fast the EU AI Act reached Swedish job ads and the
 * Riksdag. A head with KPIs, then charts with a legend only, computed on load from the committed
 * ai-act files (compute.ts); method folds away at the foot.
 */
import { useEffect, useState } from 'react'
import { currentLocale, l } from '../i18n'
import { fetchJson } from '../dataSource'
import { ProjectSection } from '../ui/Project'
import PageHead, { Legend, Method, type Kpi } from '../ui/PageHead'
import MultiLineChart from '../charts/MultiLineChart'
import RankBars from '../charts/RankBars'
import {
  amendedArticles,
  jobYears,
  lagTest,
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

// ---------------------------------------------------------------- timeline

function QuestionSection({
  d,
  end,
}: {
  d: Diffusion | null
  end: string | null
}) {
  if (!d || !end) return null
  return (
    <ProjectSection
      id="aiclock-question"
      title={l('The Act’s dates', 'Förordningens datum')}
    >
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
      <Legend source="ai-act/diffusion.json">
        {l(
          `Proposal, adoption and application dates; grey after ${end}, the last counted month`,
          `Förslag, antagande och tillämpning; grått efter ${end}, sista räknade månaden`,
        )}
      </Legend>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- job ads

function JobsSection({
  rows,
  summary,
}: {
  rows: JobRow[] | null
  summary: JobSummary | null
}) {
  if (!rows || !summary) return null
  const act = jobYears(rows, 'ai_act')
  const partial = (y: { year: string; months: number }) =>
    y.months < 12 ? l(` (${y.months} months)`, ` (${y.months} månader)`) : ''
  return (
    <ProjectSection id="aiclock-jobs" title={l('Job ads', 'Platsannonser')}>
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
      <Legend source="ai-act/jobs/monthly.json">
        {l(
          `Share of job ads mentioning AI or machine learning, %, three-month mean, ${summary.first_month}–${summary.last_month}`,
          `Andel platsannonser som nämner AI eller maskininlärning, %, tremånadersmedel, ${summary.first_month}–${summary.last_month}`,
        )}
      </Legend>
      <div className="ac-pair">
        <div>
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
          <Legend source="ai-act/jobs/monthly.json">
            {l(
              'Job ads naming the AI Act, count per year',
              'Platsannonser som nämner AI-förordningen, antal per år',
            )}
          </Legend>
        </div>
      </div>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- the Riksdag

function RiksdagSection({
  rows,
  summary,
}: {
  rows: SpeechRow[] | null
  summary: SpeechSummary | null
}) {
  if (!rows || !summary) return null
  const years = speechYears(rows)
  const firstAct = years.find((y) => y.act > 0)?.year ?? years[0].year
  return (
    <ProjectSection id="aiclock-riksdag" title={l('The Riksdag', 'Riksdagen')}>
      <div className="ac-pair">
        <div>
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
          <Legend source="ai-act/politics/monthly.json">
            {l(
              `Share of Riksdag speeches mentioning AI, %, per year, ${years[0].year}–${years.at(-1)!.year}`,
              `Andel riksdagsanföranden som nämner AI, %, per år, ${years[0].year}–${years.at(-1)!.year}`,
            )}
          </Legend>
        </div>
        <div>
          <RankBars
            label={l(
              'Speeches naming the AI Act, per year',
              'Anföranden som nämner AI-förordningen, per år',
            )}
            format={(v) => num(v)}
            rows={years
              .filter((y) => y.year >= firstAct)
              .map((y) => ({ key: y.year, label: y.year, value: y.act }))}
          />
          <Legend source="ai-act/politics/monthly.json">
            {l(
              'Riksdag speeches naming the AI Act, count per year',
              'Riksdagsanföranden som nämner AI-förordningen, antal per år',
            )}
          </Legend>
        </div>
      </div>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- the lag test

function LagSection({ d }: { d: Diffusion | null }) {
  if (!d) return null
  const t = lagTest(d)
  return (
    <ProjectSection id="aiclock-lags" title={l('Lag test', 'Fördröjningstest')}>
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
      <Legend source="ai-act/diffusion.json">
        {l(
          `Lags from the Act’s dates to a jump in a term’s share, by outcome against ${t.rounds} random dates, count of ${num(t.total)}`,
          `Fördröjningar från förordningens datum till ett skutt i ett begrepps andel, efter utfall mot ${t.rounds} slumpade datum, antal av ${num(t.total)}`,
        )}
      </Legend>
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
      title={l('Inserted articles', 'Införda artiklar')}
    >
      <ul className="ac-articles">
        {inserted.map((a) => (
          <li key={a.n}>
            {l(`Article ${a.n}`, `Artikel ${a.n}`)}: {a.title}
          </li>
        ))}
      </ul>
      <Legend source="ai-act/changes.json">
        {l(
          `Articles inserted by Regulation ${by.celex.slice(1, 5)}/${Number(by.celex.slice(6))}; amended: ${amended.map((a) => a.n).join(', ')}`,
          `Artiklar införda genom förordning ${by.celex.slice(1, 5)}/${Number(by.celex.slice(6))}; ändrade: ${amended.map((a) => a.n).join(', ')}`,
        )}
      </Legend>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- page

export default function AiClockPage() {
  const d = useJson<Diffusion>('ai-act/diffusion.json')
  const jobRows = useJson<JobRow[]>('ai-act/jobs/monthly.json')
  const jobs = useJson<JobSummary>('ai-act/jobs/summary.json')
  const speechRows = useJson<SpeechRow[]>('ai-act/politics/monthly.json')
  const speeches = useJson<SpeechSummary>('ai-act/politics/summary.json')
  const act = useJson<ActSummary>('ai-act/summary.json')
  const changes = useJson<Change[]>('ai-act/changes.json')
  const kpis: Kpi[] = []
  if (jobs)
    kpis.push({
      value: num(jobs.ads),
      label: l('job ads read', 'lästa platsannonser'),
    })
  if (jobRows) {
    const last = jobYears(jobRows, 'ai_any').at(-1)!
    kpis.push({
      value: sh(last.share, 1),
      label: l(
        `of ads mention AI, ${last.year}`,
        `av annonserna nämner AI, ${last.year}`,
      ),
    })
  }
  if (speeches)
    kpis.push({
      value: num(speeches.counts.ai_act_speeches),
      label: l('speeches name the Act', 'anföranden nämner förordningen'),
    })
  const t = d ? lagTest(d) : null
  if (t)
    kpis.push({
      value: `${num(t.sig)} / ${num(t.total)}`,
      label: l('lags beat chance', 'fördröjningar slår slumpen'),
    })
  return (
    <article className="project-page aiclock">
      <PageHead
        title={l('When does a law arrive?', 'När kommer en lag fram?')}
        sentence={l(
          'The EU wrote “AI system” into law in 2024. When did Swedish job ads and the Riksdag start using its words?',
          'EU skrev in ”AI-system” i lag 2024. När började svenska jobbannonser och riksdagen använda dess ord?',
        )}
        kpis={kpis}
      />
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
      <JobsSection rows={jobRows} summary={jobs} />
      <RiksdagSection rows={speechRows} summary={speeches} />
      <LagSection d={d} />
      <LawSection s={act} changes={changes} />
      <Method
        summary={l(
          'How it is made · sources · method',
          'Så är det gjort · källor · metod',
        )}
      >
        <p>
          {l(
            'Sources: Arbetsförmedlingen job ads (JobTech), Riksdagen speeches, the AI Act on EUR-Lex. An ad or speech can discuss the Act without naming it. First and last years can be partial.',
            'Källor: Arbetsförmedlingens platsannonser (JobTech), riksdagens anföranden, AI-förordningen på EUR-Lex. En annons eller ett anförande kan handla om förordningen utan att nämna den. Första och sista året kan vara ofullständiga.',
          )}
        </p>
        {t && (
          <p>
            {l(
              `Lag test: months from each of the Act’s dates until a term’s share jumps, against ${t.rounds} random dates. Pre-registered. No multiple-test adjustment: of ${num(t.tested)} p-values, about ${num(Math.round(t.tested * 0.05))} would reach 0.05 by chance. Timing, not cause.`,
              `Fördröjningstest: månader från förordningens datum tills ett begrepps andel tar ett skutt, mot ${t.rounds} slumpade datum. Förregistrerat. Ingen justering för många test: av ${num(t.tested)} p-värden skulle ungefär ${num(Math.round(t.tested * 0.05))} nå 0,05 av slump. Tidpunkt, inte orsak.`,
            )}
          </p>
        )}
        {act && (
          <p>
            {l(
              `${num(act.counts.articles_changed)} of the Act’s ${num(act.counts.articles)} articles are new or amended since ${act.original_version.published_at.slice(0, 4)}.`,
              `${num(act.counts.articles_changed)} av förordningens ${num(act.counts.articles)} artiklar är nya eller ändrade sedan ${act.original_version.published_at.slice(0, 4)}.`,
            )}
          </p>
        )}
      </Method>
    </article>
  )
}
