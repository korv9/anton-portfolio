/**
 * Philosophy Lab (#philosophy-atlas): how recurring ideas and moral tensions organise thirteen
 * public-domain works of philosophy. Built from platform/publish/philosophy/export_philosophy.py:
 * a balanced sample of passages, one multilingual embedding model, UMAP and HDBSCAN on two maps
 * (raw, and centred per work so a work's own voice and its translator's English weigh less), and
 * a set of tensions read as lenses. Clusters carry no generated names: a cluster is named only
 * after a person has reviewed it. Experimental.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import ProjectTech from '../projects/ProjectTech'
import { ProductQuality } from '../quality/QualityPanel'
import { PHILOSOPHY_TABS, type Route } from '../router'
import { fetchData } from '../dataSource'
import { useViewParams } from '../report/useViewParams'
import ReportShell, {
  DeepPage,
  ReportFrame,
  withQuery,
  type DeeperLink,
  type ReportTab,
} from '../report/ReportShell'
import { Feature } from '../charts/feature/Feature'
import { Select } from '../report/controls'
import ReportMaps from '../clusters/ReportMaps'
import './philosophy.css'

const NAME = 'Philosophy Lab'
const tabs = (): ReportTab[] => [
  {
    path: '#philosophy-atlas',
    label: l('Ideas or books', 'Idéer eller böcker'),
    question: l(
      'Do the passages gather by idea, or by the book they come from?',
      'Samlas passagerna efter idé, eller efter boken de kommer från?',
    ),
  },
  {
    path: '#philosophy-groups',
    label: l('The groups', 'Grupperna'),
    question: l(
      'What do the groups of passages talk about?',
      'Vad handlar grupperna av passager om?',
    ),
  },
  {
    path: '#philosophy-tensions',
    label: l('Tensions', 'Spänningar'),
    question: l(
      'Where do the thinkers stand between two poles?',
      'Var står tänkarna mellan två poler?',
    ),
  },
]
const deeper = (): DeeperLink[] => [
  {
    href: '#philosophy-works',
    label: l('The corpus', 'Korpusen'),
    about: l(
      'The thirteen works, their translators and passages',
      'De tretton verken, översättarna och passagerna',
    ),
  },
  {
    href: '#philosophy-method',
    label: l('Method and limits', 'Metod och begränsningar'),
    about: l(
      'Cleaning, sampling, the model and the quality checks',
      'Rensning, urval, modellen och kvalitetskontrollerna',
    ),
  },
  {
    href: '#concept-journey',
    label: 'Concept Lab',
    about: l(
      'The same concepts across myth, philosophy, politics and law',
      'Samma begrepp i myter, filosofi, politik och lag',
    ),
  },
  {
    href: '#symbolic-atlas',
    label: 'Symbol Lab',
    about: l(
      'The same method on myths, folk tales and literature',
      'Samma metod på myter, folksagor och litteratur',
    ),
  },
]
const withView = (path: string, route: Route) => withQuery(path, route.params)

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
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const pct = (v: number) => `${Math.round(v * 100)} %`
// Display-side cleanup of the c-TF-IDF words: roman numerals (Spinoza's "iii"), "prop", archaic
// and function words carry no idea. The pipeline still exports them.
const ROMAN = /^m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/
const JUNK = new Set(
  'thou thy thee thine ye unto thyself doth hath shalt shall whatsoever prop note did does say said says yes let far like make come thing things case kind matter means ought great'.split(
    ' ',
  ),
)
const cleanTerms = (terms: string[]) =>
  terms.filter((t) => !JUNK.has(t) && !ROMAN.test(t))
const groupTitle = (c: Cluster) =>
  c.review_label ?? cleanTerms(c.distinctive_terms).slice(0, 3).join(', ')
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
      <ReportFrame>
        <div className="philosophy">
          <p role="alert">
            {l('The atlas could not be loaded.', 'Atlasen kunde inte laddas.')}
          </p>
        </div>
      </ReportFrame>
    )
  if (!summary || !atlas || !tensions)
    return (
      <ReportFrame>
        <div className="philosophy">
          <p role="status">
            {l('Loading the passages…', 'Laddar textpassagerna…')}
          </p>
        </div>
      </ReportFrame>
    )

  const works = summary.works
  if (!PHILOSOPHY_TABS.includes(route.path))
    return (
      <ReportFrame>
        <div className="philosophy">
          <DeepPage
            id={route.path.slice(1)}
            back="#philosophy-atlas"
            name={NAME}
          >
            {route.path === '#philosophy-works' ? (
              <>
                <h1>{l('The corpus', 'Korpusen')}</h1>
                <Works works={works} />
              </>
            ) : (
              <>
                <h1>{l('Method and limits', 'Metod och begränsningar')}</h1>
                <Method summary={summary} />
                <ProductQuality product="philosophy" />
                <ProjectTech project="philosophy-atlas" />
              </>
            )}
          </DeepPage>
        </div>
      </ReportFrame>
    )

  const variant = params.karta === 'baseline' ? 'baseline' : 'author_centered'
  const points = atlas[variant]
  const workIndex = params.verk
    ? works.findIndex((w) => w.document_id === params.verk)
    : -1
  const clusterId = params.kluster === '' ? null : Number(params.kluster)
  const variantClusters = clusters.filter((c) => c.variant === variant)
  const ev = summary.run.evaluation
  const focusPoint = focus ? points.find((p) => p[0] === focus) : null
  const tab = PHILOSOPHY_TABS.indexOf(route.path)
  const tension =
    summary.tensions.find((x) => x.tension_id === params.spanning) ??
    summary.tensions[0]
  const across = variantClusters.filter((c) => c.is_cross_work).length
  const groupName = (id: number) => {
    const c = variantClusters.find((x) => x.cluster_id === id)
    return c ? groupTitle(c) : ''
  }

  const slicer =
    tab === 2 ? (
      <div
        className="report-chips"
        role="group"
        aria-label={l('Tension', 'Spänning')}
      >
        {summary.tensions.map((x) => (
          <button
            key={x.tension_id}
            type="button"
            aria-pressed={x.tension_id === tension.tension_id}
            onClick={() => set({ spanning: x.tension_id })}
          >
            {l(x.label_en, x.label_sv)}
          </button>
        ))}
      </div>
    ) : (
      <div className="report-chips" role="group" aria-label={l('Map', 'Karta')}>
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
    )

  return (
    <ReportFrame>
      <div className="philosophy">
        <ReportShell
          name={NAME}
          intro={l(
            `${summary.run.passages_sampled.toLocaleString('en-GB')} passages from ${works.length} works, Plato to Nietzsche, placed by meaning. Taking out each work’s own voice lifts the groups that span works from ${ev.baseline.cross_work_clusters} to ${ev.author_centered.cross_work_clusters}.`,
            `${summary.run.passages_sampled} passager ur ${works.length} verk, Platon till Nietzsche, placerade efter innebörd. När varje verks egen röst dras bort ökar grupperna som spänner över flera verk från ${ev.baseline.cross_work_clusters} till ${ev.author_centered.cross_work_clusters}.`,
          )}
          tabs={tabs()}
          path={route.path}
          hrefOf={(p) => withView(p, route)}
          slicerLabel={tab === 2 ? l('Tension', 'Spänning') : l('Map', 'Karta')}
          slicer={slicer}
          deeper={deeper()}
        >
          {tab === 0 && (
            <>
              <div className="report-main">
                <Feature
                  id="kartan"
                  title={l(
                    `Centring per work: ${ev.baseline.cross_work_clusters} → ${ev.author_centered.cross_work_clusters} groups across works, ${pct(ev.baseline.same_work_neighbours)} → ${pct(ev.author_centered.same_work_neighbours)} same-work neighbours (chance ${pct(ev.baseline.same_work_chance)})`,
                    `Centrering per verk: ${ev.baseline.cross_work_clusters} → ${ev.author_centered.cross_work_clusters} grupper över flera verk, ${pct(ev.baseline.same_work_neighbours)} → ${pct(ev.author_centered.same_work_neighbours)} grannar från samma verk (slump ${pct(ev.baseline.same_work_chance)})`,
                  )}
                  lead={
                    variant === 'author_centered'
                      ? l(
                          'Each work’s average position is taken out, so passages group by topic, not by book.',
                          'Varje verks genomsnittliga position dras bort, så passager grupperas efter ämne, inte efter bok.',
                        )
                      : l(
                          'The raw embeddings: passages from one work sit together, whatever they discuss.',
                          'De råa inbäddningarna: passager ur samma verk hamnar tillsammans, vad de än handlar om.',
                        )
                  }
                  controls={
                    <Select
                      label={l('Highlight a work', 'Markera ett verk')}
                      value={params.verk}
                      options={[
                        { value: '', label: l('All works', 'Alla verk') },
                        ...works.map((w) => ({
                          value: w.document_id,
                          label: `${w.author}, ${w.title}`,
                        })),
                      ]}
                      onChange={(v) => set({ verk: v })}
                    />
                  }
                  source={`${summary.run.model}, UMAP`}
                >
                  <AtlasMap
                    points={points}
                    works={works}
                    workIndex={workIndex}
                    clusterId={clusterId}
                    focus={focus}
                    onFocus={setFocus}
                    groupName={groupName}
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
                        {works[focusPoint[1]].author},{' '}
                        {works[focusPoint[1]].title}
                        {focusPoint[4] >= 0
                          ? `, ${groupName(focusPoint[4])}`
                          : `, ${l('no group', 'ingen grupp')}`}
                      </p>
                      <blockquote>
                        {passages?.[focusPoint[0]] ?? l('Loading…', 'Laddar…')}
                      </blockquote>
                    </aside>
                  )}
                </Feature>
              </div>
              <div className="report-main">
                <Feature
                  id="verk-eller-ide"
                  title={l(
                    `${points.length.toLocaleString('en-GB')} passages, two maps: how far each follows the works`,
                    `${points.length} passager, två kartor: hur mycket var och en följer verken`,
                  )}
                  lead={l(
                    'How far the groups follow works instead of ideas, raw and centred.',
                    'Hur mycket grupperna följer verk i stället för idéer, rått och centrerat.',
                  )}
                  source={l(
                    'HDBSCAN groups and nearest neighbours on each map',
                    'HDBSCAN-grupper och närmaste grannar på varje karta',
                  )}
                >
                  <Evaluation ev={ev} />
                </Feature>
              </div>
            </>
          )}
          {tab === 1 && (
            <div className="report-main">
              <Feature
                id="grupperna"
                title={l(
                  `${variantClusters.length} groups, ${across} of them across works`,
                  `${variantClusters.length} grupper, varav ${across} tvärgående`,
                )}
                lead={l(
                  'Each group is titled by its most distinctive words. A group across works draws on at least three works, none above half.',
                  'Varje grupp har sina mest utmärkande ord som rubrik. En tvärgående grupp hämtar från minst tre verk, inget över hälften.',
                )}
                source={l(
                  'HDBSCAN on the chosen map; the distinctive words of each group',
                  'HDBSCAN på vald karta; varje grupps utmärkande ord',
                )}
              >
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
                              clusterId === c.cluster_id
                                ? ''
                                : String(c.cluster_id),
                          })
                        }
                      >
                        <span className="ph-group-id">{groupTitle(c)}</span>
                        <span className="ph-group-terms">
                          {cleanTerms(c.distinctive_terms)
                            .slice(c.review_label ? 0 : 3, 8)
                            .join(', ')}
                        </span>
                        <span className="ph-group-meta">
                          {c.size} {l('passages', 'passager')}, {c.work_count}{' '}
                          {l('works', 'verk')}
                          {c.is_cross_work && (
                            <b>, {l('across works', 'tvärgående')}</b>
                          )}
                          {c.review_status !== 'unreviewed' &&
                            `, ${c.review_status}`}
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
                                  {w?.author}, {w?.title}
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
                <ul className="ph-legend">
                  {ERAS.map((e, k) => (
                    <li key={e.id}>
                      <i className={`ph-era-${k}`} /> {l(...e.label)}
                    </li>
                  ))}
                </ul>
              </Feature>
              <ReportMaps ids={['research-philosophy']} />
            </div>
          )}
          {tab === 2 && (
            <Tensions summary={summary} data={tensions} t={tension} />
          )}
        </ReportShell>
      </div>
    </ReportFrame>
  )
}

function AtlasMap({
  points,
  works,
  workIndex,
  clusterId,
  focus,
  onFocus,
  groupName,
}: {
  points: Point[]
  works: Work[]
  workIndex: number
  clusterId: number | null
  focus: string | null
  onFocus: (id: string | null) => void
  groupName: (id: number) => string
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
                {p[4] >= 0 ? `, ${groupName(p[4])}` : ''}
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
          'Raw, almost half of a passage’s neighbours come from its own work, against under a tenth by chance. Centring halves that, but a translator’s voice remains.',
          'Rått kommer nästan hälften av en passages grannar från samma verk, mot under en tiondel av en slump. Centrering halverar det, men översättarens röst finns kvar.',
        )}
      </p>
    </div>
  )
}

function Tensions({
  summary,
  data,
  t,
}: {
  summary: Summary
  data: { distribution: Distribution[]; poles: Pole[] }
  t: Tension
}) {
  const rows = data.distribution
    .filter((d) => d.tension_id === t.tension_id)
    .sort((a, b) => b.median - a.median)
  const lo = Math.min(...rows.map((r) => r.q1))
  const hi = Math.max(...rows.map((r) => r.q3))
  const x = (v: number) => ((v - lo) / (hi - lo || 1)) * 100
  const work = (id: string) => summary.works.find((w) => w.document_id === id)
  return (
    <>
      <div className="report-main">
        <Feature
          id="spanningen"
          title={l(
            `${cap(t.pole_a)} or ${t.pole_b}: where each thinker stands`,
            `${cap(t.pole_a)} eller ${t.pole_b}: var varje tänkare står`,
          )}
          lead={l(
            'Each pole is one sentence; a passage sits by how much closer it is to one. Bar: the middle half of a work’s passages, dot: the median. The differences are small.',
            'Varje pol är en mening; en passage hamnar efter hur mycket närmare den ligger den ena. Stapel: verkets mittersta hälft, punkt: medianen. Skillnaderna är små.',
          )}
          source={`${summary.run.model}; ${l('cosine similarity to each pole sentence', 'cosinuslikhet mot varje polmening')}`}
        >
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
        </Feature>
      </div>
      <div className="report-pair">
        {(['a', 'b'] as const).map((pole) => (
          <Feature
            key={pole}
            id={`polen-${pole}`}
            title={`${l('Closest to', 'Närmast')} ${pole === 'a' ? t.pole_a : t.pole_b}`}
            source={l(
              'The three passages ranked closest to the pole',
              'De tre passager som ligger närmast polen',
            )}
          >
            <ol className="ph-pole-list">
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
          </Feature>
        ))}
      </div>
    </>
  )
}

function Works({ works }: { works: Work[] }) {
  return (
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
                  Gutenberg
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
  )
}

function Method({ summary }: { summary: Summary }) {
  return (
    <>
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
            `Embeddings: ${summary.run.model}, the same model used for the cross-corpus concept layer. UMAP and HDBSCAN, as in the Symbol Lab.`,
            `Inbäddningar: ${summary.run.model}, samma modell som det gemensamma begreppslagret använder. UMAP och HDBSCAN, som i Symbol Lab.`,
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
          docs/philosophy-atlas.md
        </a>
      </p>
    </>
  )
}
