/**
 * Concept Journey (#concept-journey?begrepp=death): pick an idea and follow where related
 * language appears in stories, philosophy, the Riksdag and the AI Act.
 *
 * Read first: the question, the picker, a small constellation of the four domains for the chosen
 * concept, and why it is worth looking at. Then one section per domain with how often the concept
 * is the closest there, representative passages with their source, and the measures elsewhere on
 * the site that count the same idea. Every link states its relation type; nothing here says one
 * text influenced another. A domain with no linked measure shows none; nothing is filled in.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { useViewParams } from '../report/useViewParams'
import { Feature } from '../charts/feature/Feature'
import { fetchData } from '../dataSource'
import { DataQuestion, Interpretation, QualityBrief } from '../ui/Story'
import {
  CORPUS_ORDER,
  JOURNEY_CONCEPTS,
  excerpt,
  pct,
  profileOf,
  strongestWeakest,
} from './logic'
import type {
  Concept,
  ConceptSummary,
  Link,
  Pair,
  Passage,
  Profile,
  Relations,
} from './types'

type Data = {
  summary: ConceptSummary
  profiles: Profile[]
  relations: Relations
  links: Link[]
}

const DOMAIN: Record<string, { en: string; sv: string; shape: string }> = {
  myth: { en: 'Stories', sv: 'Berättelser', shape: 'circle' },
  philosophy: { en: 'Ideas', sv: 'Idéer', shape: 'diamond' },
  politics: { en: 'Public debate', sv: 'Offentlig debatt', shape: 'square' },
  law: { en: 'Rules', sv: 'Regler', shape: 'triangle' },
}
const RELATION: Record<string, [string, string]> = {
  semantic_similarity: ['Semantic similarity', 'Semantisk likhet'],
  shared_concept: ['Shared concept', 'Gemensamt begrepp'],
  shared_tension: ['Shared tension', 'Gemensam spänning'],
  temporal_overlap: ['Temporal overlap', 'Samtidighet'],
  documented_reference: ['Documented reference', 'Dokumenterad hänvisning'],
}
const STATUS: Record<string, [string, string]> = {
  derived: ['derived', 'härlett'],
  reviewed: ['reviewed', 'granskat'],
  experimental: ['experimental', 'experimentellt'],
  editorial: ['editorial', 'redaktionellt'],
}
const DEFAULTS = { begrepp: 'death' }
const label = (c: { label_en: string; label_sv: string }) =>
  l(c.label_en, c.label_sv)

async function json<T>(path: string): Promise<T> {
  const r = await fetchData(path)
  if (!r.ok) throw new Error(path)
  return r.json()
}

function Relation({ type, status }: { type: string; status: string }) {
  return (
    <span className="cj-relation">
      <i className={`cj-line cj-line-${type}`} aria-hidden="true" />
      {l(...RELATION[type])}
      <span className="cj-status">{l(...STATUS[status])}</span>
    </span>
  )
}

export default function Journey({ route, data }: { route: Route; data: Data }) {
  const [params] = useViewParams(route, DEFAULTS)
  const [passages, setPassages] = useState<Record<
    string,
    Record<string, Passage[]>
  > | null>(null)
  const [pairs, setPairs] = useState<Pair[]>([])
  useEffect(() => {
    json<Record<string, Record<string, Passage[]>>>('concepts/passages.json')
      .then(setPassages)
      .catch(() => setPassages({}))
    json<Pair[]>('concepts/pairs.json')
      .then(setPairs)
      .catch(() => setPairs([]))
  }, [])
  const { summary } = data
  const conceptOf = (id: string) =>
    summary.concepts.find((c) => c.concept_id === id)
  const featured = JOURNEY_CONCEPTS.map(conceptOf).filter(
    (c): c is Concept => c != null,
  )
  const concept =
    conceptOf(params.begrepp) ?? featured[0] ?? summary.concepts[0]
  const id = concept.concept_id
  const profile = profileOf(data.profiles, id)
  const links = data.links.filter((k) => k.concept_id === id)
  const own = pairs.filter((p) => p.concept_id === id)
  const reference = data.relations.corpora.find(
    (r) => r.relation_type === 'documented_reference',
  )
  const corpusOf = (c: string) => summary.corpora.find((k) => k.corpus_id === c)
  const ev = summary.run.evaluation

  return (
    <>
      <div className="report-main">
        <Feature
          id="resan"
          title={l(
            `${label(concept)} in stories, ideas, debate and rules`,
            `${label(concept)} i berättelser, idéer, debatt och regler`,
          )}
          lead={l(concept.description_en, concept.description_sv)}
          source={`${summary.run.model}; ${l('how often the concept is a passage’s closest, against chance', 'hur ofta begreppet är en passages närmaste, mot slumpen')}`}
        >
          <JourneyMap concept={concept} profile={profile} pairs={own} />
          <WhyItMatters concept={concept} profile={profile} links={links} />
        </Feature>
      </div>

      <div className="report-main">
        <Feature
          id="passagerna"
          title={l(
            'The closest passages in each domain',
            'De närmaste passagerna i varje domän',
          )}
          lead={l(
            'The passages the model ranks closest to the concept; no reader has judged them to be about it.',
            'Passagerna som modellen rankar närmast begreppet; ingen läsare har bedömt att de handlar om det.',
          )}
          source={l(
            'Project Gutenberg, Riksdagen and the EU Publications Office',
            'Project Gutenberg, Riksdagen och EU:s publikationsbyrå',
          )}
        >
          {CORPUS_ORDER.map((c) => {
            const k = corpusOf(c)
            if (!k) return null
            const p = profile.find((x) => x.corpus_id === c)
            const list = (passages?.[id]?.[c] ?? []).slice(0, 2)
            return (
              <section
                key={c}
                className={`cj-domain cj-domain-${c}`}
                aria-labelledby={`cj-${c}`}
              >
                <DataQuestion
                  id={`cj-${c}`}
                  eyebrow={label(k)}
                  question={l(DOMAIN[c].en, DOMAIN[c].sv)}
                >
                  {p && (
                    <p>
                      {l(
                        `${label(concept)} is the closest of the ${summary.concepts.length} concepts in ${pct(p.rank1_share)} of the passages here, ${p.rank1_lift.toFixed(1)} times what chance would give.`,
                        `${label(concept)} är det närmaste av de ${summary.concepts.length} begreppen i ${pct(p.rank1_share)} av passagerna här, ${p.rank1_lift.toFixed(1).replace('.', ',')} gånger vad slumpen skulle ge.`,
                      )}
                    </p>
                  )}
                </DataQuestion>
                {!passages ? (
                  <p className="cj-note">{l('Loading…', 'Laddar…')}</p>
                ) : list.length === 0 ? (
                  <p className="cj-note">
                    {l(
                      'No passage here ranks this concept among its three closest.',
                      'Ingen passage här har begreppet bland sina tre närmaste.',
                    )}
                  </p>
                ) : (
                  <ol className="cj-passages">
                    {list.map((x) => (
                      <li key={x.chunk_id} lang={x.language}>
                        <p className="cj-excerpt">{excerpt(x.text)}</p>
                        <p className="cj-source">
                          <a
                            href={x.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {x.document_title}
                          </a>
                          , {x.location},{' '}
                          <Relation
                            type="semantic_similarity"
                            status="derived"
                          />{' '}
                          <span className="cj-muted">
                            {l('similarity', 'likhet')}{' '}
                            {x.similarity.toFixed(2)} , {l('rank', 'rang')}{' '}
                            {x.rank}/{summary.concepts.length}
                          </span>
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
                <DomainLinks corpus={c} links={links} />
              </section>
            )
          })}
        </Feature>
      </div>

      <div className="report-main">
        <Feature
          id="forbindelser"
          title={l('What connects them?', 'Vad förbinder dem?')}
          lead={l(
            'Pairs of passages from different domains that sit closer than random pairs usually do.',
            'Par av passager från olika domäner som ligger närmare än slumpvisa par brukar göra.',
          )}
          source={l(
            'Cosine similarity against the 95th percentile of random pairs',
            'Cosinuslikhet mot 95:e percentilen för slumpvisa par',
          )}
        >
          {own.length ? (
            <ul className="cj-pairs">
              {own.slice(0, 3).map((p) => (
                <li key={`${p.corpus_a}-${p.corpus_b}`}>
                  <p className="cj-pair-head">
                    {label(corpusOf(p.corpus_a)!)} ↔{' '}
                    {label(corpusOf(p.corpus_b)!)},{' '}
                    <Relation type="semantic_similarity" status="derived" />{' '}
                    <span className="cj-muted">
                      {p.similarity.toFixed(2)} (
                      {l(
                        'random pairs, 95th percentile',
                        'slumpvisa par, 95:e percentilen',
                      )}{' '}
                      {p.baseline_p95.toFixed(2)})
                    </span>
                  </p>
                  <div className="cj-pair">
                    <blockquote lang={p.language_a}>
                      <p>{excerpt(p.text_a, 220)}</p>
                      <a href={p.url_a} target="_blank" rel="noreferrer">
                        {p.title_a}
                      </a>
                    </blockquote>
                    <blockquote lang={p.language_b}>
                      <p>{excerpt(p.text_b, 220)}</p>
                      <a href={p.url_b} target="_blank" rel="noreferrer">
                        {p.title_b}
                      </a>
                    </blockquote>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cj-note">
              {l(
                'No pair of passages from different domains is closer than random pairs usually are, for this concept.',
                'Inget par av passager från olika domäner ligger närmare än slumpvisa par brukar göra, för det här begreppet.',
              )}
            </p>
          )}
          {reference && (
            <p className="cj-note">
              <Relation type="documented_reference" status="derived" />{' '}
              {l(
                `${reference.count} Riksdag speeches name the AI Act (${reference.first.slice(0, 4)}–${reference.last.slice(0, 4)}): the one link between domains that the texts state themselves.`,
                `${reference.count} riksdagsanföranden nämner AI-förordningen (${reference.first.slice(0, 4)}–${reference.last.slice(0, 4)}): den enda länken mellan domänerna som texterna själva anger.`,
              )}{' '}
              <a href={`#${reference.route}`}>{l('Read them', 'Läs dem')}</a>
            </p>
          )}
        </Feature>
      </div>
      <Interpretation
        title={l(
          'What does not follow from this',
          'Vad som inte följer av detta',
        )}
      >
        <p>
          {l(
            'Similar wording is not the same meaning, and appearing in two domains is not influence: myths did not cause philosophy, and philosophy did not cause the AI Act. The four corpora also differ more from each other than their subjects do: ',
            'Liknande formuleringar är inte samma betydelse, och att något förekommer i två domäner är inte påverkan: myterna orsakade inte filosofin, och filosofin orsakade inte AI-förordningen. De fyra korpusarna skiljer sig dessutom mer från varandra än deras ämnen gör: ',
          )}
          {l(
            `${pct(ev.same_corpus_neighbours)} of each passage’s nearest neighbours come from its own corpus (chance ${pct(ev.same_corpus_chance)}; ${pct(ev.same_corpus_neighbours_centred)} after centring). Part of this is language: the Riksdag corpus is Swedish, the rest English. So passages are compared within a domain and through the concepts, never on one shared map.`,
            `${pct(ev.same_corpus_neighbours)} av varje passages närmaste grannar kommer från dess egen korpus (slump ${pct(ev.same_corpus_chance)}; ${pct(ev.same_corpus_neighbours_centred)} efter centrering). En del av detta är språk: riksdagskorpusen är svensk, resten engelska. Därför jämförs passagerna inom en domän och genom begreppen, aldrig på en gemensam karta.`,
          )}
        </p>
        <p>
          {l(
            'The passages are the ones the model ranks closest; no reader has judged them to be about the concept.',
            'Passagerna är de som modellen rankar närmast; ingen läsare har bedömt att de handlar om begreppet.',
          )}
        </p>
      </Interpretation>
    </>
  )
}

/** The quality of the concept layer in brief, for the method page. */
export function ConceptQuality({ summary }: { summary: ConceptSummary }) {
  return (
    <QualityBrief
      rows={[
        [
          l('Traceability', 'Spårbarhet'),
          l(
            'Every passage carries its document, location, source link and the version it was read from.',
            'Varje passage har sitt dokument, sin plats, en källänk och versionen den lästes från.',
          ),
        ],
        [
          l('Model quality', 'Modellkvalitet'),
          l(
            `One shared multilingual model for all four corpora; each Swedish anchor sentence’s nearest English anchor is the same concept for ${Math.round(summary.run.evaluation.anchor_agreement_sv_en * summary.concepts.length)} of ${summary.concepts.length} concepts.`,
            `En gemensam flerspråkig modell för alla fyra korpusarna; varje svensk ankarmenings närmaste engelska ankare är samma begrepp för ${Math.round(summary.run.evaluation.anchor_agreement_sv_en * summary.concepts.length)} av ${summary.concepts.length} begrepp.`,
          ),
        ],
        [
          l('Validity', 'Validitet'),
          l(
            'Semantic proximity is not the same meaning, and not influence.',
            'Semantisk närhet är inte samma betydelse, och inte påverkan.',
          ),
        ],
        [
          l('Review', 'Granskning'),
          l(
            'The concepts, anchor sentences, tensions and links are editorial; which passages sit closest to a concept is the model’s ranking, not a reader’s judgement.',
            'Begreppen, ankarmeningarna, spänningarna och länkarna är redaktionella; vilka passager som ligger närmast ett begrepp är modellens rangordning, inte en läsares bedömning.',
          ),
        ],
      ]}
    />
  )
}

/** Why the concept is worth following: generated from the figures shown, plus the editor’s notes. */
function WhyItMatters({
  concept,
  profile,
  links,
}: {
  concept: Concept
  profile: Profile[]
  links: Link[]
}) {
  const sw = strongestWeakest(profile)
  const notes = links.filter((k) => k.note).map((k) => k.note!)
  const domain = (p: Profile) => {
    const d = DOMAIN[p.corpus_id]
    return l(d.en, d.sv).toLowerCase()
  }
  return (
    <aside className="cj-why" aria-labelledby="cj-why-title">
      <h3 id="cj-why-title">
        {l('Why this matters', 'Varför det här är intressant')}{' '}
        <span className="cj-status">{l(...STATUS.derived)}</span>
      </h3>
      {sw && (
        <p>
          {l(
            `${label(concept)} stands out most in ${domain(sw.strongest)} (${sw.strongest.rank1_lift.toFixed(1)} times chance) and least in ${domain(sw.weakest)} (${sw.weakest.rank1_lift.toFixed(1)}).`,
            `${label(concept)} sticker ut mest i ${domain(sw.strongest)} (${sw.strongest.rank1_lift.toFixed(1).replace('.', ',')} gånger slumpen) och minst i ${domain(sw.weakest)} (${sw.weakest.rank1_lift.toFixed(1).replace('.', ',')}).`,
          )}{' '}
          {sw.weakest.rank1_lift < 0.5 &&
            l(
              'The same idea can be central in one kind of text and almost absent from another.',
              'Samma idé kan vara central i en sorts text och nästan frånvarande i en annan.',
            )}
        </p>
      )}
      {notes.length > 0 && (
        <ul>
          {notes.map((n) => (
            <li key={n}>
              {n} <span className="cj-status">{l(...STATUS.editorial)}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

/** The measures elsewhere on the site that count the same idea in one domain; nothing when none does. */
function DomainLinks({ corpus, links }: { corpus: string; links: Link[] }) {
  const items =
    corpus === 'philosophy'
      ? links.filter((k) => k.kind === 'philosophy_tension')
      : corpus === 'politics'
        ? links.filter(
            (k) => k.kind === 'riksdag_framing' || k.kind === 'job_term',
          )
        : corpus === 'law'
          ? links.filter((k) => k.kind === 'ai_act_view')
          : []
  if (!items.length) return null
  return (
    <ul className="cj-links">
      {items.map((k) => (
        <li key={`${k.kind}-${k.target_id}`}>
          {k.kind === 'philosophy_tension' && (
            <>
              <Relation type="shared_tension" status="editorial" />{' '}
              <a href={`#philosophy-tensions?spanning=${k.target_id}`}>
                {k.target ? label(k.target) : k.target_id}
              </a>
            </>
          )}
          {k.kind === 'riksdag_framing' && (
            <>
              <Relation type="shared_concept" status="derived" />{' '}
              <a href="#what-does-it-even-mean">
                {l('Riksdag AI speeches', 'Riksdagens AI-anföranden')}:{' '}
                {k.target ? label(k.target) : k.target_id}
              </a>
              {k.target?.periods?.all && (
                <span className="cj-muted">
                  {' '}
                  , {pct(k.target.periods.all.share)}{' '}
                  {l('of AI speeches', 'av AI-anförandena')}
                </span>
              )}
            </>
          )}
          {k.kind === 'job_term' && (
            <>
              <Relation type="shared_concept" status="derived" />{' '}
              <a href="#what-does-it-even-mean">
                {l('Job ads', 'Jobbannonser')}:{' '}
                {k.target ? label(k.target) : k.target_id}
              </a>
            </>
          )}
          {k.kind === 'ai_act_view' && (
            <>
              <Relation type="shared_concept" status="editorial" />{' '}
              <a href={`#${k.target_id}`}>
                {k.target_id === 'ai-act-risk'
                  ? l('AI Act risk classes', 'AI-förordningens riskklasser')
                  : l('AI Act obligations', 'AI-förordningens skyldigheter')}
              </a>
            </>
          )}
          {k.note && <span className="cj-muted">, {k.note}</span>}
        </li>
      ))}
    </ul>
  )
}

/**
 * The four domains as a small constellation: each domain a star sized by how
 * strongly the concept stands out there, with its passages around it; lines only where the data
 * has a relation of a stated type. Positions carry no meaning beyond the order of the domains.
 */
function JourneyMap({
  concept,
  profile,
  pairs,
}: {
  concept: Concept
  profile: Profile[]
  pairs: Pair[]
}) {
  const at: Record<string, { x: number; y: number }> = {
    myth: { x: 110, y: 120 },
    philosophy: { x: 310, y: 100 },
    politics: { x: 510, y: 100 },
    law: { x: 710, y: 120 },
  }
  const size = (c: string) => {
    const lift = profile.find((p) => p.corpus_id === c)?.rank1_lift ?? 0
    return 5 + Math.min(18, Math.sqrt(lift) * 9)
  }
  const shape = (c: string, r: number) => {
    const { x, y } = at[c]
    switch (DOMAIN[c].shape) {
      case 'diamond':
        return (
          <polygon
            points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
          />
        )
      case 'square':
        return (
          <rect
            x={x - r * 0.8}
            y={y - r * 0.8}
            width={r * 1.6}
            height={r * 1.6}
          />
        )
      case 'triangle':
        return (
          <polygon
            points={`${x},${y - r} ${x + r},${y + r * 0.8} ${x - r},${y + r * 0.8}`}
          />
        )
      default:
        return <circle cx={x} cy={y} r={r} />
    }
  }
  const lines = pairs.map((p) => ({ a: p.corpus_a, b: p.corpus_b }))
  // Soft arcs above the stars, higher for domains further apart, so no line crosses a label.
  const arc = (a: string, b: string) => {
    const [p, q] = [at[a], at[b]]
    const top = Math.min(p.y, q.y) - 24 - Math.abs(q.x - p.x) * 0.12
    return `M${p.x},${p.y} Q${(p.x + q.x) / 2},${top} ${q.x},${q.y}`
  }
  const text = CORPUS_ORDER.map((c) => {
    const p = profile.find((x) => x.corpus_id === c)
    return `${l(DOMAIN[c].en, DOMAIN[c].sv)}: ${p ? p.rank1_lift.toFixed(1) : '–'}`
  }).join(', ')
  return (
    <figure className="cj-map">
      <svg
        viewBox="0 0 820 200"
        role="img"
        aria-label={l(
          `${label(concept)} across the four domains, times chance: ${text}. ${lines.length} links by semantic similarity.`,
          `${label(concept)} i de fyra domänerna, gånger slumpen: ${text}. ${lines.length} länkar genom semantisk likhet.`,
        )}
      >
        {lines.map(({ a, b }) => (
          <path
            key={`${a}-${b}`}
            className="cj-edge cj-edge-semantic_similarity"
            d={arc(a, b)}
          />
        ))}
        {CORPUS_ORDER.map((c) => {
          const r = size(c)
          const p = profile.find((x) => x.corpus_id === c)
          return (
            <g key={c} className={`cj-star cj-star-${c}`}>
              {shape(c, r)}
              <text x={at[c].x} y={at[c].y + r + 22} className="cj-star-label">
                {l(DOMAIN[c].en, DOMAIN[c].sv)}
              </text>
              <text x={at[c].x} y={at[c].y + r + 38} className="cj-star-value">
                {p ? `${p.rank1_lift.toFixed(1)}×` : '–'}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>
        <span>
          {l(
            'Size: how often the concept is a passage’s closest, against chance.',
            'Storlek: hur ofta begreppet är en passages närmaste, mot slumpen.',
          )}
        </span>
        <span>
          <i
            className="cj-line cj-line-semantic_similarity"
            aria-hidden="true"
          />{' '}
          {l(
            'Semantic similarity above random pairs',
            'Semantisk likhet över slumpvisa par',
          )}
        </span>
        <span className="cj-caveat">
          {l(
            'Semantic similarity does not establish historical influence.',
            'Semantisk likhet visar inte historisk påverkan.',
          )}
        </span>
      </figcaption>
    </figure>
  )
}
