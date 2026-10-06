/**
 * The AI Act Observatory's views. Each takes the delivered data and the reader's date; every
 * statement drawn from the Act links to its article, and interpretations are marked.
 */
import { useMemo, useState } from 'react'
import { l } from '../i18n'
import { ProductQuality } from '../quality/QualityPanel'
import {
  articleOrder,
  articleStatus,
  changesInMonth,
  latestChangeMonth,
  nowAndNext,
  obligationMatrix,
  statusOn,
} from './logic'
import {
  actorLabel,
  ArticleLink,
  fmtDate,
  Kind,
  monthName,
  pick,
  requirementLabel,
  shortTitle,
  Source,
  Status,
} from './shared'
import { Snapshot } from './Snapshot'
import type { AiActData, Change, Milestone } from './types'

type View = { data: AiActData; today: string }

// ------------------------------------------------------------------ overview

export function Overview({ data, today }: View) {
  const { latest, next, upcoming } = nowAndNext(data.timeline, today)
  const counts = data.summary.counts
  const operators = data.actors.filter((a) => a.actor_group === 'operator')
  const latestGuidance = data.guidance.find((g) => g.published_at)
  const latestOfficial = data.changes.find(
    (c) => c.change_kind !== 'provision' && c.change_kind !== 'guidance',
  )
  return (
    <>
      <section className="aa-cards" aria-label={l('Key facts', 'Nyckelfakta')}>
        <article className="aa-card">
          <p className="aa-kicker">{l('What it is', 'Vad det är')}</p>
          <h2>{l('One EU regulation for AI', 'En EU-förordning för AI')}</h2>
          <p>
            {l(
              `Regulation (EU) 2024/1689 sets rules for AI systems and general-purpose AI models placed on the EU market, scaled by risk: ${counts.articles} articles and ${counts.annexes} annexes in the current consolidated text.`,
              `Förordning (EU) 2024/1689 ställer krav på AI-system och AI-modeller för allmänna ändamål på EU-marknaden, efter risk: ${counts.articles} artiklar och ${counts.annexes} bilagor i den gällande konsoliderade texten.`,
            )}
          </p>
          <a href="#ai-act-risk">{l('Risk classes →', 'Riskklasser →')}</a>
        </article>
        <article className="aa-card">
          <p className="aa-kicker">{l('Applies now', 'Gäller nu')}</p>
          {latest && (
            <>
              <h2>{pick({ en: latest.title_en, sv: latest.title_sv })}</h2>
              <p>
                {l('Since', 'Sedan')} {fmtDate(latest.date)}.{' '}
                {pick({ en: latest.description_en, sv: latest.description_sv })}
              </p>
            </>
          )}
          <a href="#ai-act-today">
            {l('What applies today →', 'Vad gäller i dag →')}
          </a>
        </article>
        <article className="aa-card">
          <p className="aa-kicker">
            {l('What happens next', 'Vad händer härnäst')}
          </p>
          {next && (
            <>
              <h2>
                {fmtDate(next.date)}:{' '}
                {pick({ en: next.title_en, sv: next.title_sv })}
              </h2>
              <p>
                {pick({ en: next.description_en, sv: next.description_sv })}
              </p>
            </>
          )}
          <p className="aa-muted">
            {upcoming.length - 1 > 0 &&
              l(
                `${upcoming.length - 1} more dates until 2030.`,
                `${upcoming.length - 1} datum till fram till 2030.`,
              )}
          </p>
          <a href="#ai-act-timeline">{l('Timeline →', 'Tidslinje →')}</a>
        </article>
        <article className="aa-card">
          <p className="aa-kicker">{l('Who is affected', 'Vem berörs')}</p>
          <h2>
            {l(
              `${operators.length} kinds of operator`,
              `${operators.length} slags aktörer`,
            )}
          </h2>
          <p>
            {operators.map((a) => l(a.label_en, a.label_sv)).join(', ')}.{' '}
            {l(
              `${counts.obligations} obligations are mapped to the article that sets them.`,
              `${counts.obligations} skyldigheter är kopplade till artikeln som anger dem.`,
            )}
          </p>
          <a href="#ai-act-roles">{l('Roles →', 'Roller →')}</a>
        </article>
      </section>

      <section className="aa-latest" aria-labelledby="aa-latest-title">
        <h2 id="aa-latest-title">{l('Latest', 'Senast')}</h2>
        <dl>
          <div>
            <dt>{l('Latest official change', 'Senaste officiella ändring')}</dt>
            <dd>
              {latestOfficial ? (
                <>
                  <span>{fmtDate(latestOfficial.change_date)}</span>
                  <span title={latestOfficial.document_title}>
                    {shortTitle(
                      latestOfficial.change_kind,
                      latestOfficial.document_id,
                      latestOfficial.document_title,
                    )}
                  </span>
                  <Source href={latestOfficial.source_url} />
                </>
              ) : (
                '–'
              )}
            </dd>
          </div>
          <div>
            <dt>{l('Latest application date', 'Senaste tillämpningsdatum')}</dt>
            <dd>
              {latest && (
                <>
                  <span>{fmtDate(latest.date)}</span>
                  {pick({ en: latest.title_en, sv: latest.title_sv })}
                  <Source href={latest.source_url}>
                    {l('Article', 'Artikel')} {latest.source_article}
                  </Source>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>{l('Next milestone', 'Nästa milstolpe')}</dt>
            <dd>
              {next && (
                <>
                  <span>{fmtDate(next.date)}</span>
                  {pick({ en: next.title_en, sv: next.title_sv })}
                  <Source href={next.source_url}>
                    {l('Article', 'Artikel')} {next.source_article}
                  </Source>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>{l('Latest guidance', 'Senaste vägledning')}</dt>
            <dd>
              {latestGuidance && (
                <>
                  <span>{fmtDate(latestGuidance.published_at)}</span>
                  {latestGuidance.title}
                  <Source href={latestGuidance.source_url}>
                    {l('Commission', 'Kommissionen')}
                  </Source>
                </>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <Snapshot data={data} today={today} />

      <AmendmentNote data={data} />
    </>
  )
}

function AmendmentNote({ data }: { data: AiActData }) {
  const amending = data.summary.amended_by[0]
  if (!amending) return null
  const counts = data.summary.counts
  return (
    <aside className="aa-note">
      <p>
        {l(
          `The Act has been amended. ${shortTitle('amendment', amending.celex, amending.title)}, adopted ${fmtDate(amending.published_at)}, changed or added ${counts.articles_changed} articles. This site reads the consolidated text of ${fmtDate(data.summary.current_version.published_at)} and compares it with the text published in 2024.`,
          `Lagen har ändrats. ${shortTitle('amendment', amending.celex, amending.title)}, antagen ${fmtDate(amending.published_at)}, ändrade eller lade till ${counts.articles_changed} artiklar. Sajten läser den konsoliderade texten från ${fmtDate(data.summary.current_version.published_at)} och jämför den med texten som publicerades 2024.`,
        )}{' '}
        <a href="#ai-act-changes">
          {l('What changed →', 'Vad som ändrades →')}
        </a>
      </p>
    </aside>
  )
}

// ------------------------------------------------------------------ today

export function Today({ data, today }: View) {
  const groups = useMemo(() => {
    const by = new Map<string, typeof data.articles>()
    for (const a of data.articles) {
      const key = `${a.chapter}`
      by.set(key, [...(by.get(key) ?? []), a])
    }
    return [...by.entries()]
  }, [data])
  const chapterTitle = (c: string) => {
    const row = data.chapters.find((x) => x.chapter === c)
    return row ? l(row.chapter_title_en, row.chapter_title_sv) : c
  }
  const counts = { applies: 0, partly: 0, upcoming: 0 }
  data.articles.forEach((a) => counts[articleStatus(a, today)]++)
  return (
    <>
      <p className="aa-lede">
        {l(
          `On ${fmtDate(today)}, ${counts.applies} of ${data.articles.length} articles apply in full, ${counts.partly} in part and ${counts.upcoming} not yet. Dates follow Article 113 as amended; open an article for its text.`,
          `Den ${fmtDate(today)} gäller ${counts.applies} av ${data.articles.length} artiklar helt, ${counts.partly} delvis och ${counts.upcoming} ännu inte. Datumen följer artikel 113 i dess ändrade lydelse; öppna en artikel för texten.`,
        )}
      </p>
      <div className="aa-chapters">
        {groups.map(([chapter, articles]) => (
          <section key={chapter} className="aa-chapter">
            <h2>
              <span>
                {l('Chapter', 'Kapitel')} {chapter}
              </span>
              {chapterTitle(chapter).toLowerCase()}
            </h2>
            <ul>
              {articles.map((a) => {
                const status = articleStatus(a, today)
                return (
                  <li key={a.article_id} className={`aa-art aa-art-${status}`}>
                    <ArticleLink n={a.article_number}>
                      <b>{a.article_number}</b> {l(a.title_en, a.title_sv)}
                    </ArticleLink>
                    <span className="aa-art-date">
                      <Status status={status} />
                      {status !== 'applies' &&
                        fmtDate(
                          status === 'partly'
                            ? a.applies_from_second
                            : a.applies_from,
                          true,
                        )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}

// ------------------------------------------------------------------ timeline

const T0 = Date.parse('2024-07-01')
const T1 = Date.parse('2031-03-01')

export function TimelineView({ data, today }: View) {
  const [focus, setFocus] = useState<string | null>(null)
  const items = data.timeline
  const x = (d: string) => ((Date.parse(d) - T0) / (T1 - T0)) * 100
  const years = [2025, 2026, 2027, 2028, 2029, 2030, 2031]
  return (
    <>
      <p className="aa-lede">
        {l(
          'When each part of the Act applies, the deadlines it sets, and the documents that made it. Filled marks have passed; the line is today.',
          'När varje del av lagen börjar gälla, vilka frister den sätter och dokumenten som skapade den. Fyllda markeringar har passerats; linjen är i dag.',
        )}
      </p>
      <figure className="aa-timeline-figure">
        <svg
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          role="img"
          aria-label={l(
            'Timeline of AI Act dates from 2024 to 2030',
            'Tidslinje över AI-förordningens datum 2024–2030',
          )}
        >
          <line x1="0" x2="100" y1="12" y2="12" className="aa-axis" />
          {years.map((y) => (
            <line
              key={y}
              x1={x(`${y}-01-01`)}
              x2={x(`${y}-01-01`)}
              y1="10.5"
              y2="13.5"
              className="aa-tick"
            />
          ))}
          <line
            x1={x(today)}
            x2={x(today)}
            y1="2"
            y2="22"
            className="aa-today"
          />
        </svg>
        <div className="aa-timeline-marks">
          {items.map((m) => (
            <button
              key={m.milestone_id}
              type="button"
              className={`aa-mark aa-mark-${m.kind} aa-mark-${statusOn(m.date, today)}${focus === m.milestone_id ? ' is-focus' : ''}`}
              style={{ left: `${x(m.date)}%` }}
              aria-label={`${fmtDate(m.date)}: ${pick({ en: m.title_en, sv: m.title_sv })}`}
              onMouseEnter={() => setFocus(m.milestone_id)}
              onFocus={() => setFocus(m.milestone_id)}
              onClick={() =>
                document
                  .getElementById(`aa-m-${m.milestone_id}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            />
          ))}
          <span className="aa-today-label" style={{ left: `${x(today)}%` }}>
            {l('Today', 'I dag')}
          </span>
        </div>
        <div className="aa-years" aria-hidden="true">
          {years.map((y) => (
            <span key={y} style={{ left: `${x(`${y}-01-01`)}%` }}>
              {y}
            </span>
          ))}
        </div>
        {focus && (
          <TimelineTip m={items.find((m) => m.milestone_id === focus)!} />
        )}
        <figcaption className="aa-legend">
          <span>
            <i className="aa-mark aa-mark-application aa-mark-applies" />{' '}
            {l('Applies from', 'Gäller från')}
          </span>
          <span>
            <i className="aa-mark aa-mark-deadline aa-mark-applies" />{' '}
            {l('Deadline', 'Frist')}
          </span>
          <span>
            <i className="aa-mark aa-mark-document aa-mark-applies" />{' '}
            {l('Document', 'Dokument')}
          </span>
          <span>
            <i className="aa-mark aa-mark-application aa-mark-upcoming" />{' '}
            {l('Not yet', 'Ännu inte')}
          </span>
        </figcaption>
      </figure>
      <ol className="aa-milestones">
        {items.map((m) => (
          <li
            key={m.milestone_id}
            id={`aa-m-${m.milestone_id}`}
            className={`aa-milestone aa-milestone-${statusOn(m.date, today)}${focus === m.milestone_id ? ' is-focus' : ''}`}
            onMouseEnter={() => setFocus(m.milestone_id)}
          >
            <time dateTime={m.date}>{fmtDate(m.date)}</time>
            <div>
              <h3>
                {pick({ en: m.title_en, sv: m.title_sv })}{' '}
                <Status status={statusOn(m.date, today)} />
              </h3>
              <p title={m.kind === 'document' ? m.description_en : undefined}>
                {m.kind === 'document'
                  ? shortTitle(
                      /consolidated/i.test(m.title_en)
                        ? 'consolidated_version'
                        : /amending/i.test(m.title_en)
                          ? 'amendment'
                          : 'regulation',
                      m.source_url.split('CELEX:')[1] ?? '',
                      m.description_en,
                    )
                  : pick({ en: m.description_en, sv: m.description_sv })}
              </p>
              {m.source_quote && (
                <blockquote>
                  <Kind type="source" /> “{m.source_quote}”
                </blockquote>
              )}
              <p className="aa-meta">
                {m.affected_articles.length > 0 && (
                  <>
                    {l('Articles', 'Artiklar')}{' '}
                    {m.affected_articles.slice(0, 12).map((a, i) => (
                      <span key={a}>
                        {i > 0 && ', '}
                        <ArticleLink n={a}>{a}</ArticleLink>
                      </span>
                    ))}
                    {m.affected_articles.length > 12 && ' …'}
                    {' · '}
                  </>
                )}
                <Source href={m.source_url}>
                  {m.source_article
                    ? `${l('Article', 'Artikel')} ${m.source_article}`
                    : 'EUR-Lex'}
                </Source>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}

function TimelineTip({ m }: { m: Milestone }) {
  return (
    <p className="aa-tip" role="status">
      <strong>{fmtDate(m.date)}</strong>{' '}
      {pick({ en: m.title_en, sv: m.title_sv })}
    </p>
  )
}

// ------------------------------------------------------------------ roles

export function Roles({ data }: View) {
  const groups: [string, string, string][] = [
    [
      'operator',
      'Operators: who builds, sells or uses AI',
      'Aktörer: vem som bygger, säljer eller använder AI',
    ],
    ['body', 'Conformity assessment', 'Bedömning av överensstämmelse'],
    ['authority', 'Authorities', 'Myndigheter'],
  ]
  return (
    <>
      <p className="aa-lede">
        {l(
          'The Act assigns obligations by role, not by company. One organisation can hold several roles; a deployer that rebrands or substantially changes a high-risk system can become its provider (Article 25). Definitions are quoted from Article 3.',
          'Lagen fördelar skyldigheter efter roll, inte efter företag. En organisation kan ha flera roller; en användare som sätter sitt namn på eller väsentligt ändrar ett högrisksystem kan bli dess leverantör (artikel 25). Definitionerna citeras ur artikel 3.',
        )}
      </p>
      {groups.map(([group, en, sv]) => (
        <section key={group} className="aa-roles">
          <h2>{l(en, sv)}</h2>
          <div className="aa-role-grid">
            {data.actors
              .filter((a) => a.actor_group === group)
              .map((a) => {
                const n = data.obligations.filter(
                  (o) => o.actor_id === a.actor_id,
                ).length
                return (
                  <article key={a.actor_id} className="aa-role">
                    <h3>
                      {l(a.label_en, a.label_sv)}
                      <small>‘{a.official_term}’</small>
                    </h3>
                    <blockquote>
                      <Kind type="source" /> {a.definition.split('\n')[0]}
                      <cite>
                        {a.definition_note ??
                          `${l('Article', 'Artikel')} 3(${a.definition_point})`}
                      </cite>
                    </blockquote>
                    <p className="aa-meta">
                      <Kind type="derived" />{' '}
                      {l(
                        `Under a “shall” in ${a.articles_with_duty_sentences} articles`,
                        `Har ett ”ska” i ${a.articles_with_duty_sentences} artiklar`,
                      )}
                      {n > 0 && (
                        <>
                          {' · '}
                          <a href={`#ai-act-obligations?actor=${a.actor_id}`}>
                            {l(
                              `${n} mapped obligations →`,
                              `${n} kartlagda skyldigheter →`,
                            )}
                          </a>
                        </>
                      )}
                    </p>
                  </article>
                )
              })}
          </div>
        </section>
      ))}
    </>
  )
}

// ------------------------------------------------------------------ risk classes

export function Risk({ data }: View) {
  return (
    <>
      <p className="aa-lede">
        {l(
          'The Act is built around what an AI system is used for. The tiers below are how the Act frames them, each with the sentence it rests on. “Limited risk” and “minimal risk”, common outside the Act, are not terms it uses.',
          'Lagen utgår från vad ett AI-system används till. Nivåerna nedan är så som lagen ramar in dem, var och en med meningen den vilar på. ”Begränsad risk” och ”minimal risk”, vanliga utanför lagen, är inte begrepp som den använder.',
        )}
      </p>
      <ol className="aa-tiers">
        {data.riskClasses.map((r) => {
          const n = data.obligations.filter(
            (o) => o.risk_class_id === r.risk_class_id,
          )
          return (
            <li
              key={r.risk_class_id}
              className={`aa-tier aa-tier-${r.risk_class_id}`}
            >
              <header>
                <h2>{l(r.label_en, r.label_sv)}</h2>
                <span className="aa-muted">{r.legal_basis}</span>
              </header>
              <p>
                <Kind type="interpretation" />{' '}
                {l(r.description_en, r.description_sv)}
              </p>
              <blockquote>
                <Kind type="source" /> “{r.source_quote}”{' '}
                <ArticleLink n={r.source_article} />
              </blockquote>
              <p className="aa-meta">
                {l('Often called', 'Kallas ofta')}: {r.common_name_en}
                {n.length > 0 && (
                  <>
                    {' · '}
                    <a href={`#ai-act-obligations?risk=${r.risk_class_id}`}>
                      {l(
                        `${n.length} obligations →`,
                        `${n.length} skyldigheter →`,
                      )}
                    </a>
                  </>
                )}
              </p>
            </li>
          )
        })}
      </ol>
    </>
  )
}

// ------------------------------------------------------------------ obligations

export function Obligations({
  data,
  today,
  actor,
  risk,
  setFilter,
}: View & {
  actor: string
  risk: string
  setFilter: (f: { actor?: string; risk?: string }) => void
}) {
  const [type, setType] = useState('')
  const matrix = obligationMatrix(data.obligations)
  const actors = data.actors.filter((a) => matrix.has(a.actor_id))
  const types = [...new Set(data.obligations.map((o) => o.requirement_type))]
  const max = Math.max(...[...matrix.values()].flatMap((m) => [...m.values()]))
  const shown = data.obligations
    .filter((o) => !actor || o.actor_id === actor)
    .filter((o) => !risk || o.risk_class_id === risk)
    .filter((o) => !type || o.requirement_type === type)
    .sort((a, b) => articleOrder(a.article_number, b.article_number))
  return (
    <>
      <p className="aa-lede">
        {l(
          `${data.obligations.length} obligations, each tied to the sentence of the Act that sets it. The quote is the law; the classification and the one-line summary are ours.`,
          `${data.obligations.length} skyldigheter, var och en knuten till meningen i lagen som anger den. Citatet är lagen; klassningen och sammanfattningen är våra.`,
        )}
      </p>
      <div
        className="aa-matrix-wrap"
        tabIndex={0}
        aria-label={l('Obligation matrix', 'Skyldighetsmatris')}
      >
        <table className="aa-matrix">
          <caption className="visually-hidden">
            {l(
              'Number of mapped obligations by role and topic',
              'Antal kartlagda skyldigheter per roll och område',
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Role', 'Roll')}</th>
              {types.map((t) => (
                <th key={t} scope="col">
                  <span>{requirementLabel(t)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {actors.map((a) => (
              <tr key={a.actor_id}>
                <th scope="row">{l(a.label_en, a.label_sv)}</th>
                {types.map((t) => {
                  const n = matrix.get(a.actor_id)?.get(t) ?? 0
                  return (
                    <td key={t}>
                      {n > 0 && (
                        <button
                          type="button"
                          style={{
                            ['--v' as string]: String(0.12 + (0.33 * n) / max),
                          }}
                          aria-pressed={actor === a.actor_id && type === t}
                          aria-label={`${l(a.label_en, a.label_sv)}, ${requirementLabel(t)}: ${n}`}
                          onClick={() => {
                            setType(type === t && actor === a.actor_id ? '' : t)
                            setFilter({
                              actor:
                                type === t && actor === a.actor_id
                                  ? ''
                                  : a.actor_id,
                            })
                          }}
                        >
                          {n}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="aa-filters">
        <label>
          <span>{l('Role', 'Roll')}</span>
          <select
            value={actor}
            onChange={(e) => setFilter({ actor: e.target.value })}
          >
            <option value="">{l('All roles', 'Alla roller')}</option>
            {actors.map((a) => (
              <option key={a.actor_id} value={a.actor_id}>
                {l(a.label_en, a.label_sv)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{l('Risk class', 'Riskklass')}</span>
          <select
            value={risk}
            onChange={(e) => setFilter({ risk: e.target.value })}
          >
            <option value="">{l('All', 'Alla')}</option>
            {data.riskClasses.map((r) => (
              <option key={r.risk_class_id} value={r.risk_class_id}>
                {l(r.label_en, r.label_sv)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{l('Topic', 'Område')}</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{l('All', 'Alla')}</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {requirementLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <span className="aa-muted" role="status">
          {l(`${shown.length} shown`, `${shown.length} visas`)}
        </span>
      </div>
      <ObligationList data={data} today={today} items={shown} />
    </>
  )
}

export function ObligationList({
  data,
  today,
  items,
}: View & { items: AiActData['obligations'] }) {
  return (
    <ul className="aa-obligations">
      {items.map((o) => {
        const status = articleStatus(o, today)
        return (
          <li key={o.obligation_id} className="aa-obligation">
            <header>
              <span className="aa-pill">
                {actorLabel(data.actors, o.actor_id)}
              </span>
              <span className="aa-pill aa-pill-quiet">
                {requirementLabel(o.requirement_type)}
              </span>
              <Status status={status} />
              <span className="aa-muted">
                {status === 'applies'
                  ? `${l('since', 'sedan')} ${fmtDate(o.applies_from, true)}`
                  : `${l('from', 'från')} ${fmtDate(status === 'partly' ? o.applies_from_second : o.applies_from, true)}`}
                {o.applies_from_second &&
                  status === 'upcoming' &&
                  ` / ${fmtDate(o.applies_from_second, true)}`}
              </span>
            </header>
            <p className="aa-summary">
              <Kind type="interpretation" /> {l(o.summary_en, o.summary_sv)}
            </p>
            <blockquote>
              <Kind type="source" /> “{o.source_quote}”
            </blockquote>
            <p className="aa-meta">
              <ArticleLink n={o.article_number}>
                {l('Article', 'Artikel')} {o.article_number}
                {o.paragraph ? `(${o.paragraph})` : ''} ·{' '}
                {l(o.article_title_en, o.article_title_sv)}
              </ArticleLink>{' '}
              <Source href={o.source_url}>EUR-Lex</Source>
            </p>
          </li>
        )
      })}
    </ul>
  )
}

// ------------------------------------------------------------------ changes

const KIND: Record<Change['change_kind'], [string, string]> = {
  amendment: ['Amending regulation', 'Ändringsförordning'],
  corrigendum: ['Corrigendum', 'Rättelse'],
  consolidated_version: ['Consolidated text', 'Konsoliderad text'],
  proposal: ['Proposal', 'Förslag'],
  implementing_act: ['Implementing act', 'Genomförandeakt'],
  commission_report: ['Commission report', 'Kommissionsrapport'],
  guidance: ['Guidance', 'Vägledning'],
  provision: ['Article changed', 'Ändrad artikel'],
}
const CHANGE_TYPE: Record<string, [string, string]> = {
  amended: ['amended', 'ändrad'],
  inserted: ['new', 'ny'],
  deleted: ['deleted', 'struken'],
  text_differs: [
    'text differs, no amendment marker',
    'texten skiljer sig, ingen ändringsmarkering',
  ],
}

export function Changes({
  data,
  today,
  kind,
  setKind,
}: View & { kind: string; setKind: (k: string) => void }) {
  const month = latestChangeMonth(data.changes)
  const thisMonth = changesInMonth(data.changes, today.slice(0, 7))
  const documents = data.changes.filter(
    (c) => c.change_kind !== 'provision' && (!kind || c.change_kind === kind),
  )
  const provisions = data.changes.filter((c) => c.change_kind === 'provision')
  const kinds = [...new Set(data.changes.map((c) => c.change_kind))].filter(
    (k) => k !== 'provision',
  )
  return (
    <>
      <p className="aa-lede">
        {l(
          'What changed, newest first: documents from the Publications Office (amendments, corrigenda, consolidated texts, proposals, implementing acts), Commission guidance, and article by article what the amending act changed.',
          'Vad som ändrats, nyast först: dokument från Publikationsbyrån (ändringar, rättelser, konsoliderade texter, förslag, genomförandeakter), kommissionens vägledning och, artikel för artikel, vad ändringsakten ändrade.',
        )}
      </p>
      <section className="aa-share" aria-labelledby="aa-month-title">
        <p className="aa-kicker">{l('This month', 'Den här månaden')}</p>
        <h2 id="aa-month-title">
          {l('What changed in', 'Vad ändrades i')}{' '}
          {monthName(today.slice(0, 7))}?
        </h2>
        {thisMonth.length ? (
          <ul>
            {thisMonth
              .filter((c) => c.change_kind !== 'provision')
              .map((c) => (
                <li key={c.change_id} title={c.document_title}>
                  {shortTitle(c.change_kind, c.document_id, c.document_title)}
                </li>
              ))}
          </ul>
        ) : (
          <p className="aa-muted">
            {l(
              'Nothing new in the official sources so far this month.',
              'Inget nytt i de officiella källorna hittills den här månaden.',
            )}
            {month && (
              <>
                {' '}
                {l(
                  'The latest changes are from',
                  'De senaste ändringarna är från',
                )}{' '}
                {monthName(month)}.
              </>
            )}
          </p>
        )}
      </section>

      <div
        className="aa-filters"
        role="group"
        aria-label={l('Document type', 'Dokumenttyp')}
      >
        <button type="button" aria-pressed={!kind} onClick={() => setKind('')}>
          {l('All', 'Alla')}
        </button>
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {l(...KIND[k])}
          </button>
        ))}
      </div>
      <ol className="aa-changes">
        {documents.map((c) => {
          const changed = provisions.filter(
            (p) => p.document_id === c.document_id,
          )
          return (
            <li
              key={c.change_id}
              className={`aa-change aa-change-${c.change_kind}`}
            >
              <time dateTime={c.change_date}>{fmtDate(c.change_date)}</time>
              <div>
                <p className="aa-kicker">{l(...KIND[c.change_kind])}</p>
                <h3 title={c.document_title}>
                  {shortTitle(c.change_kind, c.document_id, c.document_title)}
                </h3>
                {changed.length > 0 && (
                  <details>
                    <summary>
                      {l(
                        `${changed.length} articles and annexes changed`,
                        `${changed.length} artiklar och bilagor ändrade`,
                      )}
                    </summary>
                    <ul className="aa-provisions">
                      {changed.map((p) => (
                        <li key={p.change_id}>
                          {p.article_number ? (
                            <ArticleLink n={p.article_number}>
                              {l('Article', 'Artikel')} {p.article_number}
                            </ArticleLink>
                          ) : (
                            <span>
                              {p.provision_id?.replace(
                                'anx_',
                                l('Annex ', 'Bilaga '),
                              )}
                            </span>
                          )}{' '}
                          {p.provision_title}{' '}
                          <em>
                            ({l(...CHANGE_TYPE[p.change_type ?? 'amended'])})
                          </em>
                          {p.affected_actors.length > 0 && (
                            <small>
                              {' '}
                              <Kind type="derived" />{' '}
                              {p.affected_actors
                                .map((a) => actorLabel(data.actors, a))
                                .join(', ')}
                            </small>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <Source href={c.source_url}>{c.document_id}</Source>
              </div>
            </li>
          )
        })}
      </ol>
      {provisions.some((p) => p.change_type === 'text_differs') && (
        <p className="aa-muted aa-small">
          {l(
            'Where the consolidated text differs from the 2024 text without naming an amending act, it is listed as “text differs”, never as an amendment: the difference can be a corrigendum or how the text is rendered.',
            'Där den konsoliderade texten skiljer sig från 2024 års text utan att ange någon ändringsakt listas det som ”texten skiljer sig”, aldrig som en ändring: skillnaden kan vara en rättelse eller hur texten återges.',
          )}
        </p>
      )}
    </>
  )
}

// ------------------------------------------------------------------ sources

const DOC_TYPE: Record<string, [string, string]> = {
  regulation: ['Regulation (Official Journal)', 'Förordning (EUT)'],
  consolidated_version: ['Consolidated version', 'Konsoliderad version'],
  amending_regulation: ['Amending regulation', 'Ändringsförordning'],
  corrigendum: ['Corrigendum', 'Rättelse'],
  regulation_based_on: ['Implementing regulation', 'Genomförandeförordning'],
  decision_based_on: ['Decision', 'Beslut'],
  legislative_proposal: ['Legislative proposal', 'Lagförslag'],
  commission_document: ['Commission document', 'Kommissionsdokument'],
  parliament_resolution: ['Parliament resolution', 'Parlamentsresolution'],
  other: ['Other', 'Övrigt'],
}

export function Sources({ data }: View) {
  const s = data.summary
  return (
    <>
      <p className="aa-lede">
        {l(
          'Everything here is read from official EU sources: the regulation and its related documents from the Publications Office (the repository behind EUR-Lex), guidance from the European Commission. No secondary source is used for legal data.',
          'Allt här läses från officiella EU-källor: förordningen och dess relaterade dokument från Publikationsbyrån (arkivet bakom EUR-Lex), vägledning från Europeiska kommissionen. Inga sekundärkällor används för juridiska data.',
        )}
      </p>
      <dl className="aa-facts">
        <div>
          <dt>{l('Current text', 'Gällande text')}</dt>
          <dd>
            {s.current_version.celex} ·{' '}
            {fmtDate(s.current_version.published_at)}{' '}
            <Source href={s.current_version.source_url}>EUR-Lex</Source>
          </dd>
        </div>
        <div>
          <dt>{l('As published', 'Som publicerad')}</dt>
          <dd>
            {s.original_version.celex} ·{' '}
            {fmtDate(s.original_version.published_at)}{' '}
            <Source href={s.original_version.source_url}>EUR-Lex</Source>
          </dd>
        </div>
        <div>
          <dt>{l('Latest retrieval', 'Senast hämtad')}</dt>
          <dd>{s.latest_retrieval ? fmtDate(s.latest_retrieval) : '–'}</dd>
        </div>
        <div>
          <dt>{l('In the data', 'I datan')}</dt>
          <dd>
            {l(
              `${s.counts.documents} documents, ${s.counts.articles} articles, ${s.counts.recitals} recitals, ${s.counts.annexes} annexes, ${s.counts.guidance} guidance pages`,
              `${s.counts.documents} dokument, ${s.counts.articles} artiklar, ${s.counts.recitals} skäl, ${s.counts.annexes} bilagor, ${s.counts.guidance} vägledningssidor`,
            )}
          </dd>
        </div>
      </dl>

      <section className="aa-section">
        <h2>{l('Three kinds of content', 'Tre slags innehåll')}</h2>
        <ul className="aa-kinds">
          <li>
            <Kind type="source" />{' '}
            {l(
              'Official text and metadata, verbatim: article text, definitions, the sentences obligations rest on, document titles and dates.',
              'Officiell text och metadata, ordagrant: artikeltext, definitioner, meningarna som skyldigheterna vilar på, dokumenttitlar och datum.',
            )}
          </li>
          <li>
            <Kind type="derived" />{' '}
            {l(
              'Computed from the official text by a stated method: which actors an article puts under a “shall”, cross-references, what changed between versions.',
              'Beräknat ur den officiella texten med en angiven metod: vilka aktörer en artikel lägger ett ”ska” på, korshänvisningar, vad som ändrats mellan versioner.',
            )}
          </li>
          <li>
            <Kind type="interpretation" />{' '}
            {l(
              'Written for this site: one-line summaries, the classification of obligations, risk-class descriptions and the navigator’s questions. A test checks that every quoted sentence appears in the current text.',
              'Skrivet för den här sajten: korta sammanfattningar, klassningen av skyldigheter, beskrivningar av riskklasser och navigatorns frågor. Ett test kontrollerar att varje citerad mening finns i den gällande texten.',
            )}
          </li>
        </ul>
      </section>

      <section className="aa-section">
        <h2>{l('Documents', 'Dokument')}</h2>
        <div
          className="aa-table-wrap"
          tabIndex={0}
          aria-label={l('Documents', 'Dokument')}
        >
          <table className="aa-table">
            <thead>
              <tr>
                <th scope="col">{l('Date', 'Datum')}</th>
                <th scope="col">{l('Type', 'Typ')}</th>
                <th scope="col">{l('Document', 'Dokument')}</th>
                <th scope="col">CELEX</th>
              </tr>
            </thead>
            <tbody>
              {[...data.documents].reverse().map((d) => (
                <tr key={d.document_id}>
                  <td>{fmtDate(d.published_at, true)}</td>
                  <td>
                    {l(...(DOC_TYPE[d.document_type] ?? DOC_TYPE.other))}
                    {d.is_current && <b> · {l('current', 'gällande')}</b>}
                  </td>
                  <td title={d.title ?? undefined}>
                    {shortTitle(
                      d.document_type === 'amending_regulation'
                        ? 'amendment'
                        : d.document_type,
                      d.celex,
                      d.title,
                    )}
                  </td>
                  <td>
                    <Source href={d.source_url}>{d.celex}</Source>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="aa-section">
        <h2>{l('Commission guidance', 'Kommissionens vägledning')}</h2>
        <ul className="aa-guidance">
          {data.guidance.map((g) => (
            <li key={g.guidance_id}>
              <Source href={g.source_url}>{g.title}</Source>
              <span className="aa-muted">
                {g.published_at
                  ? fmtDate(g.published_at)
                  : l(
                      'no publication date on the page',
                      'inget publiceringsdatum på sidan',
                    )}
                {g.articles.length > 0 && (
                  <>
                    {' · '}
                    {g.articles.map((a, i) => (
                      <span key={a}>
                        {i > 0 && ', '}
                        <ArticleLink n={a} />
                      </span>
                    ))}
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="aa-section">
        <h2>{l('Limitations', 'Begränsningar')}</h2>
        <ul className="aa-list">
          <li>
            {l(
              'A navigation aid, not legal advice. Whether a provision applies depends on facts and on the full text, including recitals, annexes, delegated acts and national law.',
              'Ett navigeringsstöd, inte juridisk rådgivning. Om en bestämmelse gäller beror på omständigheterna och på hela texten, inklusive skäl, bilagor, delegerade akter och nationell rätt.',
            )}
          </li>
          <li>
            {l(
              'The obligations listed are a selection of the main ones, not every duty in the Act.',
              'Skyldigheterna är ett urval av de viktigaste, inte varje skyldighet i lagen.',
            )}
          </li>
          <li>
            {l(
              'Application dates are given per article from Article 113; where only part of an article has a different date, the article is marked as partly applying.',
              'Tillämpningsdatum anges per artikel utifrån artikel 113; där bara en del av en artikel har ett annat datum markeras artikeln som delvis gällande.',
            )}
          </li>
          <li>
            {l(
              'Corrigenda are listed from the Publications Office’s metadata; their text is not compared separately.',
              'Rättelser listas utifrån Publikationsbyråns metadata; deras text jämförs inte separat.',
            )}
          </li>
          <li>
            {l(
              'The Swedish text is the official Swedish language version; the quotes and the comparison use the English text.',
              'Den svenska texten är den officiella svenska språkversionen; citaten och jämförelsen använder den engelska texten.',
            )}
          </li>
        </ul>
        <p>
          <a
            href="https://github.com/korv9/anton-portfolio/blob/main/docs/ai-act.md"
            target="_blank"
            rel="noreferrer"
          >
            {l(
              'Method and data model (docs/ai-act.md) ↗',
              'Metod och datamodell (docs/ai-act.md) ↗',
            )}
          </a>
        </p>
      </section>
      <ProductQuality product="ai_act" />
    </>
  )
}
