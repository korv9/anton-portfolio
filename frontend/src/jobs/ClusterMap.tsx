import { useEffect, useMemo, useRef, useState } from 'react'
import { currentLocale, l } from '../i18n'
import { Metric, Tag } from '../ui/Editorial'
import {
  clusterColor,
  jsonData,
  pointColor,
  projectCoordinates,
  ROLES,
  CLUSTER_COLORS,
  type Cluster,
  type JobPoint,
  type Mode,
  type Summary,
} from './clusterData'
import './clusters.css'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const num = (v: number) =>
  v.toLocaleString(currentLocale() === 'sv' ? 'sv-SE' : 'en-GB')

export default function ClusterMap() {
  const [data, setData] = useState<{
    summary: Summary
    points: JobPoint[]
  } | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [mode, setMode] = useState<Mode>('cluster')
  const [frame, setFrame] = useState<'clusters' | 'all'>('clusters')
  const [year, setYear] = useState('all')
  const [selected, setSelected] = useState<number | null>(null)
  const [hover, setHover] = useState<JobPoint | null>(null)
  const [focused, setFocused] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 800, height: 480 })

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    jsonData<Summary>('jobs/cluster-summary.json', controller.signal)
      .then(async (summary) => {
        if (summary.schema_version !== 1)
          throw new Error('Unsupported analysis format')
        const points: JobPoint[] = []
        // Sequential shards bound peak parsing memory and can be aborted on navigation.
        for (const shard of summary.shards) {
          const part = await jsonData<{ run_id: string; points: JobPoint[] }>(
            shard,
            controller.signal,
          )
          if (part.run_id !== summary.run_id)
            throw new Error('Mismatched analysis run')
          points.push(...part.points)
        }
        if (
          points.length !== summary.diagnostics.dataset_size ||
          new Set(points.map((p) => p.id)).size !== points.length ||
          points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
        )
          throw new Error('Invalid point dataset')
        if (!controller.signal.aborted) setData({ summary, points })
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => controller.abort()
  }, [retry])
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = Math.max(240, entries[0].contentRect.width)
      setSize({ width, height: Math.min(560, Math.max(320, width * 0.6)) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [data])
  const points = data?.points
  const years = useMemo(
    () => [...new Set(points?.map((p) => p.year) ?? [])].sort(),
    [points],
  )
  const visible = useMemo(
    () =>
      (points ?? []).filter((p) => year === 'all' || p.year === Number(year)),
    [points, year],
  )
  const fitPoints = useMemo(
    () =>
      frame === 'clusters'
        ? (points ?? []).filter((p) => p.cluster !== -1)
        : (points ?? []),
    [points, frame],
  )
  // Camera bounds use the complete corpus, keeping geometry stable across year filters.
  const coords = useMemo(
    () => projectCoordinates(points ?? [], size.width, size.height, fitPoints),
    [points, size, fitPoints],
  )
  const outsideFrame = visible.filter((p) => {
    const pos = coords.get(p.id)
    return (
      pos &&
      (pos[0] < 0 || pos[0] > size.width || pos[1] < 0 || pos[1] > size.height)
    )
  }).length
  useEffect(() => {
    setHover(null)
    setFocused(0)
  }, [year])
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = window.devicePixelRatio || 1
    el.width = size.width * dpr
    el.height = size.height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, size.width, size.height)
    for (const p of visible) {
      const [x, y] = coords.get(p.id)!
      ctx.globalAlpha =
        selected !== null && selected !== p.cluster ? 0.08 : 0.55
      ctx.fillStyle = pointColor(p, mode, years)
      ctx.beginPath()
      ctx.arc(
        x,
        y,
        Math.max(
          0.8,
          Math.min(2.2, 2.2 * Math.sqrt(1000 / Math.max(1, visible.length))),
        ),
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
    if (hover && coords.has(hover.id)) {
      const [x, y] = coords.get(hover.id)!
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#111'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.stroke()
    }
  }, [coords, visible, mode, years, hover, selected, size])

  if (error)
    return (
      <div className="cluster-status" role="status">
        <p>
          {l(
            'The clustering analysis is currently unavailable. Existing job-market reports remain available.',
            'Klustringsanalysen är inte tillgänglig just nu. Befintliga arbetsmarknadsrapporter finns kvar.',
          )}
        </p>
        <button
          className="ds-button secondary"
          onClick={() => setRetry((v) => v + 1)}
        >
          {l('Try again', 'Försök igen')}
        </button>
      </div>
    )
  if (!data)
    return (
      <p role="status">
        {l('Loading the semantic map…', 'Laddar den semantiska kartan…')}
      </p>
    )
  const { summary } = data
  const isConsensus = summary.config.assignment_method === 'seed-consensus'
  const cluster = summary.clusters.find((c) => c.cluster_id === selected)
  const largest = summary.clusters
    .filter((c) => c.cluster_id !== -1)
    .sort((a, b) => b.job_count - a.job_count)[0]
  const legend =
    mode === 'cluster'
      ? summary.clusters.map(
          (c) => [c.cluster_label, clusterColor(c.cluster_id)] as const,
        )
      : mode === 'role'
        ? ROLES.map((r, i) => [r, CLUSTER_COLORS[i]] as const)
        : mode === 'seniority'
          ? [
              ['Junior', '#4E79A7'],
              ['Senior', '#D4715A'],
              [l('Unspecified', 'Ospecificerad'), '#94948E'],
            ]
          : years.map((y) => [
              String(y),
              pointColor({ year: y } as JobPoint, 'year', years),
            ])
  function nearest(clientX: number, clientY: number) {
    const bounds = canvas.current!.getBoundingClientRect()
    const x = clientX - bounds.left,
      y = clientY - bounds.top
    let distance = 144,
      hit: JobPoint | null = null
    for (const p of visible) {
      const pos = coords.get(p.id)!
      const d = (pos[0] - x) ** 2 + (pos[1] - y) ** 2
      if (d < distance) {
        distance = d
        hit = p
      }
    }
    return hit
  }
  return (
    <div className="cluster-explorer">
      <p className="ds-small">
        {summary.sampled
          ? l(
              `A reproducible sample of ${num(summary.diagnostics.dataset_size)} out of ${num(summary.source_size)} selected ads.`,
              `Ett reproducerbart urval av ${num(summary.diagnostics.dataset_size)} av ${num(summary.source_size)} utvalda annonser.`,
            )
          : l(
              `${num(summary.diagnostics.dataset_size)} selected tech advertisements.`,
              `${num(summary.diagnostics.dataset_size)} utvalda IT-annonser.`,
            )}{' '}
        {summary.source_kinds.includes('live') &&
          l(
            'Current API sample; not the historical archive.',
            'Aktuellt API-urval; inte det historiska arkivet.',
          )}
      </p>
      {summary.coverage && (
        <p className="ds-small">
          {l('Archive coverage', 'Arkivtäckning')}:{' '}
          {[
            ...new Set(
              summary.coverage
                .filter((c) => c.status === 'complete')
                .map((c) => c.month.slice(0, 4)),
            ),
          ].join(', ')}
          .{' '}
          {l(
            'Publication years outside this coverage are archive spillover, not complete additional years.',
            'Publiceringsår utanför denna täckning är överlapp i arkivet, inte ytterligare kompletta år.',
          )}
        </p>
      )}
      <div className="cluster-metrics">
        <Metric
          value={summary.diagnostics.cluster_count}
          label={l('Semantic clusters', 'Semantiska kluster')}
        />
        <Metric
          value={pct(summary.diagnostics.noise_share)}
          label={l('Unassigned / noise', 'Ej tilldelade / brus')}
        />
        <Metric
          value={(
            summary.diagnostics.feature_trustworthiness ??
            summary.diagnostics.trustworthiness
          ).toFixed(3)}
          label="UMAP trustworthiness"
        />
      </div>
      <div className="cluster-controls">
        <fieldset>
          <legend>{l('Map view', 'Kartutsnitt')}</legend>
          <button
            type="button"
            aria-pressed={frame === 'clusters'}
            onClick={() => setFrame('clusters')}
          >
            {l('Fit clusters', 'Visa klusterutsnitt')}
          </button>
          <button
            type="button"
            aria-pressed={frame === 'all'}
            onClick={() => setFrame('all')}
          >
            {l('Show all points', 'Visa alla punkter')}
          </button>
        </fieldset>
        <fieldset>
          <legend>{l('Colour by', 'Färglägg efter')}</legend>
          {(
            [
              ['cluster', l('Discovered clusters', 'Upptäckta kluster')],
              ['role', l('Existing role', 'Befintlig roll')],
              ['seniority', l('Seniority', 'Senioritet')],
              ['year', l('Year', 'År')],
            ] as [Mode, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <label>
          {l('Publication year', 'Publiceringsår')}
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">{l('All years', 'Alla år')}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="ds-small" id="cluster-frame" aria-live="polite">
        {frame === 'clusters'
          ? l(
              `View fitted to assigned clusters. ${num(outsideFrame)} ads lie outside this frame; choose “Show all points” to include them. Coordinates and analysis counts are unchanged.`,
              `Utsnittet är anpassat till tilldelade kluster. ${num(outsideFrame)} annonser ligger utanför bildutsnittet; välj ”Visa alla punkter” för att se dem. Koordinater och analysantal är oförändrade.`,
            )
          : l(
              'The entire fitted map is shown, including distant noise points.',
              'Hela den beräknade kartan visas, inklusive avlägsna bruspunkter.',
            )}
      </p>
      <p id="cluster-map-help" className="ds-small">
        {l(
          'Nearby ads have similar semantic representations. Axes have no named meaning. Use arrow keys to inspect ads, Enter to select their cluster and Escape to clear.',
          'Närliggande annonser har liknande semantiska representationer. Axlarna saknar namngiven betydelse. Använd piltangenter för att granska annonser, Enter för att välja deras kluster och Escape för att rensa.',
        )}
      </p>
      <div className="cluster-layout plate">
        <div>
          <canvas
            ref={canvas}
            style={{ height: size.height }}
            role="img"
            tabIndex={0}
            aria-label={l(
              `Semantic map: ${visible.length - outsideFrame} advertisements in frame, ${visible.length} in the year selection`,
              `Semantisk karta: ${visible.length - outsideFrame} annonser inom bildutsnittet, ${visible.length} i årsurvalet`,
            )}
            aria-describedby="cluster-map-help cluster-visible cluster-frame cluster-point"
            onPointerMove={(e) => setHover(nearest(e.clientX, e.clientY))}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              const p = nearest(e.clientX, e.clientY)
              if (p) {
                setSelected(p.cluster)
                setHover(p)
              }
            }}
            onFocus={() => setHover(visible[focused] ?? null)}
            onKeyDown={(e) => {
              if (
                [
                  'ArrowRight',
                  'ArrowDown',
                  'ArrowLeft',
                  'ArrowUp',
                  'Home',
                  'End',
                ].includes(e.key)
              ) {
                e.preventDefault()
                const next =
                  e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? visible.length - 1
                      : Math.max(
                          0,
                          Math.min(
                            visible.length - 1,
                            focused +
                              (['ArrowLeft', 'ArrowUp'].includes(e.key)
                                ? -1
                                : 1),
                          ),
                        )
                setFocused(next)
                setHover(visible[next] ?? null)
              }
              if (e.key === 'Enter' && hover) setSelected(hover.cluster)
              if (e.key === 'Escape') {
                setSelected(null)
                setHover(null)
              }
            }}
          />
          <p id="cluster-visible" aria-live="polite" className="ds-label">
            {num(visible.length)}{' '}
            {l('advertisements in selection', 'annonser i urvalet')} ·{' '}
            {num(visible.length - outsideFrame)}{' '}
            {l('within frame', 'inom bildutsnittet')}
          </p>
          <div id="cluster-point" className="cluster-point" aria-live="polite">
            {hover ? (
              <>
                <strong>{hover.title}</strong>
                <span>
                  {hover.region} · {hover.year} · {hover.cluster_label}
                </span>
                <span>
                  {l('Existing label', 'Befintlig etikett')}: {hover.role} ·{' '}
                  {hover.seniority} ·{' '}
                  {isConsensus
                    ? l(
                        'Cluster assignment support',
                        'Stöd för grupptilldelning',
                      )
                    : l('Membership', 'Medlemskap')}
                  : {pct(hover.probability)}
                </span>
                <span>{hover.skills.join(' · ')}</span>
              </>
            ) : (
              l(
                'Point details appear here on hover or keyboard focus.',
                'Annonsdetaljer visas här vid hovring eller tangentbordsfokus.',
              )
            )}
          </div>
          <ul
            className="cluster-legend"
            aria-label={l('Colour legend', 'Färgförklaring')}
          >
            {legend.map(([label, color], index) => (
              <li key={`${label}-${index}`}>
                {mode === 'cluster' ? (
                  <button
                    type="button"
                    aria-pressed={
                      selected === summary.clusters[index].cluster_id
                    }
                    onClick={() => {
                      const id = summary.clusters[index].cluster_id
                      setSelected(selected === id ? null : id)
                    }}
                  >
                    <i style={{ background: color }} />
                    {`${summary.clusters[index].cluster_id === -1 ? '−1' : String(summary.clusters[index].cluster_id).padStart(2, '0')} · ${label}`}
                  </button>
                ) : (
                  <>
                    <i style={{ background: color }} />
                    {label}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
        <aside className="cluster-detail">
          <label>
            {l('Inspect a cluster', 'Granska ett kluster')}
            <select
              value={selected ?? ''}
              onChange={(e) =>
                setSelected(
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
            >
              <option value="">
                {l('Choose a cluster', 'Välj ett kluster')}
              </option>
              {summary.clusters.map((c) => (
                <option key={c.cluster_id} value={c.cluster_id}>
                  {c.cluster_id} · {c.cluster_label}
                </option>
              ))}
            </select>
          </label>
          {cluster ? (
            <ClusterDetails cluster={cluster} />
          ) : (
            <p>
              {l(
                'Select a point or choose a cluster to compare its skills, titles and existing role labels.',
                'Välj en punkt eller ett kluster för att jämföra kompetenser, titlar och befintliga rolletiketter.',
              )}
            </p>
          )}
          {selected !== null && (
            <button
              className="ds-button secondary"
              onClick={() => setSelected(null)}
            >
              {l('Clear selection', 'Rensa val')}
            </button>
          )}
        </aside>
      </div>
      <section
        className="cluster-size-comparison"
        aria-labelledby="cluster-size-heading"
      >
        <h3 id="cluster-size-heading">
          {l('How large are the groups?', 'Hur stora är grupperna?')}
        </h3>
        <p>
          {l(
            'All years in the dataset. Compare ad counts, independently of the space each group occupies on the map. Select a bar to inspect the group above. Unassigned ads are shown separately in grey.',
            'Alla år i datamängden. Jämför antal annonser, oberoende av hur stor yta gruppen tar på kartan. Välj en stapel för att granska gruppen ovan. Ej tilldelade annonser visas separat i grått.',
          )}
        </p>
        <ol className="cluster-size-bars">
          {[...summary.clusters]
            .sort((a, b) =>
              a.cluster_id === -1
                ? 1
                : b.cluster_id === -1
                  ? -1
                  : b.job_count - a.job_count,
            )
            .map((c) => (
              <li key={c.cluster_id}>
                <button
                  type="button"
                  aria-pressed={selected === c.cluster_id}
                  onClick={() => {
                    setSelected(c.cluster_id)
                    document
                      .querySelector<HTMLElement>('.cluster-detail')
                      ?.scrollIntoView({ block: 'nearest' })
                  }}
                >
                  <span>
                    {c.cluster_id === -1
                      ? l('Unassigned', 'Ej tilldelade')
                      : `${c.cluster_id} · ${c.cluster_label}`}
                  </span>
                  <span className="cluster-size-track" aria-hidden="true">
                    <i
                      style={{
                        width: `${(c.job_count / Math.max(1, ...summary.clusters.map((item) => item.job_count))) * 100}%`,
                        background: c.cluster_id === -1 ? '#94948e' : '#4e79a7',
                      }}
                    />
                  </span>
                  <strong>{num(c.job_count)}</strong>
                </button>
              </li>
            ))}
        </ol>
      </section>
      <details className="cluster-method">
        <summary>
          {l(
            'Method, diagnostics & limitations',
            'Metod, diagnostik och begränsningar',
          )}
        </summary>
        <p>
          {summary.config.model} → UMAP ({summary.config.dimensions ?? 15}{' '}
          dimensions) → HDBSCAN{isConsensus ? ' → consensus' : ''}. A separate
          2D UMAP is used for this map.
        </p>
        {summary.feature_ensemble && (
          <p>
            {l('Feature mixture', 'Kombinerade egenskaper')}:{' '}
            {Object.entries(summary.feature_ensemble.weights)
              .map(
                ([key, weight]) =>
                  `${pct(weight)} ${l(({ clean: 'cleaned advertisement text', title: 'title patterns', skills: 'technology mentions', raw: 'original text', lexical: 'lexical text patterns' } as Record<string, string>)[key] ?? key, ({ clean: 'rensad annonstext', title: 'rubrikmönster', skills: 'teknikomnämnanden', raw: 'ursprunglig text', lexical: 'lexikala textmönster' } as Record<string, string>)[key] ?? key)}`,
              )
              .join(', ')}
            .{' '}
            {isConsensus &&
              l(
                'A group assignment requires agreement from at least two of three runs. Agreement is not a calibrated probability that the label is correct.',
                'En grupptilldelning kräver stöd från minst två av tre körningar. Stödet är inte en kalibrerad sannolikhet att etiketten är korrekt.',
              )}
          </p>
        )}
        <p>
          {l(
            'Statistics describe the complete analysis dataset; filtering changes visible points only. Cluster labels are automatic descriptions. Skill mentions and title-based seniority may be misleading.',
            'Statistiken beskriver hela analysunderlaget; filtret ändrar bara synliga punkter. Klusteretiketter är automatiska beskrivningar. Kompetensomnämnanden och titelbaserad senioritet kan vara missvisande.',
          )}
        </p>
        <p>
          {l('Trustworthiness evaluation sample', 'Urval för trustworthiness')}:{' '}
          {num(summary.diagnostics.trustworthiness_sample_size)}. Silhouette:{' '}
          {summary.diagnostics.silhouette?.toFixed(3) ?? '—'}.{' '}
          {summary.diagnostics.embedding_silhouette !== undefined && (
            <>
              {l(
                'Silhouette in original language vectors',
                'Silhouette i ursprungliga språkvektorer',
              )}
              : {summary.diagnostics.embedding_silhouette?.toFixed(3) ?? '—'}
              .{' '}
            </>
          )}
          {summary.diagnostics.feature_silhouette !== undefined && (
            <>
              {l(
                'Silhouette in combined features',
                'Silhouette i kombinerade egenskaper',
              )}
              : {summary.diagnostics.feature_silhouette?.toFixed(3) ?? '—'}
              .{' '}
            </>
          )}
          {isConsensus
            ? l(
                'Mean agreement across runs',
                'Genomsnittligt stöd mellan körningar',
              )
            : l(
                'Mean membership probability',
                'Genomsnittlig medlemskapssannolikhet',
              )}
          : {summary.diagnostics.mean_cluster_probability?.toFixed(3) ?? '—'}.
        </p>
        {summary.diagnostics.feature_trustworthiness !== undefined && (
          <p>
            {l(
              'Map neighbour preservation in combined features',
              'Kartans bevarande av grannar i kombinerade egenskaper',
            )}
            : {summary.diagnostics.feature_trustworthiness.toFixed(3)}.{' '}
            {l(
              'In original full-text vectors',
              'I ursprungliga fulltextvektorer',
            )}
            : {summary.diagnostics.trustworthiness.toFixed(3)}.
          </p>
        )}
        {summary.parameter_sweep && (
          <p>
            {l(
              `${summary.parameter_sweep.candidate_count} parameter combinations were compared. The selected grouping was also checked with ${summary.parameter_sweep.seed_stability.length} additional random seeds. Separation scores exclude unassigned ads; higher noise can make these scores look better.`,
              `${summary.parameter_sweep.candidate_count} parameterkombinationer jämfördes. Den valda grupperingen kontrollerades också med ${summary.parameter_sweep.seed_stability.length} ytterligare slumpfrön. Separationsmåtten utesluter ej tilldelade annonser; mer brus kan få dessa mått att se bättre ut.`,
            )}
          </p>
        )}
        {summary.feature_ensemble?.candidate_count && (
          <p>
            {l(
              `${summary.feature_ensemble.candidate_count} feature and parameter combinations were compared, including the previous model. The ensemble was checked with additional seed windows. Fewer unassigned ads and lower employer concentration do not establish a validated occupational taxonomy.`,
              `${summary.feature_ensemble.candidate_count} feature- och parameterkombinationer jämfördes, inklusive den tidigare modellen. Ensemblen kontrollerades med ytterligare grupper av slumpfrön. Färre ej tilldelade annonser och lägre arbetsgivarkoncentration fastställer inte en validerad yrkesindelning.`,
            )}
          </p>
        )}
        <p>
          {l(
            'Only the selected software and data role universe is included. An advertisement is not a hire; geometry is exploratory, not causal.',
            'Endast de utvalda mjukvaru- och datarollerna ingår. En annons är inte en anställning; geometrin är utforskande, inte kausal.',
          )}
        </p>
        <p className="ds-label">
          {summary.generated_at.slice(0, 10)} · {summary.run_id}
        </p>
      </details>
      <div className="cluster-findings">
        <h3>{l('What the clusters reveal', 'Vad klustren visar')}</h3>
        {largest ? (
          <p>
            {l(
              `The largest discovered group, “${largest.cluster_label}”, contains ${num(largest.job_count)} ads (${pct(largest.dataset_share)} of this dataset). ${largest.role_distribution[0].label} accounts for ${pct(largest.role_distribution[0].share)} of that group.`,
              `Den största upptäckta gruppen, ”${largest.cluster_label}”, innehåller ${num(largest.job_count)} annonser (${pct(largest.dataset_share)} av underlaget). ${largest.role_distribution[0].label} utgör ${pct(largest.role_distribution[0].share)} av gruppen.`,
            )}
          </p>
        ) : (
          <p>
            {l(
              'No dense clusters were identified with these parameters.',
              'Inga täta kluster identifierades med dessa parametrar.',
            )}
          </p>
        )}
        <p className="ds-small">
          {l(
            'The cross-tab below shows whether each group follows or crosses the existing title-based categories. These are descriptions of this run, not confirmed occupational boundaries.',
            'Korstabellen nedan visar om grupperna följer eller korsar de befintliga titelbaserade kategorierna. Detta beskriver den här körningen, inte fastställda yrkesgränser.',
          )}
        </p>
      </div>
      <details className="cluster-method">
        <summary>
          {l(
            'Semantic clusters × existing roles',
            'Semantiska kluster × befintliga roller',
          )}
        </summary>
        <div className="cluster-table-wrap">
          <table>
            <caption>
              {l(
                'Advertisement counts; all analysis years',
                'Antal annonser; alla analysår',
              )}
            </caption>
            <thead>
              <tr>
                <th>{l('Cluster', 'Kluster')}</th>
                {ROLES.map((role) => (
                  <th key={role}>{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.clusters.map((c) => (
                <tr key={c.cluster_id}>
                  <th>
                    {c.cluster_id} · {c.cluster_label}
                  </th>
                  {ROLES.map((role) => (
                    <td key={role}>
                      {c.role_distribution.find((r) => r.label === role)
                        ?.count ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

function ClusterDetails({ cluster: c }: { cluster: Cluster }) {
  return (
    <>
      <h3>
        {c.cluster_id} · {c.cluster_label}
      </h3>
      <p>
        {num(c.job_count)} {l('advertisements', 'annonser')} ·{' '}
        {pct(c.dataset_share)}
      </p>
      <h4>
        {l('Distinctive skill mentions', 'Särskiljande kompetensomnämnanden')}
      </h4>
      <div className="cluster-tags">
        {c.top_skills.map((s) => (
          <Tag key={s.skill}>{s.skill}</Tag>
        ))}
      </div>
      {c.skill_observation_share !== undefined && (
        <p className="ds-small">
          {l(
            `Technology mentions were detected in ${pct(c.skill_observation_share)} of this group's ads. Missing mentions can reflect vocabulary limits.`,
            `Teknikomnämnanden identifierades i ${pct(c.skill_observation_share)} av gruppens annonser. Saknade omnämnanden kan bero på ordlistans begränsningar.`,
          )}
        </p>
      )}
      <h4>{l('Existing labels', 'Befintliga etiketter')}</h4>
      <ul className="cluster-distribution">
        {c.role_distribution.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <strong>{pct(r.share)}</strong>
          </li>
        ))}
      </ul>
      <p>
        {l('Junior share', 'Juniorandel')}: {pct(c.junior_share)} ·{' '}
        {l('Senior share', 'Seniorandel')}: {pct(c.senior_share)}
      </p>
      <h4>{l('Most common titles', 'Vanligaste titlarna')}</h4>
      <ul>
        {c.top_titles.slice(0, 5).map((t) => (
          <li key={t.label}>
            {t.label} ({t.count})
          </li>
        ))}
      </ul>
      <h4>{l('Representative advertisements', 'Representativa annonser')}</h4>
      <ul>
        {c.representative_ads.map((ad) => (
          <li key={ad.id}>{ad.title}</li>
        ))}
      </ul>
      {c.top_employers?.length ? (
        <>
          <h4>{l('Employer concentration', 'Arbetsgivarkoncentration')}</h4>
          <ul className="cluster-distribution">
            {c.top_employers.map((employer) => (
              <li key={employer.label}>
                <span>{employer.label}</span>
                <strong>{pct(employer.share)}</strong>
              </li>
            ))}
          </ul>
          {c.top_employers[0].share > 0.5 && (
            <p className="ds-small">
              {l(
                'One employer supplies most of this group. Its language and templates may drive the cluster; the skill label should not be read as an independent market segment.',
                'En arbetsgivare står för större delen av gruppen. Dess språk och mallar kan driva klustret; kompetensetiketten bör inte läsas som ett självständigt marknadssegment.',
              )}
            </p>
          )}
        </>
      ) : null}
      <p className="ds-small">
        {l(
          'Labels are based on distinctive skills or frequent titles and need human review.',
          'Etiketter bygger på särskiljande kompetenser eller vanliga titlar och behöver mänsklig granskning.',
        )}
      </p>
    </>
  )
}
