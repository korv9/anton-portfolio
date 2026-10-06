/**
 * Philosophy Atlas (#philosophy-atlas): how recurring ideas and moral tensions organise thirteen
 * public-domain works of philosophy. Built from platform/publish/philosophy/export_philosophy.py:
 * a balanced sample of passages, one multilingual embedding model, UMAP and HDBSCAN on two maps
 * (raw, and centred per work so a work's own voice and its translator's English weigh less), and
 * a set of tensions read as lenses. Clusters carry no generated names: a cluster is named only
 * after a person has reviewed it. Experimental.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { fetchData } from '../dataSource'
import { ProjectNav } from '../projects/ProjectNav'
import { useViewParams } from '../politik/useViewParams'
import './philosophy.css'

type Work = {
  document_id: string
  title: string
  author: string
  year: number
  period: string
  tradition: string
  area: string
  original_language: string
  translator: string | null
  translator_note: string | null
  source_url: string
  passages: number
  words: number
}
type Evaluation = {
  clusters: number
  noise_share: number
  mean_largest_work_share: number
  work_dominated_clusters: number
  cross_work_clusters: number
  same_work_neighbours: number
  same_work_chance: number
  same_translator_neighbours: number
  same_translator_chance: number
}
type Tension = {
  tension_id: string
  pole_a: string
  pole_b: string
  label_en: string
  label_sv: string
  anchor_a: string
  anchor_b: string
  description_en: string
  description_sv: string
}
type Summary = {
  works: Work[]
  tensions: Tension[]
  run: {
    model: string
    passages_total: number
    passages_sampled: number
    per_document: number
    works: number
    neighbours: number
    evaluation: Record<'baseline' | 'author_centered', Evaluation>
  }
  reviewed_clusters: number
}
type Point = [string, number, number, number, number]
type Cluster = {
  variant: string
  cluster_id: number
  size: number
  works: Record<string, number>
  work_count: number
  largest_work_share: number
  is_cross_work: boolean
  representatives: string[]
  distinctive_terms: string[]
  review_status: string
  review_label: string | null
}
type Distribution = {
  tension_id: string
  document_id: string
  passages: number
  mean_position: number
  q1: number
  median: number
  q3: number
}
type Pole = {
  tension_id: string
  pole: 'a' | 'b'
  rank: number
  passage_id: string
  document_id: string
  position: number
  text: string
}

const ERAS: { id: string; label: [string, string]; periods: string[] }[] = [
  { id: 'antiquity', label: ['Antiquity', 'Antiken'], periods: ['ancient'] },
  {
    id: 'early-modern',
    label: ['1650–1800', '1650–1800'],
    periods: ['early-modern', 'enlightenment'],
  },
  {
    id: 'c19',
    label: ['19th century', '1800-talet'],
    periods: ['nineteenth-century'],
  },
]
const eraOf = (period: string) =>
  ERAS.findIndex((e) => e.periods.includes(period))
const pct = (v: number) => `${Math.round(v * 100)} %`
const DEFAULTS = {
  karta: 'author_centered',
  verk: '',
  kluster: '',
  spanning: 'individual_collective',
}

async function json<T>(path: string): Promise<T> {
  const r = await fetchData(path)
  if (!r.ok) throw new Error(path)
  return r.json()
}

export default function PhilosophyAtlasPage({ route }: { route: Route }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [atlas, setAtlas] = useState<Record<string, Point[]> | null>(null)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [tensions, setTensions] = useState<{
    distribution: Distribution[]
    poles: Pole[]
  } | null>(null)
  const [passages, setPassages] = useState<Record<string, string> | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [params, set] = useViewParams(route, DEFAULTS)
  useEffect(() => {
    Promise.all([
      json<Summary>('philosophy/summary.json'),
      json<Record<string, Point[]>>('philosophy/atlas.json'),
      json<Cluster[]>('philosophy/clusters.json'),
      json<{ distribution: Distribution[]; poles: Pole[] }>(
        'philosophy/tensions.json',
      ),
    ])
      .then(([s, a, c, t]) => {
        setSummary(s)
        setAtlas(a)
        setClusters(c)
        setTensions(t)
      })
      .catch(() => setFailed(true))
  }, [])
  const needText = focus != null || params.kluster !== ''
  useEffect(() => {
    if (needText && !passages)
      json<Record<string, string>>('philosophy/passages.json')
        .then(setPassages)
        .catch(() => {})
  }, [needText])

  if (failed)
    return (
      <p className="ph-body ds-container">
        {l('The atlas could not be loaded.', 'Atlasen kunde inte laddas.')}
      </p>
    )
  if (!summary || !atlas || !tensions)
    return <p className="ph-body ds-container">{l('Loading…', 'Laddar…')}</p>

  const variant = params.karta === 'baseline' ? 'baseline' : 'author_centered'
  const points = atlas[variant]
  const works = summary.works
  const workIndex = params.verk
    ? works.findIndex((w) => w.document_id === params.verk)
    : -1
  const clusterId = params.kluster === '' ? null : Number(params.kluster)
  const variantClusters = clusters.filter((c) => c.variant === variant)
  const ev = summary.run.evaluation
  const focusPoint = focus ? points.find((p) => p[0] === focus) : null

  return (
    <div className="philosophy">
      <header className="ph-hero ds-container">
        <p className="ph-kicker">
          {l(
            'Experimental · semantic exploration',
            'Experimentellt · semantisk utforskning',
          )}
        </p>
        <h1>Philosophy Atlas</h1>
        <p className="ph-question">
          {l(
            'How do recurring moral and philosophical tensions organise texts across thinkers and traditions?',
            'Hur organiserar återkommande moraliska och filosofiska spänningar texter över tänkare och traditioner?',
          )}
        </p>
        <p className="ph-lede">
          {l(
            `${works.length} public-domain works, from Plato to Nietzsche, cut into passages; ${summary.run.passages_sampled} passages (at most ${summary.run.per_document} per work, so long books do not dominate) placed by meaning with a sentence-embedding model and grouped where they gather. Nothing is labelled by a machine: groups are named only after a person has read them, and so far ${summary.reviewed_clusters} have been.`,
            `${works.length} fria filosofiska verk, från Platon till Nietzsche, indelade i passager; ${summary.run.passages_sampled} passager (högst ${summary.run.per_document} per verk, så att långa böcker inte dominerar) placerade efter innebörd med en modell för meningsinbäddningar och grupperade där de samlas. Ingenting namnges av en maskin: grupper får namn först när en människa har läst dem, och hittills har ${summary.reviewed_clusters} gjort det.`,
          )}
        </p>
      </header>
      <ProjectNav route={route} />
      <div className="ph-body ds-container">
        <section
          id="philosophy-atlas"
          className="ph-section"
          aria-labelledby="ph-map-title"
        >
          <h2 id="ph-map-title">{l('The map', 'Kartan')}</h2>
          <div className="ph-controls">
            <div
              role="group"
              aria-label={l('Map', 'Karta')}
              className="ph-chips"
            >
              <button
                type="button"
                aria-pressed={variant === 'author_centered'}
                onClick={() => set({ karta: 'author_centered', kluster: '' })}
              >
                {l('Centred per work', 'Centrerad per verk')}
              </button>
              <button
                type="button"
                aria-pressed={variant === 'baseline'}
                onClick={() => set({ karta: 'baseline', kluster: '' })}
              >
                {l('Raw', 'Rå')}
              </button>
            </div>
            <label className="ph-select">
              <span>{l('Highlight a work', 'Markera ett verk')}</span>
              <select
                value={params.verk}
                onChange={(e) => set({ verk: e.target.value })}
              >
                <option value="">{l('All works', 'Alla verk')}</option>
                {works.map((w) => (
                  <option key={w.document_id} value={w.document_id}>
                    {w.author}, {w.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="ph-hint">
            {variant === 'author_centered'
              ? l(
                  'Each work’s average position is taken out, so passages group by what they discuss rather than by whose book, or whose translation, they come from.',
                  'Varje verks genomsnittliga position dras bort, så att passager grupperas efter vad de handlar om snarare än vems bok, eller vems översättning, de kommer från.',
                )
              : l(
                  'The embeddings as they are: passages from one work tend to sit together, whatever they discuss.',
                  'Inbäddningarna som de är: passager ur samma verk tenderar att hamna tillsammans, vad de än handlar om.',
                )}
          </p>
          <AtlasMap
            points={points}
            works={works}
            workIndex={workIndex}
            clusterId={clusterId}
            focus={focus}
            onFocus={setFocus}
          />
          <ul className="ph-legend">
            {ERAS.map((e, i) => (
              <li key={e.id}>
                <i className={`ph-era-${i}`} /> {l(...e.label)}
              </li>
            ))}
          </ul>
          {focusPoint && (
            <aside className="ph-passage" aria-live="polite">
              <p className="ph-kicker">
                {works[focusPoint[1]].author} · {works[focusPoint[1]].title}
                {focusPoint[4] >= 0
                  ? ` · ${l('group', 'grupp')} ${focusPoint[4]}`
                  : ` · ${l('no group', 'ingen grupp')}`}
              </p>
              <blockquote>
                {passages?.[focusPoint[0]] ?? l('Loading…', 'Laddar…')}
              </blockquote>
            </aside>
          )}
          <Evaluation ev={ev} />
        </section>

        <section
          id="philosophy-groups"
          className="ph-section"
          aria-labelledby="ph-groups-title"
        >
          <h2 id="ph-groups-title">{l('The groups', 'Grupperna')}</h2>
          <p className="ph-hint">
            {l(
              'Each group with the works it draws on and its most distinctive words. Words are not a name: open a group to read the passages nearest its centre. Groups drawing on at least three works with none above half are marked across works.',
              'Varje grupp med de verk den hämtar från och sina mest utmärkande ord. Ord är inte ett namn: öppna en grupp för att läsa passagerna närmast dess mitt. Grupper som hämtar från minst tre verk utan att något väger över hälften är markerade som tvärgående.',
            )}
          </p>
          <ul className="ph-groups">
            {variantClusters.map((c) => (
              <li
                key={c.cluster_id}
                className={clusterId === c.cluster_id ? 'is-open' : ''}
              >
                <button
                  type="button"
                  aria-expanded={clusterId === c.cluster_id}
                  onClick={() =>
                    set({
                      kluster:
                        clusterId === c.cluster_id ? '' : String(c.cluster_id),
                    })
                  }
                >
                  <span className="ph-group-id">
                    {c.review_label ?? `${l('Group', 'Grupp')} ${c.cluster_id}`}
                  </span>
                  <span className="ph-group-terms">
                    {c.distinctive_terms.slice(0, 6).join(' · ')}
                  </span>
                  <span className="ph-group-meta">
                    {c.size} {l('passages', 'passager')} · {c.work_count}{' '}
                    {l('works', 'verk')}
                    {c.is_cross_work && (
                      <b> · {l('across works', 'tvärgående')}</b>
                    )}
                    {' · '}
                    {c.review_status === 'unreviewed'
                      ? l('not reviewed', 'ej granskad')
                      : c.review_status}
                  </span>
                  <span className="ph-composition" aria-hidden="true">
                    {Object.entries(c.works).map(([w, n]) => {
                      const work = works.find((x) => x.document_id === w)
                      return (
                        <i
                          key={w}
                          className={`ph-era-${eraOf(work?.period ?? '')}`}
                          style={{ flexGrow: n }}
                          title={`${work?.author}: ${n}`}
                        />
                      )
                    })}
                  </span>
                </button>
                {clusterId === c.cluster_id && (
                  <ol className="ph-reps">
                    {c.representatives.map((id) => {
                      const w = works.find((x) =>
                        id.startsWith(`${x.document_id}:`),
                      )
                      return (
                        <li key={id}>
                          <p className="ph-kicker">
                            {w?.author} · {w?.title}
                          </p>
                          <blockquote>
                            {passages?.[id] ?? l('Loading…', 'Laddar…')}
                          </blockquote>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        </section>

        <Tensions
          summary={summary}
          data={tensions}
          active={params.spanning}
          onChange={(id) => set({ spanning: id })}
        />
        <Works works={works} />
        <Method summary={summary} />
      </div>
    </div>
  )
}

function AtlasMap({
  points,
  works,
  workIndex,
  clusterId,
  focus,
  onFocus,
}: {
  points: Point[]
  works: Work[]
  workIndex: number
  clusterId: number | null
  focus: string | null
  onFocus: (id: string | null) => void
}) {
  const bounds = useMemo(() => {
    const xs = points.map((p) => p[2])
    const ys = points.map((p) => p[3])
    return {
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
    }
  }, [points])
  const sx = (x: number) => 2 + ((x - bounds.x0) / (bounds.x1 - bounds.x0)) * 96
  const sy = (y: number) => 2 + ((y - bounds.y0) / (bounds.y1 - bounds.y0)) * 96
  const active = (p: Point) =>
    (workIndex < 0 || p[1] === workIndex) &&
    (clusterId == null || p[4] === clusterId)
  const sorted = [...points].sort(
    (a, b) => Number(active(a)) - Number(active(b)),
  )
  return (
    <figure className="ph-map">
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={l(
          `${points.length} passages from ${works.length} works placed by meaning; colour shows the era.`,
          `${points.length} passager ur ${works.length} verk placerade efter innebörd; färgen visar epoken.`,
        )}
      >
        {sorted.map((p) => {
          const on = active(p)
          return (
            <circle
              key={p[0]}
              cx={sx(p[2])}
              cy={sy(p[3])}
              r={focus === p[0] ? 1.1 : on ? 0.55 : 0.4}
              className={
                on
                  ? `ph-dot ph-era-${eraOf(works[p[1]].period)}${p[4] < 0 ? ' is-noise' : ''}`
                  : 'ph-dot is-faded'
              }
              onMouseEnter={() => onFocus(p[0])}
            >
              <title>
                {works[p[1]].author}
                {p[4] >= 0 ? `, ${l('group', 'grupp')} ${p[4]}` : ''}
              </title>
            </circle>
          )
        })}
      </svg>
    </figure>
  )
}

function Evaluation({ ev }: { ev: Summary['run']['evaluation'] }) {
  const rows: [string, string, (e: Evaluation) => string][] = [
    ['Groups', 'Grupper', (e) => String(e.clusters)],
    ['Passages in no group', 'Passager utan grupp', (e) => pct(e.noise_share)],
    [
      'Groups drawing on ≥3 works, none above half',
      'Grupper från ≥3 verk, inget över hälften',
      (e) => String(e.cross_work_clusters),
    ],
    [
      'Groups dominated by one work (>80 %)',
      'Grupper dominerade av ett verk (>80 %)',
      (e) => String(e.work_dominated_clusters),
    ],
    [
      'Average share of the largest work in a group',
      'Genomsnittlig andel för största verket i en grupp',
      (e) => pct(e.mean_largest_work_share),
    ],
    [
      'Nearest neighbours from the same work (chance)',
      'Närmaste grannar från samma verk (slump)',
      (e) => `${pct(e.same_work_neighbours)} (${pct(e.same_work_chance)})`,
    ],
    [
      'Nearest neighbours with the same translator (chance)',
      'Närmaste grannar med samma översättare (slump)',
      (e) =>
        `${pct(e.same_translator_neighbours)} (${pct(e.same_translator_chance)})`,
    ],
  ]
  return (
    <div
      className="ph-table-wrap"
      tabIndex={0}
      aria-label={l(
        'How far the map follows works and translators',
        'Hur mycket kartan följer verk och översättare',
      )}
    >
      <table className="ph-table">
        <caption>
          {l(
            'How far the groups follow the works and translators instead of the ideas',
            'Hur mycket grupperna följer verk och översättare i stället för idéer',
          )}
        </caption>
        <thead>
          <tr>
            <th scope="col">{l('Measure', 'Mått')}</th>
            <th scope="col">{l('Raw', 'Rå')}</th>
            <th scope="col">{l('Centred per work', 'Centrerad per verk')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([en, sv, f]) => (
            <tr key={en}>
              <th scope="row">{l(en, sv)}</th>
              <td>{f(ev.baseline)}</td>
              <td>{f(ev.author_centered)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ph-hint">
        {l(
          'A well-separated group is not necessarily the structure we meant to measure: in the raw map almost half of a passage’s nearest neighbours come from its own work, against under a tenth by chance. Centring per work halves the work-dominated structure but cannot remove a translator’s voice entirely.',
          'En tydligt avgränsad grupp är inte nödvändigtvis den struktur vi ville mäta: i den råa kartan kommer nästan hälften av en passages närmaste grannar från samma verk, mot under en tiondel av en slump. Centrering per verk minskar den verksbundna strukturen men kan inte helt ta bort en översättares röst.',
        )}
      </p>
    </div>
  )
}

function Tensions({
  summary,
  data,
  active,
  onChange,
}: {
  summary: Summary
  data: { distribution: Distribution[]; poles: Pole[] }
  active: string
  onChange: (id: string) => void
}) {
  const t =
    summary.tensions.find((x) => x.tension_id === active) ?? summary.tensions[0]
  const rows = data.distribution
    .filter((d) => d.tension_id === t.tension_id)
    .sort((a, b) => b.median - a.median)
  const lo = Math.min(...rows.map((r) => r.q1))
  const hi = Math.max(...rows.map((r) => r.q3))
  const x = (v: number) => ((v - lo) / (hi - lo || 1)) * 100
  const work = (id: string) => summary.works.find((w) => w.document_id === id)
  return (
    <section
      id="philosophy-tensions"
      className="ph-section"
      aria-labelledby="ph-tension-title"
    >
      <h2 id="ph-tension-title">
        {l('Tensions, read as lenses', 'Spänningar, lästa som linser')}
      </h2>
      <p className="ph-hint">
        {l(
          'Each tension has two poles, each written as one sentence. Every passage is compared with both; its position is how much closer it sits to one pole than the other. A lens chosen by us, not an axis of philosophical truth, and the differences between works are small.',
          'Varje spänning har två poler, var och en skriven som en mening. Varje passage jämförs med båda; dess position är hur mycket närmare den ligger den ena polen än den andra. En lins vi valt, inte en axel för filosofisk sanning, och skillnaderna mellan verken är små.',
        )}
      </p>
      <label className="ph-select">
        <span>{l('Tension', 'Spänning')}</span>
        <select value={t.tension_id} onChange={(e) => onChange(e.target.value)}>
          {summary.tensions.map((x) => (
            <option key={x.tension_id} value={x.tension_id}>
              {l(x.label_en, x.label_sv)}
            </option>
          ))}
        </select>
      </label>
      <div className="ph-poles">
        <p>
          <b>{t.pole_a}</b> “{t.anchor_a}”
        </p>
        <p>
          <b>{t.pole_b}</b> “{t.anchor_b}”
        </p>
      </div>
      <ul
        className="ph-ranges"
        aria-label={l(
          'Median and middle half of each work',
          'Median och mittersta hälften för varje verk',
        )}
      >
        {rows.map((r) => {
          const w = work(r.document_id)
          return (
            <li key={r.document_id}>
              <span className="ph-range-label">{w?.author}</span>
              <span className="ph-range-track">
                <span
                  className="ph-range-iqr"
                  style={{
                    left: `${x(r.q1)}%`,
                    width: `${x(r.q3) - x(r.q1)}%`,
                  }}
                />
                <span
                  className={`ph-range-median ph-era-${eraOf(w?.period ?? '')}`}
                  style={{ left: `${x(r.median)}%` }}
                />
              </span>
              <span className="ph-range-value">{r.median.toFixed(3)}</span>
            </li>
          )
        })}
      </ul>
      <p className="ph-axis-ends" aria-hidden="true">
        <span>← {t.pole_b}</span>
        <span>{t.pole_a} →</span>
      </p>
      <div className="ph-pole-passages">
        {(['a', 'b'] as const).map((pole) => (
          <div key={pole}>
            <h3>
              {l('Closest to', 'Närmast')} {pole === 'a' ? t.pole_a : t.pole_b}
            </h3>
            <ol>
              {data.poles
                .filter((p) => p.tension_id === t.tension_id && p.pole === pole)
                .slice(0, 3)
                .map((p) => (
                  <li key={p.passage_id}>
                    <p className="ph-kicker">{work(p.document_id)?.author}</p>
                    <blockquote>{p.text}</blockquote>
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  )
}

function Works({ works }: { works: Work[] }) {
  return (
    <section
      id="philosophy-works"
      className="ph-section"
      aria-labelledby="ph-works-title"
    >
      <h2 id="ph-works-title">{l('The corpus', 'Korpusen')}</h2>
      <div
        className="ph-table-wrap"
        tabIndex={0}
        aria-label={l('The works', 'Verken')}
      >
        <table className="ph-table">
          <thead>
            <tr>
              <th scope="col">{l('Work', 'Verk')}</th>
              <th scope="col">{l('Year', 'År')}</th>
              <th scope="col">{l('Tradition', 'Tradition')}</th>
              <th scope="col">{l('Translator', 'Översättare')}</th>
              <th scope="col">{l('Passages', 'Passager')}</th>
            </tr>
          </thead>
          <tbody>
            {works.map((w) => (
              <tr key={w.document_id}>
                <td>
                  <i
                    className={`ph-swatch ph-era-${eraOf(w.period)}`}
                    aria-hidden="true"
                  />{' '}
                  {w.author}, <em>{w.title}</em>{' '}
                  <a href={w.source_url} target="_blank" rel="noreferrer">
                    Gutenberg ↗
                  </a>
                </td>
                <td>
                  {w.year < 0 ? `c. ${-w.year} ${l('BCE', 'f.Kr.')}` : w.year}
                </td>
                <td>{w.tradition.replace(/-/g, ' ')}</td>
                <td>
                  {w.translator ??
                    (w.original_language === 'en' ? (
                      l('written in English', 'skriven på engelska')
                    ) : (
                      <span title={w.translator_note ?? ''}>
                        {l('not named in the file', 'anges inte i filen')}
                      </span>
                    ))}
                </td>
                <td>{w.passages}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Method({ summary }: { summary: Summary }) {
  return (
    <section
      id="philosophy-method"
      className="ph-section"
      aria-labelledby="ph-method-title"
    >
      <h2 id="ph-method-title">
        {l('Method and limits', 'Metod och begränsningar')}
      </h2>
      <ul className="ph-list">
        <li>
          {l(
            'Only each philosopher’s own text: translators’ and editors’ introductions, biographies, analyses and notes are cut at marked lines, then tables of contents, indexes and footnotes by the shared cleaning.',
            'Bara filosofens egen text: översättares och redaktörers inledningar, biografier, analyser och noter skärs bort vid markerade rader, sedan innehållsförteckningar, register och fotnoter med den gemensamma rensningen.',
          )}
        </li>
        <li>
          {l(
            `Passages of about 60–220 words; ${summary.run.passages_total} in all, ${summary.run.passages_sampled} sampled evenly through each work.`,
            `Passager på cirka 60–220 ord; ${summary.run.passages_total} totalt, ${summary.run.passages_sampled} utvalda jämnt genom varje verk.`,
          )}
        </li>
        <li>
          {l(
            `Embeddings: ${summary.run.model}, the same model used for the cross-corpus concept layer. UMAP and HDBSCAN, as in the Symbolic Atlas.`,
            `Inbäddningar: ${summary.run.model}, samma modell som det gemensamma begreppslagret använder. UMAP och HDBSCAN, som i Symbolic Atlas.`,
          )}
        </li>
        <li>
          {l(
            'All texts are English translations except Hobbes, Locke, Hume and Mill: a translator’s English is part of what the model sees.',
            'Alla texter är engelska översättningar utom Hobbes, Locke, Hume och Mill: en översättares engelska är en del av det modellen ser.',
          )}
        </li>
        <li>
          {l(
            'Thirteen works cannot stand for traditions; this is a deliberate small corpus for exploring method, not a survey of philosophy.',
            'Tretton verk kan inte representera traditioner; det här är en medvetet liten korpus för att pröva metod, inte en översikt av filosofin.',
          )}
        </li>
      </ul>
      <p>
        <a
          href="https://github.com/korv9/anton-portfolio/blob/main/docs/philosophy-atlas.md"
          target="_blank"
          rel="noreferrer"
        >
          docs/philosophy-atlas.md ↗
        </a>
      </p>
    </section>
  )
}
