/**
 * Concept Journey (#concept-journey?begrepp=risk): pick an idea and follow where related
 * language appears in stories, philosophy, the Riksdag and the AI Act.
 *
 * Read first: the question, the picker, a small constellation of the four domains for the chosen
 * concept, and why it is worth looking at. Then one section per domain with how often the concept
 * is the closest there, representative passages with their source, and the measures elsewhere on
 * the site that count the same idea. Every link states its relation type; nothing here says one
 * text influenced another. Only reviewed Symbolic Atlas clusters may be tied to a concept, and
 * there are none yet, so the stories section says so.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { useViewParams } from '../politik/useViewParams'
import { ProjectHero } from '../ui/Project'
import { fetchData } from '../dataSource'
import {
  DataQuestion,
  Interpretation,
  MethodSummary,
  QualityBrief,
} from '../ui/Story'
import { TraceResult } from '../ui/Trace'
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
const DEFAULTS = { begrepp: 'risk' }
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

export default function Journey({
  route,
  data,
  metrics,
}: {
  route: Route
  data: Data
  metrics?: ReactNode
}) {
  const [params, set] = useViewParams(route, DEFAULTS)
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

  return (
    <>
      <div className="ds-container">
        <ProjectHero
          project="concept-constellation"
          status={
            <div
              className="cj-picker"
              role="group"
              aria-label={l('Pick an idea', 'Välj en idé')}
            >
              <p className="project-hero-label">
                {l('Pick an idea →', 'Välj en idé →')}
              </p>
              {featured.map((c) => (
                <button
                  key={c.concept_id}
                  type="button"
                  aria-pressed={c.concept_id === id}
                  onClick={() => set({ begrepp: c.concept_id })}
                >
                  {label(c)}
                </button>
              ))}
              <a href="#concept-constellation">
                {l(
                  `All ${summary.concepts.length} concepts`,
                  `Alla ${summary.concepts.length} begrepp`,
                )}
              </a>
            </div>
          }
          nav={[
            {
              href: '#concept-constellation',
              label: l('Constellation', 'Konstellationen'),
            },
            { href: '#concepts-profiles', label: l('Profiles', 'Profiler') },
            { href: '#concepts-method', label: l('Method', 'Metod') },
          ]}
        >
          <p>
            {l(
              'Pick an idea. The page shows where related language appears in myths and folk tales, in philosophy, in Riksdag speeches and in the EU AI Act.',
              'Välj en idé. Sidan visar var närliggande språk förekommer i myter och folksagor, i filosofi, i riksdagsanföranden och i EU:s AI-förordning.',
            )}{' '}
            {l(
              'This shows semantic similarity, not historical influence.',
              'Det här visar semantisk likhet, inte historisk påverkan.',
            )}
          </p>
        </ProjectHero>
        {metrics}
      </div>

      <div className="cc-body ds-container cj-body">
        <section className="cj-overview" aria-labelledby="cj-concept">
          <h2 id="cj-concept" className="cj-concept-title">
            {label(concept)}
          </h2>
          <p className="cj-description">
            {l(concept.description_en, concept.description_sv)}
          </p>
          <JourneyMap
            concept={concept}
            profile={profile}
            pairs={own}
            reference={reference?.count ?? 0}
          />
          <WhyItMatters concept={concept} profile={profile} links={links} />
        </section>

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
              {c === 'myth' && (
                <p className="cj-note">
                  {l(
                    `No reviewed Symbolic Atlas cluster is tied to a concept yet (${summary.reviewed_cluster_links}), so these are the model’s closest passages among the ${corpusOf('myth')?.documents ?? ''} books of the Symbolic Atlas corpus, not a reviewed symbolic meaning.`,
                    `Inget granskat kluster i Symbolic Atlas är kopplat till ett begrepp ännu (${summary.reviewed_cluster_links}), så detta är modellens närmaste passager bland de ${corpusOf('myth')?.documents ?? ''} böckerna i Symbolic Atlas korpus, inte en granskad symbolisk betydelse.`,
                  )}
                </p>
              )}
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
                        <a href={x.source_url} target="_blank" rel="noreferrer">
                          {x.document_title}
                        </a>
                        , {x.location},{' '}
                        <Relation type="semantic_similarity" status="derived" />{' '}
                        <span className="cj-muted">
                          {l('similarity', 'likhet')} {x.similarity.toFixed(2)}{' '}
                          , {l('rank', 'rang')} {x.rank}/
                          {summary.concepts.length}
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

        <section className="cj-connects" aria-labelledby="cj-connects-title">
          <h2 id="cj-connects-title">
            {l('What connects them?', 'Vad förbinder dem?')}
          </h2>
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
        </section>

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
              `${pct(summary.run.evaluation.same_corpus_neighbours)} of each passage’s nearest neighbours come from its own corpus, so passages are compared within a domain and through the concepts, never on one shared map.`,
              `${pct(summary.run.evaluation.same_corpus_neighbours)} av varje passages närmaste grannar kommer från dess egen korpus, så passagerna jämförs inom en domän och genom begreppen, aldrig på en gemensam karta.`,
            )}
          </p>
          <p>
            {l(
              'The passages are the ones the model ranks closest; no reader has judged them to be about the concept.',
              'Passagerna är de som modellen rankar närmast; ingen läsare har bedömt att de handlar om begreppet.',
            )}
          </p>
        </Interpretation>

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
                'The concepts, anchor sentences, tensions and links are editorial; no passage-to-concept mapping has been reviewed yet.',
                'Begreppen, ankarmeningarna, spänningarna och länkarna är redaktionella; ingen koppling mellan passage och begrepp har granskats än.',
              ),
            ],
          ]}
        />
        <MethodSummary
          lineage={[
            l(
              'Project Gutenberg, Riksdagen, EU Publications Office',
              'Project Gutenberg, Riksdagen, EU:s publikationsbyrå',
            ),
            l('Python ingestion', 'inläsning i Python'),
            'dbt + DuckDB',
            l('one multilingual model', 'en flerspråkig modell'),
            'JSON',
            'React',
          ]}
          quality={l(
            'Passages with similar language sit closer; in the method that is multilingual sentence embeddings, cosine similarity to a concept’s anchor sentence, and a baseline from random pairs.',
            'Passager med liknande språk hamnar närmare varandra; i metoden är det flerspråkiga meningsinbäddningar, cosinuslikhet med begreppets ankarmening och en jämförelse med slumpvisa par.',
          )}
          more={[
            {
              href: '#concepts-method',
              label: l('Method and limitations', 'Metod och begränsningar'),
            },
            {
              href: `#concept-${id}`,
              label: l(
                `Everything about ${label(concept).toLowerCase()}`,
                `Allt om ${label(concept).toLowerCase()}`,
              ),
            },
          ]}
        />
        <TraceResult
          node="out:concepts/*.json"
          what={l('the concept passages', 'begreppspassagerna')}
        />
      </div>
    </>
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

/** The measures elsewhere on the site that count the same idea in one domain, or a plain gap. */
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
  if (corpus === 'myth') return null
  if (!items.length)
    return (
      <p className="cj-note">
        {corpus === 'law'
          ? l(
              'No view of the AI Act is linked to this concept; nothing is filled in.',
              'Ingen vy av AI-förordningen är kopplad till begreppet; ingenting fylls i.',
            )
          : corpus === 'politics'
            ? l(
                'No Riksdag word group or job-ad term measures this concept.',
                'Ingen ordgrupp i riksdagen och ingen jobbannonsterm mäter begreppet.',
              )
            : l(
                'No Philosophy Atlas tension has this concept as a pole.',
                'Ingen spänning i Philosophy Atlas har begreppet som pol.',
              )}
      </p>
    )
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
              <a href="#ai-act-politics">
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
              <a href="#ai-act-jobs">
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
  reference,
}: {
  concept: Concept
  profile: Profile[]
  pairs: Pair[]
  reference: number
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
  const arc = (a: string, b: string, lift = 0) => {
    const [p, q] = [at[a], at[b]]
    const top = Math.min(p.y, q.y) - 24 - Math.abs(q.x - p.x) * 0.12 - lift
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
          `${label(concept)} across the four domains, times chance: ${text}. ${lines.length} links by semantic similarity${reference ? ', one documented reference from the Riksdag to the AI Act' : ''}.`,
          `${label(concept)} i de fyra domänerna, gånger slumpen: ${text}. ${lines.length} länkar genom semantisk likhet${reference ? ', en dokumenterad hänvisning från riksdagen till AI-förordningen' : ''}.`,
        )}
      >
        {lines.map(({ a, b }) => (
          <path
            key={`${a}-${b}`}
            className="cj-edge cj-edge-semantic_similarity"
            d={arc(a, b)}
          />
        ))}
        {reference > 0 && (
          <path
            className="cj-edge cj-edge-documented_reference"
            d={arc('politics', 'law', 34)}
          />
        )}
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
        {reference > 0 && (
          <span>
            <i
              className="cj-line cj-line-documented_reference"
              aria-hidden="true"
            />{' '}
            {l('Documented reference', 'Dokumenterad hänvisning')}
          </span>
        )}
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
