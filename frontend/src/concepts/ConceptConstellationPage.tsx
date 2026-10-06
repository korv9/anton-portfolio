/**
 * Concept Constellation (#concept-constellation) and the concept pages (#concept-<id>).
 * Built from platform/publish/concepts/export_concepts.py: 28 curated concepts read across four
 * corpora (myth, philosophy, Riksdag speeches, the AI Act) with one multilingual model. Every
 * line in the constellation has an explicit type, drawn in its own style, and every element is
 * marked as source, derived or interpretation. Experimental.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { ProductQuality } from '../quality/QualityPanel'
import type { Route } from '../router'
import { fetchData } from '../dataSource'
import { ProjectNav } from '../projects/ProjectNav'
import { useViewParams } from '../politik/useViewParams'
import {
  CORPUS_ORDER,
  FAMILIES,
  conceptFromPath,
  corpusPositions,
  pct,
  profileOf,
  prominent,
  radialLayout,
  relationsOf,
} from './logic'
import type {
  Concept,
  ConceptSummary,
  Corpus,
  Link,
  Pair,
  Passage,
  Profile,
  Relations,
} from './types'
import './concepts.css'

type Data = {
  summary: ConceptSummary
  profiles: Profile[]
  relations: Relations
  links: Link[]
}

const FAMILY_LABEL: Record<string, [string, string]> = {
  moral: ['Moral', 'Moral'],
  political: ['Political', 'Politik'],
  regulatory: ['Regulatory', 'Reglering'],
  social: ['Social', 'Samhälle'],
  epistemic: ['Knowledge', 'Kunskap'],
  symbolic: ['Symbolic', 'Symbolik'],
}
const STAGE_LABEL: Record<string, [string, string]> = {
  stories: ['Stories', 'Berättelser'],
  ideas: ['Ideas', 'Idéer'],
  contestation: ['Contestation', 'Politisk strid'],
  codification: ['Codification', 'Lag'],
}
const RELATION_LABEL: Record<string, [string, string]> = {
  semantic_similarity: ['Semantic similarity', 'Semantisk likhet'],
  shared_concept: ['Prominent in corpus', 'Framträdande i korpus'],
  shared_tension: ['Shared tension', 'Gemensam spänning'],
  temporal_overlap: ['Temporal overlap', 'Samtidighet'],
  documented_reference: ['Documented reference', 'Dokumenterad hänvisning'],
}
const DEFAULTS = { begrepp: '', visa: 'semantic_similarity,shared_tension' }

const label = (c: { label_en: string; label_sv: string }) =>
  l(c.label_en, c.label_sv)

async function json<T>(path: string): Promise<T> {
  const r = await fetchData(path)
  if (!r.ok) throw new Error(path)
  return r.json()
}

export function Kind({
  kind,
}: {
  kind: 'source' | 'derived' | 'interpretation'
}) {
  const text = {
    source: l('Source', 'Källa'),
    derived: l('Derived', 'Härlett'),
    interpretation: l('Interpretation', 'Tolkning'),
  }[kind]
  return <span className={`cc-kind cc-kind-${kind}`}>{text}</span>
}

export default function ConceptConstellationPage({ route }: { route: Route }) {
  const [data, setData] = useState<Data | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    Promise.all([
      json<ConceptSummary>('concepts/summary.json'),
      json<Profile[]>('concepts/profiles.json'),
      json<Relations>('concepts/relations.json'),
      json<Link[]>('concepts/links.json'),
    ])
      .then(([summary, profiles, relations, links]) =>
        setData({ summary, profiles, relations, links }),
      )
      .catch(() => setFailed(true))
  }, [])
  if (failed)
    return (
      <p className="cc-body ds-container">
        {l(
          'The concept layer could not be loaded.',
          'Begreppslagret kunde inte laddas.',
        )}
      </p>
    )
  if (!data)
    return <p className="cc-body ds-container">{l('Loading…', 'Laddar…')}</p>
  const concept = conceptFromPath(route.path)
  const known = data.summary.concepts.find((c) => c.concept_id === concept)
  return (
    <div className="concepts">
      {known ? (
        <ConceptPage route={route} data={data} concept={known} />
      ) : (
        <Constellation route={route} data={data} />
      )}
    </div>
  )
}

function Constellation({ route, data }: { route: Route; data: Data }) {
  const [params, set] = useViewParams(route, DEFAULTS)
  const { summary, profiles, relations } = data
  const shown = new Set(params.visa.split(',').filter(Boolean))
  const toggle = (id: string) => {
    const next = new Set(shown)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    set({ visa: [...next].join(',') })
  }
  const placed = radialLayout(summary.concepts)
  const at = Object.fromEntries(placed.map((p) => [p.id, p]))
  const corpora = CORPUS_ORDER.filter((c) =>
    summary.corpora.some((k) => k.corpus_id === c),
  )
  const corpusAt = corpusPositions(corpora)
  const selected = params.begrepp || null
  const touches = (a: string, b: string) =>
    selected == null || a === selected || b === selected
  const conceptOf = (id: string) =>
    summary.concepts.find((c) => c.concept_id === id)
  const corpusOf = (id: string) =>
    summary.corpora.find((c) => c.corpus_id === id)
  const lines = relations.concepts.filter((r) => shown.has(r.relation_type))
  const lifts = shown.has('shared_concept') ? prominent(profiles, 2) : []
  const ev = summary.run.evaluation
  const active = selected ? conceptOf(selected) : null

  return (
    <>
      <header className="cc-hero ds-container">
        <p className="cc-kicker">
          {l('Experimental · meaning atlas', 'Experimentellt · betydelseatlas')}
        </p>
        <h1>Concept Constellation</h1>
        <p className="cc-question">
          {l(
            'Where do the same ideas appear as they move from stories to philosophy, politics and law?',
            'Var dyker samma idéer upp när de rör sig från berättelser till filosofi, politik och lag?',
          )}
        </p>
        <p className="cc-lede">
          {l(
            `${summary.concepts.length} concepts chosen by an editor, read across ${summary.corpora.reduce((s, c) => s + c.chunks, 0).toLocaleString('en')} passages from four corpora with one multilingual model. Every line below has a stated type. None says that one text influenced another.`,
            `${summary.concepts.length} begrepp valda av en redaktör, lästa över ${summary.corpora.reduce((s, c) => s + c.chunks, 0).toLocaleString('sv')} passager ur fyra korpusar med en flerspråkig modell. Varje linje nedan har en angiven typ. Ingen säger att en text har påverkat en annan.`,
          )}
        </p>
      </header>
      <ProjectNav route={route} />
      <div className="cc-body ds-container">
        <section
          id="concept-constellation"
          className="cc-section"
          aria-labelledby="cc-map-title"
        >
          <h2 id="cc-map-title">{l('The constellation', 'Konstellationen')}</h2>
          <div
            role="group"
            aria-label={l('Relations', 'Relationer')}
            className="cc-chips"
          >
            {['semantic_similarity', 'shared_tension', 'shared_concept'].map(
              (id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={shown.has(id)}
                  onClick={() => toggle(id)}
                >
                  <i className={`cc-swatch cc-rel-${id}`} aria-hidden="true" />
                  {l(...RELATION_LABEL[id])}
                </button>
              ),
            )}
          </div>
          <div className="cc-stage">
            <figure className="cc-map">
              <svg
                viewBox="-12 -6 124 112"
                role="group"
                aria-label={l(
                  `${summary.concepts.length} concepts on a circle by family, the four corpora inside; lines show the selected relation types.`,
                  `${summary.concepts.length} begrepp i en cirkel efter familj, de fyra korpusarna i mitten; linjerna visar valda relationstyper.`,
                )}
              >
                {lifts.map((p) => {
                  const a = at[p.concept_id]
                  const b = corpusAt[p.corpus_id]
                  if (!a || !b) return null
                  return (
                    <line
                      key={`${p.concept_id}-${p.corpus_id}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      className={`cc-line cc-rel-shared_concept${touches(p.concept_id, p.concept_id) ? '' : ' is-faded'}`}
                      strokeWidth={Math.min(0.9, 0.12 * p.rank1_lift)}
                    >
                      <title>
                        {`${label(conceptOf(p.concept_id)!)} · ${label(corpusOf(p.corpus_id)!)}: ${pct(p.rank1_share)} (${l('chance', 'slump')} ${pct(p.rank1_chance, 1)})`}
                      </title>
                    </line>
                  )
                })}
                {lines.map((r) => {
                  const a = at[r.concept_a]
                  const b = at[r.concept_b]
                  if (!a || !b) return null
                  return (
                    <path
                      key={`${r.relation_type}-${r.concept_a}-${r.concept_b}`}
                      d={`M${a.x},${a.y} Q50,50 ${b.x},${b.y}`}
                      className={`cc-line cc-rel-${r.relation_type}${touches(r.concept_a, r.concept_b) ? '' : ' is-faded'}`}
                      strokeWidth={
                        r.relation_type === 'semantic_similarity'
                          ? 0.2 + (r.strength ?? 0) * 0.6
                          : 0.45
                      }
                    >
                      <title>
                        {`${label(conceptOf(r.concept_a)!)} – ${label(conceptOf(r.concept_b)!)}: ${l(...RELATION_LABEL[r.relation_type])}`}
                      </title>
                    </path>
                  )
                })}
                {relations.corpora.map((r) => {
                  const a = corpusAt[r.from]
                  const b = corpusAt[r.to]
                  if (!a || !b) return null
                  return (
                    <line
                      key={`${r.from}-${r.to}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      className={`cc-line cc-rel-${r.relation_type}`}
                    >
                      <title>{`${l(...RELATION_LABEL[r.relation_type])}: ${r.count} ${l('speeches', 'anföranden')}`}</title>
                    </line>
                  )
                })}
                {corpora.map((c) => {
                  const k = corpusOf(c)!
                  const p = corpusAt[c]
                  return (
                    <g key={c} className="cc-corpus">
                      <circle cx={p.x} cy={p.y} r={4.2} />
                      <text x={p.x} y={p.y - 0.4} textAnchor="middle">
                        {l(...STAGE_LABEL[k.stage])}
                      </text>
                      <text
                        x={p.x}
                        y={p.y + 2.2}
                        textAnchor="middle"
                        className="cc-corpus-sub"
                      >
                        {label(k)}
                      </text>
                    </g>
                  )
                })}
                {placed.map((p) => {
                  const c = conceptOf(p.id)!
                  const on = selected == null || selected === p.id
                  const cos = Math.cos(p.angle)
                  const sin = Math.sin(p.angle)
                  const anchor =
                    cos > 0.08 ? 'start' : cos < -0.08 ? 'end' : 'middle'
                  return (
                    <g
                      key={p.id}
                      className={`cc-node${on ? '' : ' is-faded'}${selected === p.id ? ' is-selected' : ''}`}
                    >
                      <a
                        href={`#concept-constellation?${new URLSearchParams({ ...(selected === p.id ? {} : { begrepp: p.id }), ...(params.visa !== DEFAULTS.visa ? { visa: params.visa } : {}) }).toString()}`}
                        onClick={(e) => {
                          e.preventDefault()
                          set({ begrepp: selected === p.id ? '' : p.id })
                        }}
                        aria-label={label(c)}
                      >
                        <circle cx={p.x} cy={p.y} r={1.5} />
                        <text
                          x={50 + 41.5 * cos}
                          y={
                            50 +
                            41.5 * sin +
                            1 +
                            (anchor === 'middle' ? sin * 1.5 : 0)
                          }
                          textAnchor={anchor}
                        >
                          {label(c)}
                        </text>
                      </a>
                    </g>
                  )
                })}
              </svg>
            </figure>
            <aside className="cc-panel" aria-live="polite">
              {active ? (
                <ConceptCard concept={active} data={data} />
              ) : (
                <>
                  <p className="cc-kicker">
                    {l('How to read it', 'Så läser du den')}
                  </p>
                  <ul className="cc-legend">
                    {summary.relation_types.map((r) => (
                      <li key={r.id}>
                        <i
                          className={`cc-swatch cc-rel-${r.id}`}
                          aria-hidden="true"
                        />
                        <span>
                          <b>{l(...RELATION_LABEL[r.id])}</b>{' '}
                          <Kind kind={r.content_type} />
                          <br />
                          {l(r.en, r.sv)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="cc-hint">
                    {l(
                      'Concepts sit on the circle by family; the four corpora sit inside in the order of the chain. Choose a concept to see its profile.',
                      'Begreppen sitter i cirkeln efter familj; de fyra korpusarna sitter i mitten i kedjans ordning. Välj ett begrepp för att se dess profil.',
                    )}
                  </p>
                </>
              )}
            </aside>
          </div>
          <ul className="cc-families">
            {FAMILIES.map((f) => (
              <li key={f}>
                <b>{l(...FAMILY_LABEL[f])}</b>{' '}
                {summary.concepts
                  .filter((c) => c.family === f)
                  .map((c, i) => (
                    <span key={c.concept_id}>
                      {i > 0 && ', '}
                      <a href={`#concept-${c.concept_id}`}>{label(c)}</a>
                    </span>
                  ))}
              </li>
            ))}
          </ul>
        </section>

        <Profiles summary={summary} profiles={profiles} />

        <ProductQuality product="concepts" />
        <section
          id="concepts-method"
          className="cc-section"
          aria-labelledby="cc-method-title"
        >
          <h2 id="cc-method-title">
            {l('Method and limits', 'Metod och begränsningar')}
          </h2>
          <ul className="cc-method">
            <li>
              {l(
                `Sample: at most ${summary.run.corpus_size} passages per corpus, spread evenly over its books, works, years or provisions; every passage keeps its source URL, version and retrieval time.`,
                `Urval: högst ${summary.run.corpus_size} passager per korpus, jämnt fördelade över dess böcker, verk, år eller bestämmelser; varje passage behåller källans adress, version och hämtningstid.`,
              )}
            </li>
            <li>
              {l(
                `Model: ${summary.run.model}, one for all corpora. Each concept has an anchor sentence in English and Swedish; a passage is compared with the anchor in its own language. Each Swedish anchor’s nearest English anchor is the same concept for ${pct(ev.anchor_agreement_sv_en)} of concepts.`,
                `Modell: ${summary.run.model}, en för alla korpusar. Varje begrepp har en ankarmening på engelska och svenska; en passage jämförs med ankaret på sitt eget språk. Varje svensk ankarmenings närmaste engelska är samma begrepp för ${pct(ev.anchor_agreement_sv_en)} av begreppen.`,
              )}
            </li>
            <li>
              {l(
                `The corpora differ more from each other than their subjects do: ${pct(ev.same_corpus_neighbours)} of a passage’s nearest neighbours come from its own corpus (chance ${pct(ev.same_corpus_chance)}). So passages are never mapped or clustered together across corpora; they are compared only through the concepts, by rank within a passage.`,
                `Korpusarna skiljer sig mer från varandra än deras ämnen gör: ${pct(ev.same_corpus_neighbours)} av en passages närmaste grannar kommer från samma korpus (slump ${pct(ev.same_corpus_chance)}). Därför kartläggs eller klustras passager aldrig tillsammans över korpusar; de jämförs bara genom begreppen, efter rang inom en passage.`,
              )}
            </li>
            <li>
              {l(
                'Concepts, anchors, tensions and links are an editor’s choices and are published to be argued with. No label is generated by a language model.',
                'Begrepp, ankare, spänningar och länkar är en redaktörs val och publiceras för att kunna ifrågasättas. Ingen etikett genereras av en språkmodell.',
              )}
            </li>
          </ul>
          <p className="cc-hint">
            <a href="https://github.com/korv9/anton-portfolio/blob/main/docs/concept-layer.md">
              docs/concept-layer.md
            </a>{' '}
            ·{' '}
            <a href="https://github.com/korv9/anton-portfolio/blob/main/docs/concept-constellation.md">
              docs/concept-constellation.md
            </a>
          </p>
        </section>
      </div>
    </>
  )
}

function ConceptCard({ concept, data }: { concept: Concept; data: Data }) {
  const profile = profileOf(data.profiles, concept.concept_id)
  const related = relationsOf(data.relations.concepts, concept.concept_id)
  const conceptOf = (id: string) =>
    data.summary.concepts.find((c) => c.concept_id === id)
  return (
    <>
      <p className="cc-kicker">
        {l(...FAMILY_LABEL[concept.family])} · <Kind kind="interpretation" />
      </p>
      <h3>{label(concept)}</h3>
      <p>{l(concept.description_en, concept.description_sv)}</p>
      <ProfileBars profile={profile} corpora={data.summary.corpora} />
      {related.length > 0 && (
        <p className="cc-hint">
          {related.map(({ other, relation }, i) => (
            <span key={`${relation.relation_type}-${other}`}>
              {i > 0 && ' · '}
              <i
                className={`cc-swatch cc-rel-${relation.relation_type}`}
                aria-hidden="true"
              />{' '}
              <a href={`#concept-${other}`}>{label(conceptOf(other)!)}</a>
            </span>
          ))}
        </p>
      )}
      <p>
        <a className="cc-more" href={`#concept-${concept.concept_id}`}>
          {l(
            `Open ${concept.label_en}`,
            `Öppna ${concept.label_sv.toLowerCase()}`,
          )}
        </a>
      </p>
    </>
  )
}

function ProfileBars({
  profile,
  corpora,
}: {
  profile: Profile[]
  corpora: Corpus[]
}) {
  const max = Math.max(0.1, ...profile.map((p) => p.rank1_share))
  const chance = profile[0]?.rank1_chance ?? 0
  return (
    <figure className="cc-bars">
      <figcaption>
        {l(
          'Share of passages where this is the closest concept',
          'Andel passager där detta är det närmaste begreppet',
        )}{' '}
        <Kind kind="derived" />
      </figcaption>
      {profile.map((p) => {
        const k = corpora.find((c) => c.corpus_id === p.corpus_id)!
        return (
          <div key={p.corpus_id} className="cc-bar">
            <span>{label(k)}</span>
            <span className="cc-bar-track">
              <i style={{ width: `${(p.rank1_share / max) * 100}%` }} />
              <b
                className="cc-chance"
                style={{ left: `${(chance / max) * 100}%` }}
                aria-hidden="true"
              />
            </span>
            <span className="cc-bar-value">
              {pct(p.rank1_share)}
              <small>
                {' '}
                ({p.rank1_chunks}/{p.chunks})
              </small>
            </span>
          </div>
        )
      })}
      <p className="cc-hint">
        {l(
          `The tick marks chance (1 in ${Math.round(1 / chance)}).`,
          `Strecket visar slumpnivån (1 av ${Math.round(1 / chance)}).`,
        )}
      </p>
    </figure>
  )
}

function Profiles({
  summary,
  profiles,
}: {
  summary: ConceptSummary
  profiles: Profile[]
}) {
  const corpora = CORPUS_ORDER.map((c) =>
    summary.corpora.find((k) => k.corpus_id === c),
  ).filter((c): c is Corpus => c != null)
  return (
    <section
      id="concepts-profiles"
      className="cc-section"
      aria-labelledby="cc-profiles-title"
    >
      <h2 id="cc-profiles-title">
        {l('Where each concept is prominent', 'Var varje begrepp framträder')}
      </h2>
      <p className="cc-hint">
        {l(
          'How often a concept is a passage’s closest of all 28, per corpus. Chance is 3.6 %. A comparison within each passage, so it does not depend on how close a corpus’s language is to abstract sentences in general.',
          'Hur ofta ett begrepp är en passages närmaste av alla 28, per korpus. Slumpnivån är 3,6 %. En jämförelse inom varje passage, så den beror inte på hur nära en korpus språk ligger abstrakta meningar i allmänhet.',
        )}{' '}
        <Kind kind="derived" />
      </p>
      <div
        className="cc-table-wrap"
        tabIndex={0}
        aria-label={l('Concept profiles', 'Begreppsprofiler')}
      >
        <table className="cc-table">
          <thead>
            <tr>
              <th scope="col">{l('Concept', 'Begrepp')}</th>
              {corpora.map((c) => (
                <th scope="col" key={c.corpus_id}>
                  {label(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.concepts.map((c) => (
              <tr key={c.concept_id}>
                <th scope="row">
                  <a href={`#concept-${c.concept_id}`}>{label(c)}</a>
                </th>
                {corpora.map((k) => {
                  const p = profiles.find(
                    (x) =>
                      x.concept_id === c.concept_id &&
                      x.corpus_id === k.corpus_id,
                  )
                  const v = p ? Math.min(1, p.rank1_share / 0.3) : 0
                  return (
                    <td
                      key={k.corpus_id}
                      style={{ '--v': v } as React.CSSProperties}
                    >
                      {p ? pct(p.rank1_share) : '–'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ConceptPage({
  route,
  data,
  concept,
}: {
  route: Route
  data: Data
  concept: Concept
}) {
  const [passages, setPassages] = useState<Record<
    string,
    Record<string, Passage[]>
  > | null>(null)
  const [pairs, setPairs] = useState<Pair[] | null>(null)
  useEffect(() => {
    json<Record<string, Record<string, Passage[]>>>('concepts/passages.json')
      .then(setPassages)
      .catch(() => setPassages({}))
    json<Pair[]>('concepts/pairs.json')
      .then(setPairs)
      .catch(() => setPairs([]))
  }, [])
  const { summary } = data
  const profile = profileOf(data.profiles, concept.concept_id)
  const related = relationsOf(data.relations.concepts, concept.concept_id)
  const links = data.links.filter((k) => k.concept_id === concept.concept_id)
  const conceptOf = (id: string) =>
    summary.concepts.find((c) => c.concept_id === id)
  const corpusOf = (id: string) =>
    summary.corpora.find((c) => c.corpus_id === id)
  const own = (pairs ?? []).filter((p) => p.concept_id === concept.concept_id)
  const kinds = new Set(links.map((k) => k.kind))
  return (
    <>
      <header className="cc-hero ds-container">
        <p className="cc-kicker">
          <a href="#concept-constellation">Concept Constellation</a> ·{' '}
          {l(...FAMILY_LABEL[concept.family])}
        </p>
        <h1>{label(concept)}</h1>
        <p className="cc-question">
          {l(concept.description_en, concept.description_sv)}
        </p>
        <p className="cc-lede">
          <Kind kind="interpretation" /> {l('Anchor sentence', 'Ankarmening')}:
          “{l(concept.anchor_en, concept.anchor_sv)}”{' '}
          <span className="cc-muted">
            ({concept.status}, {concept.created_by})
          </span>
        </p>
      </header>
      <ProjectNav route={route} />
      <div className="cc-body ds-container">
        <section className="cc-section" aria-labelledby="cc-profile-title">
          <h2 id="cc-profile-title">
            {l('Across the four corpora', 'Över de fyra korpusarna')}
          </h2>
          <ProfileBars profile={profile} corpora={summary.corpora} />
        </section>

        <section className="cc-section" aria-labelledby="cc-passages-title">
          <h2 id="cc-passages-title">
            {l('Closest passages', 'Närmaste passager')}
          </h2>
          <p className="cc-hint">
            {l(
              'Per corpus, the passages where this concept is among the three closest and most unusually so for that corpus. What the model finds closest to the anchor, not passages a reader has judged to be about the concept.',
              'Per korpus de passager där begreppet är bland de tre närmaste och mest ovanligt nära för just den korpusen. Det modellen finner närmast ankaret, inte passager som en läsare har bedömt handla om begreppet.',
            )}
          </p>
          {!passages ? (
            <p className="cc-hint">{l('Loading…', 'Laddar…')}</p>
          ) : (
            <div className="cc-columns">
              {CORPUS_ORDER.map((c) => {
                const list = passages[concept.concept_id]?.[c] ?? []
                const k = corpusOf(c)
                if (!k) return null
                return (
                  <div key={c} className="cc-column">
                    <h3>
                      {l(...STAGE_LABEL[k.stage])} · {label(k)}
                    </h3>
                    {list.length === 0 ? (
                      <p className="cc-hint">
                        {l(
                          'No passage ranks it in its top three.',
                          'Ingen passage har det bland sina tre närmaste.',
                        )}
                      </p>
                    ) : (
                      list.map((p) => (
                        <blockquote key={p.chunk_id} lang={p.language}>
                          <p>{p.text}</p>
                          <footer>
                            <Kind kind="source" />{' '}
                            <a href={p.source_url} rel="noreferrer">
                              {p.document_title}
                            </a>
                            , {p.location}
                            <br />
                            <span className="cc-muted">
                              {l('similarity', 'likhet')}{' '}
                              {p.similarity.toFixed(2)} · {l('rank', 'rang')}{' '}
                              {p.rank}/28 · z {p.z_score.toFixed(1)}
                            </span>
                          </footer>
                        </blockquote>
                      ))
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {own.length > 0 && (
          <section className="cc-section" aria-labelledby="cc-pairs-title">
            <h2 id="cc-pairs-title">
              {l('Across corpora', 'Mellan korpusar')}
            </h2>
            <p className="cc-hint">
              <i
                className="cc-swatch cc-rel-semantic_similarity"
                aria-hidden="true"
              />{' '}
              {l(
                'Per pair of corpora, the two closest of their representative passages, shown only above the 95th percentile of random pairs between the same corpora. Similar wording; not influence, and not the same meaning.',
                'För varje korpuspar de två närmaste av deras representativa passager, visade bara över 95:e percentilen för slumpvisa par mellan samma korpusar. Liknande formuleringar; inte påverkan och inte samma betydelse.',
              )}
            </p>
            <ul className="cc-pairs">
              {own.map((p) => (
                <li key={`${p.corpus_a}-${p.corpus_b}`}>
                  <p className="cc-kicker">
                    {label(corpusOf(p.corpus_a)!)} ↔{' '}
                    {label(corpusOf(p.corpus_b)!)} · {p.similarity.toFixed(2)} (
                    {l('random p95', 'slump p95')} {p.baseline_p95.toFixed(2)})
                  </p>
                  <div className="cc-pair">
                    <blockquote lang={p.language_a}>
                      <p>{p.text_a}</p>
                      <footer>
                        <a href={p.url_a} rel="noreferrer">
                          {p.title_a}
                        </a>
                        , {p.location_a}
                      </footer>
                    </blockquote>
                    <blockquote lang={p.language_b}>
                      <p>{p.text_b}</p>
                      <footer>
                        <a href={p.url_b} rel="noreferrer">
                          {p.title_b}
                        </a>
                        , {p.location_b}
                      </footer>
                    </blockquote>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="cc-section" aria-labelledby="cc-links-title">
          <h2 id="cc-links-title">
            {l('Elsewhere on the site', 'På andra ställen på sajten')}
          </h2>
          <p className="cc-hint">
            {l(
              'Measures that count the same idea in their own data, linked by an editor. Only where a measure exists; nothing is filled in.',
              'Mått som räknar samma idé i sina egna data, länkade av en redaktör. Bara där ett mått finns; ingenting fylls i.',
            )}{' '}
            <Kind kind="interpretation" />
          </p>
          <ul className="cc-links">
            {links.map((k) => (
              <LinkRow key={`${k.kind}-${k.target_id}`} link={k} />
            ))}
            {!kinds.has('riksdag_framing') && (
              <li className="cc-muted">
                {l(
                  'Riksdag: no word group in the AI-speech dictionary measures this concept.',
                  'Riksdagen: ingen ordgrupp i AI-ordlistan mäter detta begrepp.',
                )}
              </li>
            )}
            {!kinds.has('job_term') && (
              <li className="cc-muted">
                {l(
                  'Job ads: no term in the governance dictionary measures this concept.',
                  'Jobbannonser: ingen term i ordlistan för AI-styrning mäter detta begrepp.',
                )}
              </li>
            )}
          </ul>
          {related.length > 0 && (
            <>
              <h3>{l('Related concepts', 'Närliggande begrepp')}</h3>
              <ul className="cc-links">
                {related.map(({ other, relation }) => (
                  <li key={`${relation.relation_type}-${other}`}>
                    <i
                      className={`cc-swatch cc-rel-${relation.relation_type}`}
                      aria-hidden="true"
                    />{' '}
                    <a href={`#concept-${other}`}>{label(conceptOf(other)!)}</a>{' '}
                    <span className="cc-muted">
                      {l(...RELATION_LABEL[relation.relation_type])}
                      {relation.strength != null &&
                        ` ${relation.strength.toFixed(2)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  )
}

function LinkRow({ link }: { link: Link }) {
  const t = link.target
  if (link.kind === 'philosophy_tension')
    return (
      <li>
        {l('Philosophy Atlas tension', 'Spänning i Philosophy Atlas')}:{' '}
        <a href={`#philosophy-tensions?spanning=${link.target_id}`}>
          {t ? label(t) : link.target_id}
        </a>
        {link.note && <span className="cc-muted"> · {link.note}</span>}
      </li>
    )
  if (link.kind === 'ai_act_view')
    return (
      <li>
        {l('EU AI Act', 'EU:s AI-förordning')}:{' '}
        <a href={`#${link.target_id}`}>#{link.target_id}</a>
        {link.note && <span className="cc-muted"> · {link.note}</span>}
      </li>
    )
  if (link.kind === 'riksdag_framing') {
    const all = t?.periods?.all
    return (
      <li>
        {l('Riksdag AI speeches', 'Riksdagens AI-anföranden')}:{' '}
        <a href="#ai-act-politics">{t ? label(t) : link.target_id}</a>
        {all && (
          <>
            {' '}
            · {pct(all.share)} ({all.with_concept}/{all.ai_speeches}){' '}
            <Kind kind="derived" />
          </>
        )}
        {link.note && <span className="cc-muted"> · {link.note}</span>}
      </li>
    )
  }
  const last = t?.years?.[t.years.length - 1]
  return (
    <li>
      {l('Job ads', 'Jobbannonser')}:{' '}
      <a href="#ai-act-jobs">{t ? label(t) : link.target_id}</a>
      {last && (
        <>
          {' '}
          · {last.year}: {pct(last.share, 2)} (
          {last.with_term.toLocaleString('sv')}/{last.ads.toLocaleString('sv')}){' '}
          <Kind kind="derived" />
        </>
      )}
    </li>
  )
}
