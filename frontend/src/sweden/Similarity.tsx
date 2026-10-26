/**
 * C — The Invisible Sweden (#sweden-likhet). Municipalities by social similarity rather than
 * distance, from sweden/similarity/*.json (platform/publish/sweden/export_similarity.py, which
 * reuses the 2024 clustering of 280 municipalities on 12 indicators; k = 4 fails the
 * pre-registered stability bar, so its groups are a descriptive summary only). The Mantel tests
 * between social, job-ad and vote neighbours come from clusters/three-swedens.json.
 *
 * The scene is one SVG: every municipality is a dot that sits on its geographic centroid
 * ("Map") or at its first two principal components ("Similarity"), over SCB's boundaries.
 * Raw indicator values are shown as published; only positions are normalised. The ten
 * municipalities with a missing value are drawn without a group, and say which value is missing.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import ClusterScatter from '../clusters/ClusterScatter'
import RankBars from '../charts/RankBars'
import { setHashParams, type Route } from '../router'
import { productById } from './products'
import { MAP_SIZE, useMapLayout, useMapViewBox, type Geometry } from './map'
import {
  GROUP_HEX,
  MorphControl,
  SimilarityField,
  useMorph,
} from './SimilarityStage'
import SimilaritySensitivity, {
  type Sensitivity,
} from './SimilaritySensitivity'
import {
  EmptyState,
  ProductEmpty,
  Scene,
  SwedenResearchPage,
  ViewToggle,
  type Finding,
  type Method,
  type Reading,
} from './template'

type Feature = {
  id: string
  label_en: string
  label_sv: string
  unit: string
  reference_year: number
}
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
    county_null: {
      random_partner: number
      permutation: {
        rounds: number
        interval_95: [number, number]
        share_at_most_observed: number
      }
      random_pair_km_median: number
      geographic_nearest_km_median: number
    }
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
    copula_silhouette_95: number
    profiles: Profile[]
    names?: Record<string, [string, string]>
  }[]
  sensitivity: Sensitivity
  excluded: string[]
  provenance: {
    run: string
    sources: Record<string, string>
    boundaries: { url: string; licence: string; sha256: string }
    run_id: string | null
  }
}
/** The pre-registered Three Swedens tests (docs/sweden-three-spaces-preregistration.md). */
type Spaces = {
  diagnostics: {
    n: number
    tests: {
      pair: [string, string]
      partial_r: number
      partial_p_holm: number
      permutations: number
      note?: string
    }[]
  }
  grouping: {
    candidates: Record<string, { bootstrap_ari: { mean: number; p05: number } }>
  }
}
const BASE = 'sweden/similarity/'
// Categorical: the four groups of the finer split, never a magnitude.
const GROUP_COLOURS = GROUP_HEX
const fmt = (v: number | null | undefined, unit = '') =>
  v == null
    ? '–'
    : `${v.toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: v >= 1000 ? 0 : 2 })}${unit === '%' ? ' %' : ''}`

export default function Similarity({ route }: { route: Route }) {
  const product = productById('C')
  const [data, setData] = useState<Data | 'error' | null>(null)
  const [groups, setGroups] = useState<Groups | null>(null)
  const [geo, setGeo] = useState<Geometry | null>(null)
  const [spaces, setSpaces] = useState<Spaces | null>(null)
  useEffect(() => {
    fetchJson<Spaces>('clusters/three-swedens.json').then(setSpaces, () => {})
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
  const scene3d = route.params.get('scen') !== '2d'
  const toView = (v: 'map' | 'similarity') =>
    v !== view && set({ vy: v === 'similarity' ? 'likhet' : null })
  const morph = useMorph(view, toView)
  const [trails, setTrails] = useState(true)

  if (data === null)
    return (
      <p className="sw-section sw-note" role="status">
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
  const chance = s.county_null
  const same = s.analysed - s.nearest_in_other_county
  const ratio = (same / (s.analysed - chance.random_partner)).toFixed(1)
  const pct = (n: number) => Math.round((n / s.analysed) * 100)
  const carried = data.features.filter((f) => f.reference_year !== data.year)
  const featureName = (f: Feature) => l(f.label_en, f.label_sv)

  const findings: Finding[] = [
    {
      key: 'distance',
      statement: l(
        `For ${s.nearest_in_other_county} of ${s.analysed} municipalities the most similar municipality lies in another county: a median ${s.nearest_km_median} km away, against ${chance.geographic_nearest_km_median} km to the nearest on the map. Similarity still leans local: same-county matches are ${ratio} times chance.`,
        `För ${s.nearest_in_other_county} av ${s.analysed} kommuner ligger den mest lika kommunen i ett annat län: i median ${s.nearest_km_median} km bort, mot ${chance.geographic_nearest_km_median} km till den närmaste på kartan. Likheten lutar ändå lokalt: matchningar i samma län är ${ratio} gånger slumpen.`,
      ),
      values: (
        <ul>
          <li>
            {l('In another county', 'I ett annat län')}:{' '}
            {s.nearest_in_other_county} ({pct(s.nearest_in_other_county)} %) ·{' '}
            {l('random partner', 'slumpvis partner')}:{' '}
            {chance.random_partner.toFixed(1)} ({pct(chance.random_partner)} %)
            · {l('shuffled profiles, 95 %', 'omblandade profiler, 95 %')}:{' '}
            {chance.permutation.interval_95.join('–')}
          </li>
          <li>
            {l(
              'Median distance to the most similar municipality',
              'Medianavstånd till den mest lika kommunen',
            )}
            : {s.nearest_km_median} km · {l('random pair', 'slumpvist par')}:{' '}
            {chance.random_pair_km_median} km ·{' '}
            {l('nearest on the map', 'närmast på kartan')}:{' '}
            {chance.geographic_nearest_km_median} km
          </li>
          <li>
            {l('90th percentile', '90:e percentilen')}: {s.nearest_km_p90} km ·{' '}
            {l('over 300 km', 'över 300 km')}: {s.nearest_over_300km}
          </li>
        </ul>
      ),
      evidence: 'exploratory',
      source: l(
        `Own processing of data from Kolada and SCB, ${data.year}; 12 standardised indicators; straight-line distance between centroids; ${chance.permutation.rounds} shuffles of the profiles over the municipalities`,
        `Egen bearbetning av data från Kolada och SCB, ${data.year}; 12 standardiserade indikatorer; fågelvägen mellan mittpunkter; ${chance.permutation.rounds} omblandningar av profilerna över kommunerna`,
      ),
      onShow: () => set({ vy: 'likhet' }),
    },
  ]
  const spaceName = (id: string) =>
    ({
      social: l('social', 'sociala'),
      jobs: l('job-ad', 'platsannons'),
      votes: l('vote', 'röst'),
    })[id] ?? id
  const votes = spaces?.diagnostics.tests.find(
    (t) => t.pair.includes('social') && t.pair.includes('votes'),
  )
  if (spaces && votes)
    findings.push({
      key: 'spaces',
      statement: l(
        `Municipalities that are socially alike also vote alike: partial Mantel r ${votes.partial_r.toFixed(2)} with geography held fixed (Holm p ${votes.partial_p_holm}, ${spaces.diagnostics.n} municipalities), a pre-registered test.`,
        `Kommuner som är socialt lika röstar också lika: partiell Mantel-r ${votes.partial_r.toFixed(2)} med geografin hållen fast (Holm-p ${votes.partial_p_holm}, ${spaces.diagnostics.n} kommuner), ett förregistrerat test.`,
      ),
      values: (
        <ul>
          {spaces.diagnostics.tests.map((t) => (
            <li key={t.pair.join('-')}>
              {spaceName(t.pair[0])}–{spaceName(t.pair[1])}:{' '}
              {l('partial r', 'partiell r')} {t.partial_r.toFixed(2)} · Holm p{' '}
              {t.partial_p_holm}
            </li>
          ))}
          {votes.note && (
            <li>
              {l(
                'Riksdag turnout is one of the social indicators, so part of the social–vote r comes from that shared indicator.',
                'Valdeltagandet är en av de sociala indikatorerna, så en del av det sociala–röst-r kommer från den gemensamma indikatorn.',
              )}
            </li>
          )}
        </ul>
      ),
      evidence: 'exploratory',
      source: l(
        `Ten nearest neighbours in three spaces: 12 social indicators (2024), job ads by occupation field (2023–25), 2022 Riksdag votes; ${votes.permutations.toLocaleString('en-GB')} permutations, Holm over the three pairs`,
        `Tio närmaste grannar i tre rum: 12 sociala indikatorer (2024), platsannonser per yrkesområde (2023–25), riksdagsvalet 2022; ${votes.permutations.toLocaleString('sv-SE')} permutationer, Holm över de tre paren`,
      ),
    })
  const k4 = spaces?.grouping.candidates['4']?.bootstrap_ari
  const k2 = spaces?.grouping.candidates['2']?.bootstrap_ari
  const temporal = groups?.sensitivity.temporal?.years.map((y) => y.ari_k4)
  if (finer)
    findings.push({
      key: 'weak',
      contrary: true,
      statement: l(
        k4
          ? `No grouping passes the pre-registered stability check: for the four groups the bootstrap ARI’s 5th percentile is ${k4.p05.toFixed(2)}, below the bar of 0.6 (two groups: ${k2?.p05.toFixed(2)}). The colours are a descriptive summary, not a finding.`
          : `The groups are a weak structure: silhouette ${finer.silhouette.toFixed(2)}, against ${finer.copula_silhouette_95.toFixed(2)} for simulated data with the same correlations between indicators. The colours are a descriptive summary, not a finding.`,
        k4
          ? `Ingen gruppering klarar den förregistrerade stabilitetskontrollen: för de fyra grupperna är bootstrap-ARI:ns 5:e percentil ${k4.p05.toFixed(2).replace('.', ',')}, under gränsen 0,6 (två grupper: ${k2?.p05.toFixed(2).replace('.', ',')}). Färgerna är en beskrivande sammanfattning, inte ett resultat.`
          : `Grupperna är en svag struktur: silhuett ${finer.silhouette.toFixed(2)}, mot ${finer.copula_silhouette_95.toFixed(2)} för simulerade data med samma samband mellan indikatorerna. Färgerna är en beskrivande sammanfattning, inte ett resultat.`,
      ),
      values: (
        <ul>
          {k4 && (
            <li>
              {l('Bootstrap ARI, k = 4', 'Bootstrap-ARI, k = 4')}:{' '}
              {l('mean', 'medel')} {k4.mean.toFixed(2)} ({l('bar', 'gräns')}{' '}
              0.75), {l('5th percentile', '5:e percentil')} {k4.p05.toFixed(2)}{' '}
              ({l('bar', 'gräns')} 0.6)
            </li>
          )}
          {temporal?.length ? (
            <li>
              {l(
                'Refitted per year 2020–23, agreement with 2024 (ARI)',
                'Omskattad per år 2020–23, överensstämmelse med 2024 (ARI)',
              )}
              : {Math.min(...temporal).toFixed(2)}–
              {Math.max(...temporal).toFixed(2)}
            </li>
          ) : null}
          <li>
            {l('Silhouette', 'Silhuett')} {finer.silhouette.toFixed(2)} ·{' '}
            {l(
              'simulated data with the same correlations, 95 %',
              'simulerade data med samma samband, 95 %',
            )}{' '}
            {finer.copula_silhouette_95.toFixed(2)}
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
        `Gaussian copula null, ${groups?.sensitivity.copula_null.rounds} draws`,
        `Gaussisk copula-noll, ${groups?.sensitivity.copula_null.rounds} dragningar`,
      ),
    })

  const scene = (
    <Scene
      product={product}
      line={
        view === 'map'
          ? l(
              'Every municipality on its map position, coloured by a descriptive four-group summary. Switch to Similarity to move each to its place in indicator space.',
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
            <b>
              {l(
                'Similarity groups (k = 4), descriptive summary',
                'Likhetsgrupper (k = 4), beskrivande sammanfattning',
              )}
            </b>
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
            <p className="sw-note">
              {l(
                'Height: population, log scale. Distance in the lifted space means similarity, not geography.',
                'Höjd: folkmängd, logaritmisk skala. Avstånd i det lyfta rummet betyder likhet, inte geografi.',
              )}
            </p>
            <ViewToggle
              view={scene3d ? '3d' : 'matrix'}
              onChange={(v) => set({ scen: v === '3d' ? null : '2d' })}
            />
          </>
        )
      }
      control={
        <div className="sw-controls" role="group" aria-label={l('View', 'Vy')}>
          {scene3d ? (
            <MorphControl
              t={morph.t}
              setT={morph.setT}
              go={morph.go}
              onEnd={toView}
              trails={trails}
              setTrails={setTrails}
            />
          ) : (
            <>
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
            </>
          )}
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
      {geo && scene3d ? (
        <SimilarityField
          geo={geo}
          municipalities={data.municipalities}
          t={morph.t}
          trails={trails}
          selected={selected}
          onPick={(c) => set({ kommun: c })}
          fallback={
            <MapScene
              data={data}
              geo={geo}
              view={view}
              selected={selected?.code ?? null}
              onPick={(c) => set({ kommun: c })}
            />
          }
        />
      ) : geo ? (
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
            {featureName(f)} ({f.unit}, {f.reference_year})
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
            `Standardise the 12 indicators as Kolada reports them for ${data.year}.`,
            `Standardisera de 12 indikatorerna som Kolada redovisar dem för ${data.year}.`,
          )}
          {carried.map((f) =>
            l(
              ` ${f.label_en} is the ${f.reference_year} election, which Kolada repeats in every year until the next election.`,
              ` ${f.label_sv} är valet ${f.reference_year}, som Kolada upprepar varje år fram till nästa val.`,
            ),
          )}
        </li>
        <li>{groups?.method}</li>
        <li>
          {l('Choice of k', 'Val av k')}: {groups?.criterion}.{' '}
          {l(
            'The page colours by the finer split (k = 4) as a description only: neither k = 2 nor k = 4 meets the pre-registered bar (mean bootstrap ARI at least 0.75, 5th percentile at least 0.6).',
            'Sidan färgar efter den finare indelningen (k = 4) enbart som beskrivning: varken k = 2 eller k = 4 klarar den förregistrerade gränsen (medel-ARI minst 0,75, 5:e percentilen minst 0,6).',
          )}
        </li>
        <li>
          {l(
            'Nearest neighbours: Euclidean distance in the 12 standardised indicators; distance on the map is straight-line between centroids, not travel.',
            'Närmaste grannar: euklidiskt avstånd i de 12 standardiserade indikatorerna; avstånd på kartan är fågelvägen mellan mittpunkter, inte resväg.',
          )}
        </li>
        <li>
          {l(
            'Null for the groups: data drawn with the observed rank correlation between the indicators and each indicator’s own values (a Gaussian copula), then clustered the same way. Shuffling each column apart removes the correlation and gives a lower bar.',
            'Noll för grupperna: data dragna med den observerade rangkorrelationen mellan indikatorerna och varje indikators egna värden (en gaussisk copula), sedan klustrade på samma sätt. Att blanda varje kolumn för sig tar bort sambandet och ger en lägre ribba.',
          )}
        </li>
      </ol>
    ),
    results: (
      <>
        <p>
          {l(
            'The findings above and the tables under Explore. How much depends on the definition:',
            'Resultaten ovan och tabellerna under Utforska. Hur mycket som beror på definitionen:',
          )}
        </p>
        {groups && <SimilaritySensitivity s={groups.sensitivity} />}
      </>
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
            `One reporting year (${data.year}${carried.map((f) => `; ${f.label_en.toLowerCase()} ${f.reference_year}`).join('')}). Profiles of municipalities, not of their residents: nothing here describes a person.`,
            `Ett redovisningsår (${data.year}${carried.map((f) => `; ${f.label_sv.toLowerCase()} ${f.reference_year}`).join('')}). Profiler av kommuner, inte av deras invånare: inget här beskriver en person.`,
          )}
        </li>
        <li>
          {l(
            'The groups are weak (silhouette close to the reference with the same correlations); treat them as a summary, not as types. Neighbours depend on the definition: see the first table under Observed results.',
            'Grupperna är svaga (silhuett nära referensen med samma samband); se dem som en sammanfattning, inte som typer. Grannarna beror på definitionen: se den första tabellen under Observerade resultat.',
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

  const metro = groups?.sensitivity.centre_periphery.variants
  const skr = groups?.sensitivity.skr_typology
  const range = (v: { ci95: [number, number] }) =>
    `${v.ci95[0].toFixed(2)} ${l('to', 'till')} ${v.ci95[1].toFixed(2)}`
  const share = (v: number) => `${Math.round(v * 100)} %`
  const readings: Reading[] = [
    {
      theory: l('Centre and periphery', 'Centrum och periferi'),
      expects: l(
        'Social conditions follow distance to the big cities, so similar municipalities are close to each other.',
        'Sociala förhållanden följer avståndet till storstäderna, så lika kommuner ligger nära varandra.',
      ),
      // Supports only when the rank correlation's interval excludes zero, in the same
      // direction, with and without population among the indicators.
      verdict:
        metro &&
        [metro.all_12, metro.without_log_population].every(
          (v) => v.ci95[1] < 0,
        ) !==
          [metro.all_12, metro.without_log_population].every(
            (v) => v.ci95[0] > 0,
          )
          ? 'supports'
          : 'undetermined',
      why: metro
        ? l(
            `Rank correlation between the first principal component (signed to rise with income) and distance to the nearest of Stockholm, Göteborg and Malmö: ρ = ${metro.all_12.rho.toFixed(2)} (95 % interval ${range(metro.all_12)}, resampling counties), and ${metro.without_log_population.rho.toFixed(2)} (${range(metro.without_log_population)}) without population. The nearest social neighbour shares the county for ${same} of ${s.analysed}, against ${(s.analysed - chance.random_partner).toFixed(1)} by chance.`,
            `Rangkorrelation mellan första principalkomponenten (med tecken så att den stiger med inkomsten) och avståndet till närmaste av Stockholm, Göteborg och Malmö: ρ = ${metro.all_12.rho.toFixed(2)} (95 %-intervall ${range(metro.all_12)}, med omdragning av län), och ${metro.without_log_population.rho.toFixed(2)} (${range(metro.without_log_population)}) utan folkmängd. Den närmaste sociala grannen ligger i samma län för ${same} av ${s.analysed}, mot ${(s.analysed - chance.random_partner).toFixed(1)} av slump.`,
          )
        : '',
      limits: l(
        `Straight-line distance between centroids, not travel time. The component is one summary of 12 indicators, and the correlation says nothing about cause. ${pct(s.nearest_in_other_county)} % have their nearest social neighbour in another county.`,
        `Fågelvägen mellan mittpunkter, inte restid. Komponenten är en sammanfattning av 12 indikatorer, och sambandet säger inget om orsak. ${pct(s.nearest_in_other_county)} % har sin närmaste sociala granne i ett annat län.`,
      ),
    },
    {
      theory: l('Official typologies (SKR)', 'Officiella typologier (SKR)'),
      expects: l(
        'Size and commuting, as SKR groups them, capture most of what separates municipalities.',
        'Storlek och pendling, som SKR grupperar dem, fångar det mesta som skiljer kommuner åt.',
      ),
      // "Most" is read as more than half of the variance, decided by the whole interval.
      verdict: !skr
        ? 'undetermined'
        : skr.ci95[0] > 0.5
          ? 'supports'
          : skr.ci95[1] < 0.5
            ? 'challenges'
            : 'undetermined',
      why: skr
        ? l(
            `SKR’s nine types hold ${share(skr.share)} of the variance of the ${skr.indicators.length} indicators they are not built from (95 % interval ${share(skr.ci95[0])}–${share(skr.ci95[1])}; ${share(skr.null_95)} for shuffled types). Agreement between the four groups and SKR’s types is AMI ${finer?.ami_skr_groups.toFixed(2)}.`,
            `SKR:s nio typer rymmer ${share(skr.share)} av variansen i de ${skr.indicators.length} indikatorer de inte bygger på (95 %-intervall ${share(skr.ci95[0])}–${share(skr.ci95[1])}; ${share(skr.null_95)} för omblandade typer). Överensstämmelsen mellan de fyra grupperna och SKR:s typer är AMI ${finer?.ami_skr_groups.toFixed(2)}.`,
          )
        : '',
      limits: l(
        '“Most” is read as more than half. Population and commuting are left out of the test because SKR’s types are built from them.',
        '”Det mesta” läses som mer än hälften. Folkmängd och pendling lämnas utanför prövningen eftersom SKR:s typer bygger på dem.',
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
  const shared = useMapLayout(geo)!
  const viewBox = useMapViewBox()
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
      viewBox={viewBox}
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
          <div className="sw-table-wrap" tabIndex={0}>
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
          <div className="sw-table-wrap" tabIndex={0}>
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
