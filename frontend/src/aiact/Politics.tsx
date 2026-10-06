/**
 * The Riksdag and AI (#ai-act-politics): how Swedish parliamentary language about AI has changed
 * as the AI Act was proposed, negotiated and applied. Every count rests on a published dictionary
 * of words (shown under Method); semantic similarity to the Act's text is a separate, derived
 * layer. Descriptive throughout: what was said, how often, by whom; never why.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { l } from '../i18n'
import { PARTY_IDENTITY } from '../parties/identity'
import { loadPolitics, loadSimilarity } from './data'
import { balanceWord, partyTotals, yearlyShare } from './logic'
import type { PoliticsData, SimilarityRow } from './politicsTypes'
import { ArticleLink, fmtDate, Kind, pick, Source, SPEECH } from './shared'
import type { AiActData, Milestone } from './types'

const PARTIES = ['S', 'M', 'SD', 'C', 'V', 'KD', 'L', 'MP']
const pct = (v: number, digits = 1) =>
  `${(v * 100).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`
const num = (v: number) => v.toLocaleString(l('en-GB', 'sv-SE'))

export function Politics({ data }: { data: AiActData }) {
  const [politics, setPolitics] = useState<PoliticsData | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    loadPolitics()
      .then(setPolitics)
      .catch(() => setFailed(true))
  }, [])
  if (failed)
    return (
      <p className="aa-lede">
        {l('The analysis could not be loaded.', 'Analysen kunde inte laddas.')}
      </p>
    )
  if (!politics) return <p className="aa-muted">{l('Loading…', 'Laddar…')}</p>
  const s = politics.summary
  return (
    <div className="aa-politics">
      <p className="aa-lede">
        {l(
          `Every speech in the Riksdag chamber from ${fmtDate(s.first_date)} to ${fmtDate(s.last_date)}: ${num(s.counts.speeches)} speeches in ${s.counts.sessions} sessions. ${num(s.counts.ai_speeches)} of them mention AI in at least one paragraph, and ${s.counts.ai_act_speeches} name the AI Act. The counts rest on a published list of words; they show what was said and how often, not why.`,
          `Varje anförande i riksdagens kammare från ${fmtDate(s.first_date)} till ${fmtDate(s.last_date)}: ${num(s.counts.speeches)} anföranden under ${s.counts.sessions} riksmöten. ${num(s.counts.ai_speeches)} av dem nämner AI i minst ett stycke, och ${s.counts.ai_act_speeches} nämner AI-förordningen vid namn. Räkningarna vilar på en publicerad ordlista; de visar vad som sades och hur ofta, inte varför.`,
        )}
      </p>
      <ShareOverTime politics={politics} timeline={data.timeline} />
      <ConceptBars politics={politics} />
      <Parties politics={politics} />
      <Framing politics={politics} />
      <NamedAct politics={politics} />
      <Examples politics={politics} />
      <Similarity politics={politics} />
      <Method politics={politics} />
    </div>
  )
}

// ------------------------------------------------------------------ share over time

const CHART_MILESTONES = new Set([
  'document-52021pc0206',
  'document-32024r1689',
  'prohibitions-and-literacy',
  'gpai-governance-penalties',
  'document-32026r1744',
  'general-application',
])

function ShareOverTime({
  politics,
  timeline,
}: {
  politics: PoliticsData
  timeline: Milestone[]
}) {
  const rows = politics.monthly
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const first = rows[0].month
  const last = rows[rows.length - 1].month
  const t0 = Date.parse(`${first}-01`)
  const t1 = Date.parse(`${last}-01`)
  const x = (month: string) =>
    ((Date.parse(`${month.slice(0, 7)}-01`) - t0) / (t1 - t0)) * 100
  const max = Math.max(...rows.map((r) => r.ai_share_rolling_3m))
  const top = Math.ceil((max * 100) / 0.5) * 0.005
  const y = (v: number) => 100 - (v / top) * 100
  const ticks = Array.from(
    { length: Math.round(top / 0.005) + 1 },
    (_, i) => i * 0.005,
  )
  const path = rows
    .map(
      (r, i) =>
        `${i ? 'L' : 'M'}${x(r.month).toFixed(2)},${y(r.ai_share_rolling_3m).toFixed(2)}`,
    )
    .join(' ')
  const milestones = timeline
    .filter(
      (m) => CHART_MILESTONES.has(m.milestone_id) && m.date.slice(0, 7) <= last,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
  const years = [...new Set(rows.map((r) => r.month.slice(0, 4)))].filter(
    (yr) => `${yr}-01` >= first,
  )
  const point = hover != null ? rows[hover] : null
  const yearly = yearlyShare(rows)
  return (
    <section className="aa-section" aria-labelledby="aa-share-title">
      <h2 id="aa-share-title">
        {l('How often AI comes up', 'Hur ofta AI kommer upp')}
      </h2>
      <p className="aa-muted aa-small">
        {l(
          'Share of all speeches that mention AI, three-month rolling (sums of speeches over the window). Numbered lines are AI Act milestones.',
          'Andel av alla anföranden som nämner AI, rullande tre månader (summor av anföranden i fönstret). De numrerade linjerna är milstolpar för AI-förordningen.',
        )}
      </p>
      <figure className="aa-line-figure">
        <div className="aa-line-y" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ top: `${y(t)}%` }}>
              {pct(t)}
            </span>
          ))}
        </div>
        <div
          className="aa-line-plot"
          ref={box}
          onMouseMove={(e) => {
            const r = box.current!.getBoundingClientRect()
            const at = ((e.clientX - r.left) / r.width) * (t1 - t0) + t0
            let best = 0
            rows.forEach((row, i) => {
              if (
                Math.abs(Date.parse(`${row.month}-01`) - at) <
                Math.abs(Date.parse(`${rows[best].month}-01`) - at)
              )
                best = i
            })
            setHover(best)
          }}
          onMouseLeave={() => setHover(null)}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label={l(
              `Share of Riksdag speeches mentioning AI, ${first} to ${last}; rising to ${pct(rows[rows.length - 1].ai_share_rolling_3m)} at the end.`,
              `Andel riksdagsanföranden som nämner AI, ${first} till ${last}; ${pct(rows[rows.length - 1].ai_share_rolling_3m)} i slutet.`,
            )}
          >
            {ticks.map((t) => (
              <line
                key={t}
                x1="0"
                x2="100"
                y1={y(t)}
                y2={y(t)}
                className="aa-grid"
              />
            ))}
            {milestones.map((m) => (
              <line
                key={m.milestone_id}
                x1={x(m.date)}
                x2={x(m.date)}
                y1="0"
                y2="100"
                className="aa-milestone-line"
              />
            ))}
            <path d={path} className="aa-line" />
            {point && (
              <line
                x1={x(point.month)}
                x2={x(point.month)}
                y1="0"
                y2="100"
                className="aa-crosshair"
              />
            )}
          </svg>
          {milestones.map((m, i) => {
            // A tag too close to the previous one moves up a row instead of covering it.
            const crowded = i > 0 && x(m.date) - x(milestones[i - 1].date) < 2.5
            return (
              <span
                key={m.milestone_id}
                className={`aa-milestone-tag${crowded ? ' is-raised' : ''}`}
                style={{ left: `${x(m.date)}%` }}
              >
                {i + 1}
              </span>
            )
          })}
          {point && (
            <span
              className="aa-dot"
              style={{
                left: `${x(point.month)}%`,
                top: `${y(point.ai_share_rolling_3m)}%`,
              }}
            />
          )}
          {point && (
            <div
              className="aa-tooltip"
              style={{ left: `${Math.min(78, Math.max(2, x(point.month)))}%` }}
              role="status"
            >
              <strong>{point.month}</strong>
              <span>
                {pct(point.ai_share_rolling_3m, 2)} {l('(3 months)', '(3 mån)')}
              </span>
              <span>
                {l(
                  `${point.ai_speeches} of ${num(point.speeches)} speeches this month`,
                  `${point.ai_speeches} av ${num(point.speeches)} anföranden denna månad`,
                )}
              </span>
            </div>
          )}
        </div>
        <div className="aa-line-x" aria-hidden="true">
          {years.map((yr) => (
            <span key={yr} style={{ left: `${x(`${yr}-01`)}%` }}>
              {yr}
            </span>
          ))}
        </div>
        <figcaption>
          <ol className="aa-milestone-key">
            {milestones.map((m, i) => (
              <li key={m.milestone_id}>
                <b>{i + 1}</b> {fmtDate(m.date, true)}:{' '}
                {pick({ en: m.title_en, sv: m.title_sv })}
              </li>
            ))}
          </ol>
          <p className="aa-caveat">
            {l(
              'Temporal overlap does not prove causation: AI was in the news for many reasons over these years, and a speech that mentions AI need not concern the Act.',
              'Samtidighet bevisar inte orsak: AI var i nyheterna av många skäl under de här åren, och ett anförande som nämner AI behöver inte handla om förordningen.',
            )}
          </p>
        </figcaption>
      </figure>
      <button
        type="button"
        className="aa-table-toggle"
        onClick={() => setTable(!table)}
        aria-expanded={table}
      >
        {table
          ? l('Hide the numbers', 'Dölj siffrorna')
          : l('Show the numbers per year', 'Visa siffrorna per år')}
      </button>
      {table && (
        <div
          className="aa-table-wrap"
          tabIndex={0}
          aria-label={l('AI speeches per year', 'AI-anföranden per år')}
        >
          <table className="aa-table">
            <thead>
              <tr>
                <th scope="col">{l('Year', 'År')}</th>
                <th scope="col">{l('Speeches', 'Anföranden')}</th>
                <th scope="col">{l('Mention AI', 'Nämner AI')}</th>
                <th scope="col">{l('Share', 'Andel')}</th>
              </tr>
            </thead>
            <tbody>
              {yearly.map((r) => (
                <tr key={r.year}>
                  <td>{r.year}</td>
                  <td>{num(r.speeches)}</td>
                  <td>{num(r.ai)}</td>
                  <td>{pct(r.share, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ concepts

function ConceptBars({ politics }: { politics: PoliticsData }) {
  const [period, setPeriod] = useState('all')
  const s = politics.summary
  const rows = politics.concepts
    .filter((r) => r.party === 'ALL' && r.period === period)
    .sort((a, b) => b.share - a.share)
  const label = (id: string) => {
    const c = s.concepts.find((x) => x.concept_id === id)
    return c ? l(c.label_en, c.label_sv) : id
  }
  const n = rows[0]?.ai_speeches ?? 0
  const max = Math.max(0.01, ...rows.map((r) => r.share))
  return (
    <section className="aa-section" aria-labelledby="aa-concepts-title">
      <h2 id="aa-concepts-title">
        {l('What AI is talked about with', 'Vad AI pratas om tillsammans med')}
      </h2>
      <p className="aa-muted aa-small">
        {l(
          `Share of the speeches about AI whose AI paragraphs use each group of words (n = ${n}).`,
          `Andel av anförandena om AI vars AI-stycken använder respektive ordgrupp (n = ${n}).`,
        )}
      </p>
      <div
        className="aa-filters"
        role="group"
        aria-label={l('Period', 'Period')}
      >
        <button
          type="button"
          aria-pressed={period === 'all'}
          onClick={() => setPeriod('all')}
        >
          {l('Whole period', 'Hela perioden')}
        </button>
        {s.phases.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={period === p.id}
            onClick={() => setPeriod(p.id)}
          >
            {l(p.label_en, p.label_sv)}
          </button>
        ))}
      </div>
      <ul className="aa-bars">
        {rows.map((r) => (
          <li key={r.concept_id}>
            <span className="aa-bar-label">{label(r.concept_id)}</span>
            <span className="aa-bar-track">
              <span
                className="aa-bar"
                style={{ width: `${(r.share / max) * 100}%` }}
              />
            </span>
            <span className="aa-bar-value">
              {pct(r.share, 0)} <small>({r.speeches_with_concept})</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ------------------------------------------------------------------ parties

function Swatch({ party }: { party: string }) {
  return (
    <span
      className="aa-swatch"
      style={{ background: PARTY_IDENTITY[party]?.color ?? '#888' }}
      aria-hidden="true"
    />
  )
}

function Parties({ politics }: { politics: PoliticsData }) {
  const totals = partyTotals(politics.partyYear)
  const max = Math.max(...totals.map((t) => t.share))
  const concepts = politics.summary.concepts.filter((c) => c.kind === 'framing')
  const [phase, setPhase] = useState('all')
  const cell = (party: string, concept: string) =>
    politics.concepts.find(
      (r) =>
        r.party === party && r.period === phase && r.concept_id === concept,
    )
  const top = Math.max(
    0.01,
    ...politics.concepts
      .filter((r) => r.party !== 'ALL' && r.period === phase)
      .map((r) => r.share),
  )
  return (
    <section className="aa-section" aria-labelledby="aa-parties-title">
      <h2 id="aa-parties-title">{l('Party by party', 'Parti för parti')}</h2>
      <p className="aa-muted aa-small">
        {l(
          'Share of each party’s speeches that mention AI over the whole period. Parties differ in how many speeches they give, so shares, not counts.',
          'Andel av varje partis anföranden som nämner AI under hela perioden. Partierna håller olika många anföranden, så andelar, inte antal.',
        )}
      </p>
      <ul className="aa-bars">
        {totals.map((t) => (
          <li key={t.party}>
            <span className="aa-bar-label">
              <Swatch party={t.party} /> {t.party}
            </span>
            <span className="aa-bar-track">
              <span
                className="aa-bar"
                style={{ width: `${(t.share / max) * 100}%` }}
              />
            </span>
            <span className="aa-bar-value">
              {pct(t.share, 2)}{' '}
              <small>
                ({t.ai} / {num(t.speeches)})
              </small>
            </span>
          </li>
        ))}
      </ul>

      <h3 className="aa-subhead">
        {l(
          'Which words each party’s AI speeches use',
          'Vilka ord partiernas AI-anföranden använder',
        )}
      </h3>
      <div
        className="aa-filters"
        role="group"
        aria-label={l('Period', 'Period')}
      >
        <button
          type="button"
          aria-pressed={phase === 'all'}
          onClick={() => setPhase('all')}
        >
          {l('Whole period', 'Hela perioden')}
        </button>
        {politics.summary.phases.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={phase === p.id}
            onClick={() => setPhase(p.id)}
          >
            {l(p.label_en, p.label_sv)}
          </button>
        ))}
      </div>
      <div
        className="aa-matrix-wrap"
        tabIndex={0}
        aria-label={l('Concepts by party', 'Begrepp per parti')}
      >
        <table className="aa-matrix aa-heat">
          <caption className="visually-hidden">
            {l(
              'Share of each party’s AI speeches using each group of words',
              'Andel av varje partis AI-anföranden som använder respektive ordgrupp',
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Party (n)', 'Parti (n)')}</th>
              {concepts.map((c) => (
                <th key={c.concept_id} scope="col">
                  <span>{l(c.label_en, c.label_sv)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PARTIES.map((p) => {
              const n = cell(p, concepts[0].concept_id)?.ai_speeches ?? 0
              return (
                <tr key={p} className={n < 20 ? 'is-small' : ''}>
                  <th scope="row">
                    <Swatch party={p} /> {p} <small>({n})</small>
                  </th>
                  {concepts.map((c) => {
                    const r = cell(p, c.concept_id)
                    return (
                      <td
                        key={c.concept_id}
                        style={{
                          ['--v' as string]: r
                            ? String(0.06 + (0.38 * r.share) / top)
                            : '0',
                        }}
                        title={
                          r
                            ? `${r.speeches_with_concept} / ${r.ai_speeches}`
                            : ''
                        }
                      >
                        {r && r.ai_speeches > 0 ? pct(r.share, 0) : '–'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="aa-muted aa-small">
        {l(
          'Faded rows have fewer than 20 AI speeches in the period: read them as anecdotes, not patterns.',
          'Bleka rader har färre än 20 AI-anföranden under perioden: läs dem som enskilda exempel, inte mönster.',
        )}
      </p>
    </section>
  )
}

// ------------------------------------------------------------------ framing

function Framing({ politics }: { politics: PoliticsData }) {
  const s = politics.summary
  const label = (id: string) => {
    const c = s.concepts.find((x) => x.concept_id === id)
    return c ? l(c.label_en, c.label_sv) : id
  }
  return (
    <section className="aa-section" aria-labelledby="aa-framing-title">
      <h2 id="aa-framing-title">
        {l(
          'Framing: which side of a pair',
          'Inramning: vilken sida av ett par',
        )}
      </h2>
      <p className="aa-muted aa-small">
        {l(
          'For each pair, how many of a party’s AI speeches use the words of each side; the bar shows the balance (A − B) / (A + B). Below ten speeches using either side there is no bar. A description of vocabulary, not of motives or positions.',
          'För varje par: hur många av ett partis AI-anföranden som använder orden på respektive sida; stapeln visar balansen (A − B) / (A + B). Under tio anföranden som använder någon sida visas ingen stapel. En beskrivning av ordval, inte av motiv eller ståndpunkter.',
        )}
      </p>
      <div className="aa-pairs">
        {s.pairs.map((pair) => (
          <article key={pair.pair_id} className="aa-pair">
            <h3>
              <span>{label(pair.concept_b)}</span>
              <span>{label(pair.concept_a)}</span>
            </h3>
            <ul>
              {['ALL', ...PARTIES].map((party) => {
                const r = politics.framing.find(
                  (f) =>
                    f.pair_id === pair.pair_id &&
                    f.party === party &&
                    f.period === 'all',
                )
                if (!r) return null
                const word = balanceWord(r.balance)
                return (
                  <li key={party} className={party === 'ALL' ? 'is-all' : ''}>
                    <span className="aa-pair-party">
                      {party === 'ALL' ? (
                        l('All', 'Alla')
                      ) : (
                        <>
                          <Swatch party={party} /> {party}
                        </>
                      )}
                    </span>
                    <span className="aa-diverging" aria-hidden="true">
                      {r.balance != null && (
                        <span
                          className="aa-diverging-bar"
                          style={
                            r.balance >= 0
                              ? { left: '50%', width: `${r.balance * 50}%` }
                              : { right: '50%', width: `${-r.balance * 50}%` }
                          }
                        />
                      )}
                    </span>
                    <span className="aa-pair-counts">
                      {r.speeches_b} · {r.speeches_a}
                      <span className="visually-hidden">
                        {word === 'few'
                          ? l(' too few to compare', ' för få för att jämföra')
                          : word === 'a'
                            ? ` ${l('leans to', 'lutar mot')} ${label(pair.concept_a)}`
                            : word === 'b'
                              ? ` ${l('leans to', 'lutar mot')} ${label(pair.concept_b)}`
                              : l(' about even', ' ungefär jämnt')}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </article>
        ))}
      </div>
      <p className="aa-muted aa-small">
        {l(
          '“Safety / security” is the Swedish säkerhet, which covers both; the narrower security pair uses cybersecurity, national security and defence.',
          '”Säkerhet” täcker både safety och security; det snävare paret använder cybersäkerhet, nationell säkerhet och försvar.',
        )}
      </p>
    </section>
  )
}

// ------------------------------------------------------------------ examples

function Excerpt({ e }: { e: PoliticsData['examples'][number] }) {
  return (
    <li className="aa-excerpt">
      <p className="aa-meta">
        {fmtDate(e.speech_date, true)} · {e.speaker} · {e.debate_title}
      </p>
      <blockquote>
        <Kind type="source" label={SPEECH} /> {e.text}
      </blockquote>
      <Source href={e.source_url}>
        {l('The speech on riksdagen.se', 'Anförandet på riksdagen.se')}
      </Source>
    </li>
  )
}

function NamedAct({ politics }: { politics: PoliticsData }) {
  const named = politics.examples.filter((e) => e.concept_id === 'ai_act')
  const [all, setAll] = useState(false)
  return (
    <section className="aa-section" aria-labelledby="aa-named-title">
      <h2 id="aa-named-title">
        {l(
          `The ${named.length} paragraphs that name the AI Act`,
          `De ${named.length} stycken som nämner AI-förordningen`,
        )}
      </h2>
      <ol className="aa-excerpts">
        {(all ? named : named.slice(0, 4)).map((e) => (
          <Excerpt key={`${e.speech_id}:${e.paragraph}`} e={e} />
        ))}
      </ol>
      {named.length > 4 && (
        <button
          type="button"
          className="aa-table-toggle"
          onClick={() => setAll(!all)}
        >
          {all
            ? l('Show fewer', 'Visa färre')
            : l(`Show all ${named.length}`, `Visa alla ${named.length}`)}
        </button>
      )}
    </section>
  )
}

function Examples({ politics }: { politics: PoliticsData }) {
  const concepts = politics.summary.concepts.filter((c) => c.kind === 'framing')
  const [concept, setConcept] = useState(concepts[0].concept_id)
  const items = politics.examples.filter((e) => e.concept_id === concept)
  return (
    <section className="aa-section" aria-labelledby="aa-examples-title">
      <h2 id="aa-examples-title">
        {l('Read the words behind the counts', 'Läs orden bakom siffrorna')}
      </h2>
      <div className="aa-filters">
        <label>
          <span>{l('Group of words', 'Ordgrupp')}</span>
          <select value={concept} onChange={(e) => setConcept(e.target.value)}>
            {concepts.map((c) => (
              <option key={c.concept_id} value={c.concept_id}>
                {l(c.label_en, c.label_sv)}
              </option>
            ))}
          </select>
        </label>
        <span className="aa-muted aa-small">
          {l(
            'The six most recent paragraphs, not a sample.',
            'De sex senaste styckena, inte ett urval.',
          )}
        </span>
      </div>
      <ol className="aa-excerpts">
        {items.map((e) => (
          <Excerpt key={`${e.speech_id}:${e.paragraph}`} e={e} />
        ))}
      </ol>
    </section>
  )
}

// ------------------------------------------------------------------ similarity

function Similarity({ politics }: { politics: PoliticsData }) {
  const [rows, setRows] = useState<SimilarityRow[] | null>(null)
  const [open, setOpen] = useState(false)
  const [article, setArticle] = useState('14')
  useEffect(() => {
    if (open && !rows)
      loadSimilarity()
        .then(setRows)
        .catch(() => setRows([]))
  }, [open])
  const articles = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.article_number))],
    [rows],
  )
  const shown = (rows ?? []).filter((r) => r.article_number === article)
  const s = politics.summary.similarity
  return (
    <section className="aa-section" aria-labelledby="aa-sim-title">
      <h2 id="aa-sim-title">
        {l(
          'Which speeches sit closest to an article',
          'Vilka anföranden ligger närmast en artikel',
        )}{' '}
        <Kind type="derived" />
      </h2>
      <p className="aa-muted aa-small">
        {l(
          `Semantic similarity: the Act’s Swedish text and the Riksdag’s AI paragraphs embedded with one multilingual model (${s.model.split('/')[1]}). Random speech–article pairs average ${s.baseline_random_pairs.mean.toFixed(2)}; only pairs above their 95th percentile (${s.baseline_random_pairs.p95.toFixed(2)}) are shown. Close language is not influence, a response to the Act, or shared meaning.`,
          `Semantisk likhet: lagens svenska text och riksdagens AI-stycken inbäddade med en och samma flerspråkiga modell (${s.model.split('/')[1]}). Slumpvisa par av anförande och artikel ligger i snitt på ${s.baseline_random_pairs.mean.toFixed(2)}; bara par över deras 95:e percentil (${s.baseline_random_pairs.p95.toFixed(2)}) visas. Likt språk är inte påverkan, ett svar på lagen eller samma mening.`,
        )}
      </p>
      {!open ? (
        <button
          type="button"
          className="aa-table-toggle"
          onClick={() => setOpen(true)}
        >
          {l('Open the comparison', 'Öppna jämförelsen')}
        </button>
      ) : !rows ? (
        <p className="aa-muted">{l('Loading…', 'Laddar…')}</p>
      ) : (
        <>
          <div className="aa-filters">
            <label>
              <span>{l('Article', 'Artikel')}</span>
              <select
                value={article}
                onChange={(e) => setArticle(e.target.value)}
              >
                {articles.map((a) => (
                  <option key={a} value={a}>
                    {l('Article', 'Artikel')} {a}
                  </option>
                ))}
              </select>
            </label>
            <ArticleLink n={article}>
              {l('Read the article', 'Läs artikeln')}
            </ArticleLink>
          </div>
          <ol className="aa-sim">
            {shown.map((r) => (
              <li key={r.rank}>
                <div>
                  <p className="aa-kicker">
                    {l('The Act (Swedish text)', 'Lagen (svensk text)')} ·{' '}
                    {r.act_passage_id
                      .replace('art_', l('Art. ', 'Art. '))
                      .replace(':', ', ')}
                  </p>
                  <blockquote>
                    <Kind type="source" /> {r.act_passage_sv}
                  </blockquote>
                </div>
                <div>
                  <p className="aa-kicker">
                    {fmtDate(r.speech_date, true)} · {r.speaker}
                  </p>
                  <blockquote>
                    <Kind type="source" label={SPEECH} /> {r.speech_paragraph}
                  </blockquote>
                  <Source href={r.speech_url}>
                    {l('The speech', 'Anförandet')}
                  </Source>
                </div>
                <p className="aa-sim-score">
                  {l('similarity', 'likhet')} <b>{r.similarity.toFixed(2)}</b>
                </p>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="aa-muted">
                {l(
                  'No pair above chance for this article.',
                  'Inget par över slumpnivån för den här artikeln.',
                )}
              </li>
            )}
          </ol>
        </>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ method

function Method({ politics }: { politics: PoliticsData }) {
  const s = politics.summary
  return (
    <section className="aa-section" aria-labelledby="aa-method-title">
      <h2 id="aa-method-title">
        {l('Method: the dictionary', 'Metod: ordlistan')}
      </h2>
      <p className="aa-muted aa-small">
        {l(
          'A speech is about AI when one of its paragraphs matches the AI words (upper-case AI, artificial intelligence, machine learning, language models and similar). The groups of words are then looked for in those paragraphs only, so a speech on the budget that mentions AI once does not count its other paragraphs. Matching words is not understanding: a paragraph can use a word to reject an idea.',
          'Ett anförande handlar om AI när ett av dess stycken matchar AI-orden (AI med versaler, artificiell intelligens, maskininlärning, språkmodeller och liknande). Ordgrupperna söks sedan bara i de styckena, så ett budgetanförande som nämner AI en gång räknar inte sina övriga stycken. Att matcha ord är inte att förstå: ett stycke kan använda ett ord för att avvisa en idé.',
        )}
      </p>
      <div
        className="aa-table-wrap"
        tabIndex={0}
        aria-label={l('The dictionary', 'Ordlistan')}
      >
        <table className="aa-table aa-dictionary">
          <thead>
            <tr>
              <th scope="col">{l('Group', 'Grupp')}</th>
              <th scope="col">{l('What it captures', 'Vad den fångar')}</th>
              <th scope="col">
                {l(
                  'Pattern (regular expression)',
                  'Mönster (reguljärt uttryck)',
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {s.concepts.map((c) => (
              <tr key={c.concept_id}>
                <td>
                  {l(c.label_en, c.label_sv)}
                  {c.kind === 'gate' && <small> · {l('gate', 'grind')}</small>}
                </td>
                <td>
                  {l(c.description_en, c.description_sv)}
                  {c.caveat_en && (
                    <small className="aa-muted"> {c.caveat_en}</small>
                  )}
                </td>
                <td>
                  <code>{c.pattern}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="aa-list aa-small">
        <li>
          {l(
            'Source: every speech in Riksdagen’s open data, one archive per session, stored with its SHA-256.',
            'Källa: varje anförande i Riksdagens öppna data, ett arkiv per riksmöte, sparat med SHA-256.',
          )}{' '}
          <Source href={s.source.url}>riksdagen.se</Source>
        </li>
        <li>
          {l(
            'Parties as recorded; the Speaker and members without a party are counted in “All” only.',
            'Partier som de registrerats; talmannen och partilösa räknas bara under ”Alla”.',
          )}
        </li>
        <li>
          {l(
            'Ministers speak with their party code, so a governing party’s count includes its ministers.',
            'Statsråd talar med sin partibeteckning, så ett regeringspartis siffror inkluderar dess statsråd.',
          )}
        </li>
        <li>
          {l(
            'Phases: before the Commission’s proposal (21 April 2021), until publication (12 July 2024), after.',
            'Faser: före kommissionens förslag (21 april 2021), fram till publiceringen (12 juli 2024), efter.',
          )}
        </li>
      </ul>
    </section>
  )
}
