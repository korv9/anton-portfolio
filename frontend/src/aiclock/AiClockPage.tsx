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
  const ahead = d.milestones.filter((m) => m.month > end).length
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
          `The Commission proposed the AI Act in ${monthName(p.month)}. This page follows its ${d.milestones.length} dates and asks when Swedish employers and the Riksdag started to use its words: in job ads, in speeches, and in the terms the Act itself defines.`,
          `Kommissionen föreslog AI-förordningen i ${monthName(p.month)}. Sidan följer dess ${d.milestones.length} datum och frågar när svenska arbetsgivare och riksdagen började använda dess ord: i platsannonser, i anföranden och i de begrepp som förordningen själv definierar.`,
        )}
      </Finding>
      <Timeline d={d} end={end} />
      <Note>
        {l(
          `Grey dates fall after the last counted month (${monthName(end)}); ${ahead} of the ${d.milestones.length} are still ahead.`,
          `Grå datum ligger efter den sista räknade månaden (${monthName(end)}); ${ahead} av de ${d.milestones.length} ligger fortfarande framför oss.`,
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
          `Arbetsförmedlingen’s historical ads, ${summary.first_month} to ${summary.last_month}, matched with a fixed dictionary. An ad can discuss the Act without naming it.`,
          `Arbetsförmedlingens historiska annonser, ${summary.first_month} till ${summary.last_month}, matchade mot ett fast ordförråd. En annons kan handla om förordningen utan att nämna den.`,
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
          `Riksdagen’s open speech data. ${first.year} and ${last.year} are partial years (the data runs ${summary.first_date} to ${summary.last_date}). A speech can discuss the Act without naming it.`,
          `Riksdagens öppna data om anföranden. ${first.year} och ${last.year} är ofullständiga år (datan går från ${summary.first_date} till ${summary.last_date}). Ett anförande kan handla om förordningen utan att nämna den.`,
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
          `For each of the Act’s own terms, corpus and date, the test asks how many months pass before the term’s share jumps, and compares that with ${t.rounds} random dates. Of ${num(t.total)} lags, ${num(t.censored)} never jump in the data, ${num(t.notSig)} are no shorter than at random dates, and ${num(t.sig)} reach p ≤ 0.05.`,
          `För vart och ett av förordningens egna begrepp, korpus och datum frågar testet hur många månader som går innan begreppets andel tar ett skutt, och jämför med ${t.rounds} slumpade datum. Av ${num(t.total)} fördröjningar tar ${num(t.censored)} aldrig något skutt i datan, ${num(t.notSig)} är inte kortare än vid slumpade datum och ${num(t.sig)} når p ≤ 0,05.`,
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
          `Read what the ${num(t.sig)} rest on. ${num(t.solid)} point at the same month, ${t.solidMonths.map(monthName).join(', ')}, when “${t.solidTerms.join('” and “')}” turned up in at most ${num(t.solidMatches)} ${t.solidCorpora.map(where).join(' and ')} each: one burst, counted against every date. The other ${num(t.thin)} rest on at most ${num(t.thinMatches)} match${t.thinMatches === 1 ? '' : 'es'} each. So the Act’s own vocabulary has not yet arrived in Swedish working life or the Riksdag in a way this test can tell from chance.`,
          `Läs vad de ${num(t.sig)} vilar på. ${num(t.solid)} pekar på samma månad, ${t.solidMonths.map(monthName).join(', ')}, då ”${t.solidTerms.join('” och ”')}” dök upp i högst ${num(t.solidMatches)} ${t.solidCorpora.map(where).join(' och ')} vardera: ett enda utbrott, räknat mot varje datum. De övriga ${num(t.thin)} vilar på högst ${num(t.thinMatches)} ${t.thinMatches === 1 ? 'träff' : 'träffar'} var. Förordningens egna ord har alltså ännu inte nått svenskt arbetsliv eller riksdagen på ett sätt som testet kan skilja från slumpen.`,
        )}
      </Finding>
      <Note>
        {l(
          `Pre-registered: ${num(d.diagnostics.primary.tests)} lags on the original term list (${num(d.diagnostics.primary.p_at_most_0_05)} at p ≤ 0.05) and ${num(d.diagnostics.amended.tests)} on the amended list (${num(d.diagnostics.amended.p_at_most_0_05)}), reported side by side and never pooled. No multiple-test adjustment: with ${num(t.tested)} p-values, about ${num(Math.round(t.tested * 0.05))} would reach 0.05 by chance alone. A shorter lag is timing, not proof that the Act caused it.`,
          `Förregistrerat: ${num(d.diagnostics.primary.tests)} fördröjningar på den ursprungliga begreppslistan (${num(d.diagnostics.primary.p_at_most_0_05)} med p ≤ 0,05) och ${num(d.diagnostics.amended.tests)} på den ändrade listan (${num(d.diagnostics.amended.p_at_most_0_05)}), redovisade sida vid sida och aldrig sammanslagna. Ingen justering för många test: med ${num(t.tested)} p-värden skulle ungefär ${num(Math.round(t.tested * 0.05))} nå 0,05 av ren slump. En kortare fördröjning visar tidpunkt, inte att förordningen orsakade den.`,
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
          `Before most of it applies, the Act has already been rewritten. ${num(s.counts.articles_changed)} of its ${num(s.counts.articles)} articles are new or amended since ${s.original_version.published_at.slice(0, 4)}: ${num(amended.length)} amended and ${num(inserted.length)} inserted, by Regulation ${by.celex.slice(1, 5)}/${Number(by.celex.slice(6))} (${by.published_at}). The consolidated text of ${s.current_version.published_at} carries the changes.`,
          `Innan det mesta av den gäller har förordningen redan skrivits om. ${num(s.counts.articles_changed)} av dess ${num(s.counts.articles)} artiklar är nya eller ändrade sedan ${s.original_version.published_at.slice(0, 4)}: ${num(amended.length)} ändrade och ${num(inserted.length)} införda, genom förordning ${by.celex.slice(1, 5)}/${Number(by.celex.slice(6))} (${by.published_at}). Den konsoliderade texten från ${s.current_version.published_at} bär ändringarna.`,
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
          `Amended articles: ${amended.map((a) => a.n).join(', ')}. Found by comparing the Official Journal text with the consolidated text from EUR-Lex; article titles are the official English ones.`,
          `Ändrade artiklar: ${amended.map((a) => a.n).join(', ')}. Hittade genom att jämföra texten i EUT med den konsoliderade texten från EUR-Lex; artikelrubrikerna är de officiella engelska.`,
        )}
      </Note>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- method

function Method({ d }: { d: Diffusion | null }) {
  return (
    <ProjectSection
      id="aiclock-method"
      label={l('Method and limits', 'Metod och begränsningar')}
      title={l('How to read this page', 'Så läser du sidan')}
    >
      <ul className="ac-method">
        <li>
          {l(
            'The Act’s terms were chosen by weighted log-odds of its phrases against the Swedish statute book (SFS), then reviewed by hand; every dropped term and its reason is kept.',
            'Förordningens begrepp valdes med viktade log-odds för dess fraser mot svensk författningssamling (SFS) och granskades sedan för hand; varje bortvald term och skälet sparas.',
          )}
        </li>
        <li>
          {l(
            'A term counts as arrived in the first month after a date whose three-month share is above the 95th percentile of all earlier months, with at least 12 earlier months. Partial months are left out.',
            'Ett begrepp räknas som framme den första månaden efter ett datum då tremånadersandelen ligger över 95:e percentilen av alla tidigare månader, med minst 12 tidigare månader. Ofullständiga månader räknas inte.',
          )}
        </li>
        {d && (
          <li>
            {l(
              `Placebo test: ${d.diagnostics.placebo_rounds} random months per lag, p = (1 + placebo lags no longer than the observed) / ${d.diagnostics.placebo_rounds + 1}. A lag whose window holds ${d.diagnostics.few_matches} matches or fewer says nothing.`,
              `Placebotest: ${d.diagnostics.placebo_rounds} slumpade månader per fördröjning, p = (1 + placebofördröjningar som inte är längre än den observerade) / ${d.diagnostics.placebo_rounds + 1}. En fördröjning vars fönster har ${d.diagnostics.few_matches} träffar eller färre säger ingenting.`,
            )}
          </li>
        )}
        <li>
          {l(
            'Re-admitted terms were checked by reading up to 50 random matched ads or speeches each; a term is kept at a precision of 0.8 or more.',
            'Återinsatta begrepp kontrollerades genom att läsa upp till 50 slumpade träffar i annonser eller anföranden vardera; ett begrepp behålls vid en precision på 0,8 eller mer.',
          )}
        </li>
        <li>
          {l(
            'Timing is not cause: AI talk in ads and speeches also rises for reasons that have nothing to do with the law, and this page cannot separate them.',
            'Tidpunkt är inte orsak: AI-språket i annonser och anföranden ökar också av skäl som inte har med lagen att göra, och sidan kan inte skilja dem åt.',
          )}
        </li>
        <li>
          {l(
            'Sources: Arbetsförmedlingen / JobTech historical job ads, Riksdagen open data (speeches), and the Publications Office of the EU (Cellar, EUR-Lex). Raw ads are never published; the page reads only counts.',
            'Källor: Arbetsförmedlingens / JobTechs historiska platsannonser, riksdagens öppna data (anföranden) och EU:s publikationsbyrå (Cellar, EUR-Lex). Råa annonser publiceras aldrig; sidan läser bara antal.',
          )}
        </li>
      </ul>
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
            'The EU wrote “AI system” into law in 2024. This page counts when Swedish employers and MPs began to use the Act’s words, tests whether those dates are closer to the law than chance, and shows the law changing under them.',
            'EU skrev in ”AI-system” i lag 2024. Sidan räknar när svenska arbetsgivare och riksdagsledamöter började använda förordningens ord, prövar om de tidpunkterna ligger närmare lagen än slumpen, och visar hur lagen ändras under tiden.',
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
      <Method d={d} />
    </article>
  )
}
