/**
 * C — The Invisible Sweden (#sweden-likhet). Municipalities by social similarity rather than
 * distance, from sweden/similarity/*.json (platform/publish/sweden/export_similarity.py, which
 * reuses the validated 2024 clustering of 280 municipalities on 12 indicators).
 *
 * The scene is one SVG: every municipality is a dot that sits on its geographic centroid
 * ("Map") or at its first two principal components ("Similarity"), over SCB's boundaries.
 * Raw indicator values are shown as published; only positions are normalised. The ten
 * municipalities with a missing value are drawn without a group, and say which value is missing.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../welfare/data'
import ClusterScatter from '../clusters/ClusterScatter'
import RankBars from '../charts/RankBars'
import { setHashParams, type Route } from '../router'
import { productById } from './products'
import { MAP_SIZE, useMapLayout, type Geometry } from './map'
import {
  EmptyState,
  ProductEmpty,
  Scene,
  SwedenResearchPage,
  type Finding,
  type Method,
  type Reading,
} from './template'

type Feature = { id: string; label_en: string; label_sv: string; unit: string }
type Municipality = {
  code: string
  name: string
  county: string
  population: number | null
  values: Record<string, number | null>
  group?: number
  finer?: number
  skr_group?: string
  pc?: [number, number]
  neighbours?: [string, number, number][]
  missing?: string[]
}
type Data = {
  year: number
  features: Feature[]
  summary: {
    analysed: number
    total: number
    nearest_in_other_county: number
    nearest_km_median: number
    nearest_km_p90: number
    nearest_over_300km: number
  }
  municipalities: Municipality[]
}
type Profile = {
  group: number
  municipalities: number
  population: number
  means: Record<string, number>
  standardised_means: Record<string, number>
}
type Groups = {
  method: string
  criterion: string
  explained_variance: number[]
  permutation: {
    rounds: number
    percentile_95: number
    share_at_least_actual: number
  }
  splits: {
    k: number
    role: string
    silhouette: number
    bootstrap_ari: number
    ami_skr_groups: number
    null_silhouette_95: number
    profiles: Profile[]
    names?: Record<string, [string, string]>
  }[]
  excluded: string[]
  provenance: {
    run: string
    sources: Record<string, string>
    boundaries: { url: string; licence: string; sha256: string }
    run_id: string | null
  }
}
const BASE = 'sweden/similarity/'
// Categorical: the four groups of the finer split, never a magnitude.
const GROUP_COLOURS = [
  'var(--sw-accent)',
  'var(--sw-div-pos)',
  'var(--sw-div-neg)',
  'var(--series-4)',
]
const fmt = (v: number | null | undefined, unit = '') =>
  v == null
    ? '–'
    : `${v.toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: v >= 1000 ? 0 : 2 })}${unit === '%' ? ' %' : ''}`

export default function Similarity({ route }: { route: Route }) {
  const product = productById('C')
  const [data, setData] = useState<Data | 'error' | null>(null)
  const [groups, setGroups] = useState<Groups | null>(null)
  const [geo, setGeo] = useState<Geometry | null>(null)
  useEffect(() => {
    fetchJson<Data>(BASE + 'municipalities.json').then(setData, () =>
      setData('error'),
    )
    fetchJson<Groups>(BASE + 'groups.json').then(setGroups, () => {})
    fetchJson<Geometry>(BASE + 'geometry.json').then(setGeo, () => {})
  }, [])
  const view = route.params.get('vy') === 'likhet' ? 'similarity' : 'map'
  const code = route.params.get('kommun')
  const set = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(route.params)
    for (const [k, v] of Object.entries(changes))
      v == null || v === '' ? params.delete(k) : params.set(k, v)
    setHashParams(route.path, params, true)
  }

  if (data === null)
    return (
      <p className="sweden sw-note" role="status">
        {l('Loading…', 'Laddar…')}
      </p>
    )
  if (data === 'error')
    return (
      <ProductEmpty product={product}>
        <EmptyState
          state="validation"
          shows={l(
            'Municipalities by social similarity.',
            'Kommuner efter social likhet.',
          )}
          needs={l(
            'sweden/similarity/municipalities.json from the sweden pipeline subject.',
            'sweden/similarity/municipalities.json från pipeline-subjektet sweden.',
          )}
        />
      </ProductEmpty>
    )

  const finer = groups?.splits.find((s) => s.role === 'finer split')
  const groupName = (g: number | undefined) =>
    g == null || !finer?.names
      ? l('Not in the analysis', 'Inte med i analysen')
      : l(...finer.names[String(g)])
  const byCode = new Map(data.municipalities.map((m) => [m.code, m]))
  const selected = (code && byCode.get(code)) || null
  const s = data.summary
  const featureName = (f: Feature) => l(f.label_en, f.label_sv)

  const spans = finer
    ? finer.profiles.map((p) => ({
        group: p.group,
        counties: new Set(
          data.municipalities
            .filter((m) => m.finer === p.group)
            .map((m) => m.county),
        ).size,
        n: p.municipalities,
      }))
    : []
  const widest = [...spans].sort((a, b) => b.counties - a.counties)[0]

  const findings: Finding[] = [
    {
      key: 'distance',
      statement: l(
        `For ${s.nearest_in_other_county} of ${s.analysed} municipalities, the socially most similar municipality lies in another county.`,
        `För ${s.nearest_in_other_county} av ${s.analysed} kommuner ligger den socialt mest lika kommunen i ett annat län.`,
      ),
      values: (
        <ul>
          <li>
            {l(
              'Median distance to the most similar municipality',
              'Medianavstånd till den mest lika kommunen',
            )}
            : {s.nearest_km_median} km
          </li>
          <li>
            {l('90th percentile', '90:e percentilen')}: {s.nearest_km_p90} km ·{' '}
            {l('over 300 km', 'över 300 km')}: {s.nearest_over_300km}
          </li>
        </ul>
      ),
      evidence: 'exploratory',
      source: l(
        `Kolada and SCB, ${data.year}; 12 standardised indicators; straight-line distance between centroids`,
        `Kolada och SCB, ${data.year}; 12 standardiserade indikatorer; fågelvägen mellan mittpunkter`,
      ),
      onShow: () => set({ vy: 'likhet' }),
    },
  ]
  if (widest && finer)
    findings.push({
      key: 'spread',
      statement: l(
        `“${groupName(widest.group)}” spans ${widest.counties} of 21 counties.`,
        `”${groupName(widest.group)}” finns i ${widest.counties} av 21 län.`,
      ),
      values: (
        <ul>
          {spans.map((g) => (
            <li key={g.group}>
              {groupName(g.group)}: {g.n} {l('municipalities', 'kommuner')},{' '}
              {g.counties} {l('counties', 'län')}
            </li>
          ))}
        </ul>
      ),
      evidence: 'exploratory',
      source: l(
        'K-means, k = 4 (finer split)',
        'K-means, k = 4 (finare indelning)',
      ),
    })
  if (finer)
    findings.push({
      key: 'weak',
      contrary: true,
      statement: l(
        `The groups are a weak structure: silhouette ${finer.silhouette.toFixed(2)}, against ${finer.null_silhouette_95.toFixed(2)} for shuffled data, and they only partly follow SKR’s official municipality types.`,
        `Grupperna är en svag struktur: silhuett ${finer.silhouette.toFixed(2)}, mot ${finer.null_silhouette_95.toFixed(2)} för omblandade data, och de följer bara delvis SKR:s officiella kommuntyper.`,
      ),
      values: (
        <ul>
          <li>
            {l('Bootstrap ARI', 'Bootstrap-ARI')}:{' '}
            {finer.bootstrap_ari.toFixed(2)} ({l('bar', 'gräns')} 0.75)
          </li>
          <li>
            {l(
              'Agreement with SKR groups (AMI)',
              'Överensstämmelse med SKR-grupper (AMI)',
            )}
            : {finer.ami_skr_groups.toFixed(2)}
          </li>
        </ul>
      ),
      evidence: 'exploratory',
      source: l(
        'Permutation null, 200 rounds',
        'Permutationsnoll, 200 omgångar',
      ),
    })

  const scene = (
    <Scene
      product={product}
      line={
        view === 'map'
          ? l(
              'Every municipality on its map position, coloured by its similarity group. Switch to Similarity to move each to its place in indicator space.',
              'Varje kommun på sin plats på kartan, färgad efter sin likhetsgrupp. Byt till Likhet för att flytta varje kommun till sin plats i indikatorrummet.',
            )
          : l(
              'Each municipality placed by the first two principal components of 12 indicators: near means similar, wherever it lies.',
              'Varje kommun placerad efter de två första principalkomponenterna av 12 indikatorer: nära betyder lika, var den än ligger.',
            )
      }
      legend={
        finer && (
          <>
            <b>{l('Similarity groups (k = 4)', 'Likhetsgrupper (k = 4)')}</b>
            <ul className="sw-legend-list">
              {finer.profiles.map((p) => (
                <li key={p.group}>
                  <i
                    style={{ background: GROUP_COLOURS[p.group] }}
                    aria-hidden="true"
                  />
                  {groupName(p.group)} ({p.municipalities})
                </li>
              ))}
              <li>
                <i className="sw-legend-missing" aria-hidden="true" />
                {l('Not in the analysis', 'Inte med i analysen')} (
                {s.total - s.analysed})
              </li>
            </ul>
          </>
        )
      }
      control={
        <div className="sw-controls" role="group" aria-label={l('View', 'Vy')}>
          <button
            type="button"
            className="sw-toggle"
            aria-pressed={view === 'map'}
            onClick={() => set({ vy: null })}
          >
            {l('Map', 'Karta')}
          </button>
          <button
            type="button"
            className="sw-toggle"
            aria-pressed={view === 'similarity'}
            onClick={() => set({ vy: 'likhet' })}
          >
            {l('Similarity', 'Likhet')}
          </button>
          <label>
            {l('Municipality', 'Kommun')}
            <select
              value={code ?? ''}
              onChange={(e) => set({ kommun: e.target.value || null })}
            >
              <option value="">{l('Choose…', 'Välj…')}</option>
              {[...data.municipalities]
                .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
                .map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      }
      info={
        selected ? (
          <Info
            m={selected}
            data={data}
            byCode={byCode}
            groupName={groupName}
          />
        ) : (
          <p className="sw-note">
            {l(
              'Choose a municipality to see its values and nearest neighbours.',
              'Välj en kommun för att se dess värden och närmaste grannar.',
            )}
          </p>
        )
      }
    >
      {geo ? (
        <MapScene
          data={data}
          geo={geo}
          view={view}
          selected={selected?.code ?? null}
          onPick={(c) => set({ kommun: c })}
        />
      ) : (
        <p className="sw-note" role="status">
          {l('Loading…', 'Laddar…')}
        </p>
      )}
    </Scene>
  )

  const method: Method = {
    question: <p>{l(product.question.en, product.question.sv)}</p>,
    theory: (
      <p>
        {l(
          'Regional policy groups municipalities by size and commuting (SKR’s municipality types). The question here is whether social conditions draw a different map: places far apart that share a profile, and neighbours that do not.',
          'Regionalpolitiken grupperar kommuner efter storlek och pendling (SKR:s kommungrupper). Frågan här är om sociala förhållanden ritar en annan karta: platser långt ifrån varandra med samma profil, och grannar som inte delar den.',
        )}
      </p>
    ),
    data: (
      <ul>
        {data.features.map((f) => (
          <li key={f.id}>
            {featureName(f)} ({f.unit})
          </li>
        ))}
        <li>
          {l('Boundaries', 'Gränser')}:{' '}
          <a href={groups?.provenance.boundaries.url}>
            SCB, {l('digital boundaries', 'digitala gränser')}
          </a>{' '}
          — {groups?.provenance.boundaries.licence}
        </li>
      </ul>
    ),
    method: (
      <ol>
        <li>
          {l(
            'Standardise the 12 indicators for 2024.',
            'Standardisera de 12 indikatorerna för 2024.',
          )}
        </li>
        <li>{groups?.method}</li>
        <li>
          {l('Choice of k', 'Val av k')}: {groups?.criterion}.{' '}
          {l(
            'The page shows the finer split (k = 4), which passes the same stability bar.',
            'Sidan visar den finare indelningen (k = 4), som klarar samma stabilitetsgräns.',
          )}
        </li>
        <li>
          {l(
            'Nearest neighbours: Euclidean distance in the 12 standardised indicators; distance on the map is straight-line between centroids, not travel.',
            'Närmaste grannar: euklidiskt avstånd i de 12 standardiserade indikatorerna; avstånd på kartan är fågelvägen mellan mittpunkter, inte resväg.',
          )}
        </li>
      </ol>
    ),
    results: (
      <p>
        {l(
          'The findings above and the tables under Explore.',
          'Resultaten ovan och tabellerna under Utforska.',
        )}
      </p>
    ),
    alternatives: (
      <ul>
        <li>
          {l(
            'Population size dominates several indicators; the log of population is one of the twelve and pulls cities together.',
            'Folkmängden styr flera indikatorer; logaritmen av folkmängden är en av de tolv och drar ihop städerna.',
          )}
        </li>
        <li>
          {l(
            'Equal weight per indicator after standardisation is a choice; other weights give other neighbours.',
            'Lika vikt per indikator efter standardisering är ett val; andra vikter ger andra grannar.',
          )}
        </li>
      </ul>
    ),
    limitations: (
      <ul>
        <li>
          {l(
            `${s.total - s.analysed} of ${s.total} municipalities are not in the analysis because one indicator is missing: ${groups?.excluded.join(', ')}.`,
            `${s.total - s.analysed} av ${s.total} kommuner ingår inte eftersom en indikator saknas: ${groups?.excluded.join(', ')}.`,
          )}
        </li>
        <li>
          {l(
            'One year (2024). Profiles of municipalities, not of their residents: nothing here describes a person.',
            'Ett år (2024). Profiler av kommuner, inte av deras invånare: inget här beskriver en person.',
          )}
        </li>
        <li>
          {l(
            'The groups are weak (silhouette close to the shuffled-data reference); treat them as a summary, not as types.',
            'Grupperna är svaga (silhuett nära referensen för omblandade data); se dem som en sammanfattning, inte som typer.',
          )}
        </li>
        <li>
          {l(
            'SCB’s boundaries are simplified for thematic maps.',
            'SCB:s gränser är förenklade för tematiska kartor.',
          )}
        </li>
      </ul>
    ),
    references: (
      <ul>
        <li>
          Tibshirani, R., Walther, G., Hastie, T. (2001). Estimating the number
          of clusters via the gap statistic. JRSS B 63(2).
        </li>
        <li>SKR (2023). Kommungruppsindelning 2023.</li>
      </ul>
    ),
    reproducibility: (
      <dl>
        <dt>{l('Clustering run', 'Klustringskörning')}</dt>
        <dd className="sw-mono">{groups?.provenance.run}</dd>
        {groups &&
          Object.entries(groups.provenance.sources).map(([path, hash]) => (
            <div key={path} style={{ display: 'contents' }}>
              <dt className="sw-mono">{path.split('/').pop()}</dt>
              <dd className="sw-mono">{hash.slice(0, 16)}</dd>
            </div>
          ))}
        <dt>{l('Reproduce', 'Reproducera')}</dt>
        <dd className="sw-mono">
          python -m ml.research.regions --config
          configs/cluster_lab/public_regions.yaml
        </dd>
        <dd className="sw-mono">
          python platform/publish/sweden/export_similarity.py
        </dd>
      </dl>
    ),
  }

  const readings: Reading[] = [
    {
      theory: l('Centre and periphery', 'Centrum och periferi'),
      expects: l(
        'Social conditions follow distance to the big cities, so similar municipalities are close to each other.',
        'Sociala förhållanden följer avståndet till storstäderna, så lika kommuner ligger nära varandra.',
      ),
      verdict:
        s.nearest_in_other_county / s.analysed > 0.5
          ? 'challenges'
          : 'supports',
      why: l(
        `${Math.round((s.nearest_in_other_county / s.analysed) * 100)} % have their nearest social neighbour in another county; median ${s.nearest_km_median} km.`,
        `${Math.round((s.nearest_in_other_county / s.analysed) * 100)} % har sin närmaste sociala granne i ett annat län; median ${s.nearest_km_median} km.`,
      ),
      limits: l(
        'Counties are administrative units; a neighbour across a county line can still be close.',
        'Län är administrativa enheter; en granne över länsgränsen kan ändå ligga nära.',
      ),
    },
    {
      theory: l('Official typologies (SKR)', 'Officiella typologier (SKR)'),
      expects: l(
        'Size and commuting, as SKR groups them, capture most of what separates municipalities.',
        'Storlek och pendling, som SKR grupperar dem, fångar det mesta som skiljer kommuner åt.',
      ),
      verdict:
        finer && finer.ami_skr_groups < 0.5 ? 'challenges' : 'undetermined',
      why: l(
        `Agreement between the groups and SKR’s types is AMI ${finer?.ami_skr_groups.toFixed(2)} (1 is identical, 0 is chance).`,
        `Överensstämmelsen mellan grupperna och SKR:s typer är AMI ${finer?.ami_skr_groups.toFixed(2)} (1 är identisk, 0 är slump).`,
      ),
      limits: l(
        'Both use partly the same inputs (population, commuting).',
        'Båda använder delvis samma indata (folkmängd, pendling).',
      ),
    },
  ]

  const explore = (
    <Explore
      data={data}
      groups={groups}
      selected={selected}
      byCode={byCode}
      groupName={groupName}
      onPick={(c) => set({ kommun: c })}
    />
  )

  return (
    <SwedenResearchPage
      product={product}
      scene={scene}
      findings={findings}
      explore={explore}
      exploreSummary={l(
        'The similarity map as a scatter, group profiles, and a municipality compared with its nearest neighbours.',
        'Likhetskartan som spridningsdiagram, gruppprofiler och en kommun jämförd med sina närmaste grannar.',
      )}
      method={method}
      readings={readings}
    />
  )
}

function Info({
  m,
  data,
  byCode,
  groupName,
}: {
  m: Municipality
  data: Data
  byCode: Map<string, Municipality>
  groupName: (g: number | undefined) => string
}) {
  return (
    <>
      <b>
        {m.name} <span className="sw-mono">{m.code}</span>
      </b>
      <p className="sw-note">
        {m.county} · {groupName(m.finer)}
      </p>
      {m.missing ? (
        <p>
          {l('Missing', 'Saknas')}:{' '}
          {m.missing
            .map((f) => data.features.find((x) => x.id === f))
            .map((f) => (f ? l(f.label_en, f.label_sv) : ''))
            .join(', ')}
        </p>
      ) : (
        <ol className="sw-neighbours">
          {m.neighbours!.map(([c, d, km]) => (
            <li key={c}>
              {byCode.get(c)?.name}{' '}
              <span className="sw-mono">
                {d.toFixed(2)} · {km} km
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

function MapScene({
  data,
  geo,
  view,
  selected,
  onPick,
}: {
  data: Data
  geo: Geometry
  view: 'map' | 'similarity'
  selected: string | null
  onPick: (code: string) => void
}) {
  const W = MAP_SIZE
  const H = MAP_SIZE
  const shared = useMapLayout(geo)!
  const layout = useMemo(() => {
    const pcs = data.municipalities.filter((m) => m.pc).map((m) => m.pc!)
    const [p0, p1] = [
      Math.min(...pcs.map((p) => p[0])),
      Math.max(...pcs.map((p) => p[0])),
    ]
    const [q0, q1] = [
      Math.min(...pcs.map((p) => p[1])),
      Math.max(...pcs.map((p) => p[1])),
    ]
    const pcPos = (pc: [number, number]): [number, number] => [
      MAP_SIZE * 0.42 + ((pc[0] - p0) / (p1 - p0)) * MAP_SIZE * 0.54,
      MAP_SIZE * 0.12 + (1 - (pc[1] - q0) / (q1 - q0)) * MAP_SIZE * 0.76,
    ]
    return { ...shared, pcPos }
  }, [shared, data])
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="sw-map"
      role="group"
      aria-label={l('Municipalities of Sweden', 'Sveriges kommuner')}
      data-view={view}
    >
      <g className="sw-map-land" aria-hidden="true">
        {data.municipalities.map((m) => (
          <path
            key={m.code}
            d={layout.paths.get(m.code)}
            style={{
              fill: m.finer == null ? undefined : GROUP_COLOURS[m.finer],
            }}
            data-missing={m.finer == null || undefined}
          />
        ))}
      </g>
      <g className="sw-map-dots">
        {data.municipalities.map((m) => {
          const [x, y] =
            view === 'similarity' && m.pc
              ? layout.pcPos(m.pc)
              : (layout.centroid.get(m.code) ?? [0, 0])
          return (
            <circle
              key={m.code}
              r={m.code === selected ? 9 : 5}
              style={{
                transform: `translate(${x}px, ${y}px)`,
                fill: m.finer == null ? 'var(--sw-bg)' : GROUP_COLOURS[m.finer],
              }}
              data-selected={m.code === selected || undefined}
              data-missing={m.finer == null || undefined}
              tabIndex={0}
              role="button"
              aria-label={`${m.name}${m.finer == null ? `, ${l('not in the analysis', 'inte med i analysen')}` : ''}`}
              onClick={() => onPick(m.code)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPick(m.code)
                }
              }}
            />
          )
        })}
      </g>
    </svg>
  )
}

function Explore({
  data,
  groups,
  selected,
  byCode,
  groupName,
  onPick,
}: {
  data: Data
  groups: Groups | null
  selected: Municipality | null
  byCode: Map<string, Municipality>
  groupName: (g: number | undefined) => string
  onPick: (code: string) => void
}) {
  const finer = groups?.splits.find((s) => s.role === 'finer split')
  const analysed = data.municipalities.filter((m) => m.pc)
  const compare = selected?.neighbours
    ? [selected, ...selected.neighbours.map(([c]) => byCode.get(c)!)]
    : []
  const far = [...analysed]
    .sort((a, b) => b.neighbours![0][2] - a.neighbours![0][2])
    .slice(0, 10)
  return (
    <>
      <h3>
        {l(
          'The similarity space as a scatter',
          'Likhetsrummet som spridningsdiagram',
        )}
      </h3>
      <ClusterScatter
        height={460}
        label={l(
          'Municipalities by the first two principal components',
          'Kommuner efter de två första principalkomponenterna',
        )}
        points={analysed.map((m) => ({
          x: m.pc![0],
          y: m.pc![1],
          c: m.finer!,
          label: m.name,
        }))}
        name={(c) => groupName(c)}
        marker={
          selected?.pc
            ? { x: selected.pc[0], y: selected.pc[1], label: selected.name }
            : undefined
        }
      />

      {compare.length > 0 && (
        <>
          <h3>
            {l(
              `${selected!.name} and its five nearest municipalities`,
              `${selected!.name} och dess fem närmaste kommuner`,
            )}
          </h3>
          <div className="sw-table-wrap">
            <table className="sw-table">
              <caption className="visually-hidden">
                {l('Indicator values', 'Indikatorvärden')}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{l('Indicator', 'Indikator')}</th>
                  {compare.map((m) => (
                    <th key={m.code} scope="col" className="sw-n">
                      {m.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{l('County', 'Län')}</th>
                  {compare.map((m) => (
                    <td key={m.code} className="sw-n">
                      {m.county.replace(' län', '')}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{l('Distance (km)', 'Avstånd (km)')}</th>
                  <td className="sw-n">–</td>
                  {selected!.neighbours!.map(([c, , km]) => (
                    <td key={c} className="sw-n">
                      {km}
                    </td>
                  ))}
                </tr>
                {data.features.map((f) => (
                  <tr key={f.id}>
                    <th scope="row">
                      {l(f.label_en, f.label_sv)}{' '}
                      <span className="sw-note">({f.unit})</span>
                    </th>
                    {compare.map((m) => (
                      <td key={m.code} className="sw-n">
                        {fmt(m.values[f.id], f.unit)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3>
        {l(
          'Farthest from their most similar municipality',
          'Längst från sin mest lika kommun',
        )}
      </h3>
      <RankBars
        label={l(
          'Kilometres to the most similar municipality',
          'Kilometer till den mest lika kommunen',
        )}
        format={(v) => `${v} km`}
        onPick={onPick}
        picked={selected?.code ?? null}
        rows={far.map((m) => ({
          key: m.code,
          label: m.name,
          value: m.neighbours![0][2],
          note: `→ ${byCode.get(m.neighbours![0][0])?.name}`,
        }))}
      />

      {finer && (
        <>
          <h3>
            {l('Group profiles, mean values', 'Gruppprofiler, medelvärden')}
          </h3>
          <div className="sw-table-wrap">
            <table className="sw-table">
              <caption className="visually-hidden">
                {l('Group profiles', 'Gruppprofiler')}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{l('Indicator', 'Indikator')}</th>
                  {finer.profiles.map((p) => (
                    <th key={p.group} scope="col" className="sw-n">
                      {groupName(p.group)} ({p.municipalities})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.features.map((f) => (
                  <tr key={f.id}>
                    <th scope="row">{l(f.label_en, f.label_sv)}</th>
                    {finer.profiles.map((p) => (
                      <td key={p.group} className="sw-n">
                        {fmt(p.means[f.id], f.unit)}{' '}
                        <span className="sw-note">
                          ({p.standardised_means[f.id] >= 0 ? '+' : ''}
                          {p.standardised_means[f.id].toFixed(1)} sd)
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
