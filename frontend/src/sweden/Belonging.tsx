/**
 * D — The Infrastructure of Belonging (#sweden-tillhorighet). Public libraries as places to take
 * part without buying anything, per municipality and year, from KB's official library statistics
 * (sweden/belonging/*.json, platform/publish/sweden/export_belonging.py), drawn on C's map.
 *
 * Availability (staffed service points, land area per service point) and participation (visits,
 * public activities, active borrowers) are separate measures and never combined. Distances are
 * not computed: the map shows where libraries are, not how long it takes to reach one.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import MultiLineChart from '../charts/MultiLineChart'
import RankBars from '../charts/RankBars'
import { setHashParams, type Route } from '../router'
import { productById } from './products'
import { useMapLayout, useMapViewBox, type Geometry } from './map'
import { BelongingField } from './BelongingStage'
import {
  EmptyState,
  ProductEmpty,
  Scene,
  ViewToggle,
  SwedenResearchPage,
  type Finding,
  type Method,
  type Reading,
} from './template'

type Row = {
  code: string
  year: number
  service_points: number | null
  visits: number | null
  activities: number | null
  active_borrowers: number | null
  population: number | null
  service_points_rate?: number | null
  visits_rate?: number | null
  activities_rate?: number | null
  active_borrowers_rate?: number | null
  km2_per_service_point: number | null
}
type Data = { years: number[]; rows: Row[]; area_km2: Record<string, number> }
type Libraries = {
  libraries: {
    name: string
    code: string | null
    type: string
    x: number
    y: number
  }[]
}
type Coverage = {
  observations_left_out: Record<string, number>
  municipalities_per_year: Record<string, number>
  set_to_missing?: Record<string, number>
  public_libraries_registered: number
  with_coordinates: number
  population_source: string
  sources: {
    name: string
    url?: string
    licence: string
    sha256?: Record<string, string>
  }[]
  run_id: string | null
}
type Municipality = {
  code: string
  name: string
  county: string
  finer?: number
  skr_group?: string
}
type Measure =
  | 'service_points_rate'
  | 'km2_per_service_point'
  | 'visits_rate'
  | 'activities_rate'
  | 'active_borrowers_rate'

const MEASURES: Record<
  Measure,
  {
    en: string
    sv: string
    kind: 'availability' | 'participation'
    low: boolean
  }
> = {
  service_points_rate: {
    en: 'Staffed service points per 10,000 inhabitants',
    sv: 'Bemannade serviceställen per 10 000 invånare',
    kind: 'availability',
    low: false,
  },
  km2_per_service_point: {
    en: 'Land area per staffed service point (km²)',
    sv: 'Landareal per bemannat serviceställe (km²)',
    kind: 'availability',
    low: true,
  },
  visits_rate: {
    en: 'Physical visits per inhabitant',
    sv: 'Fysiska besök per invånare',
    kind: 'participation',
    low: false,
  },
  activities_rate: {
    en: 'Public activities per 1,000 inhabitants',
    sv: 'Publika aktiviteter per 1 000 invånare',
    kind: 'participation',
    low: false,
  },
  active_borrowers_rate: {
    en: 'Active borrowers per 100 inhabitants',
    sv: 'Aktiva låntagare per 100 invånare',
    kind: 'participation',
    low: false,
  },
}
const BASE = 'sweden/belonging/'
const fmt = (v: number | null | undefined) =>
  v == null
    ? '–'
    : v.toLocaleString(l('en-GB', 'sv-SE'), {
        maximumFractionDigits: v >= 100 ? 0 : 2,
      })
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length
    ? s.length % 2
      ? s[(s.length - 1) / 2]
      : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
    : NaN
}
/** Spearman's rank correlation: Pearson's on ranks, ties averaged. */
function spearman(a: number[], b: number[]) {
  const rank = (xs: number[]) => {
    const order = xs.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0])
    const r = new Array(xs.length)
    for (let i = 0; i < order.length;) {
      let j = i
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
      for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2
      i = j + 1
    }
    return r as number[]
  }
  const ra = rank(a)
  const rb = rank(b)
  const ma = ra.reduce((s, v) => s + v, 0) / ra.length
  const mb = rb.reduce((s, v) => s + v, 0) / rb.length
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb)
    da += (ra[i] - ma) ** 2
    db += (rb[i] - mb) ** 2
  }
  return num / Math.sqrt(da * db)
}

export default function Belonging({ route }: { route: Route }) {
  const product = productById('D')
  const [data, setData] = useState<Data | 'error' | null>(null)
  const [libraries, setLibraries] = useState<Libraries | null>(null)
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [geo, setGeo] = useState<Geometry | null>(null)
  const [places, setPlaces] = useState<Municipality[] | null>(null)
  useEffect(() => {
    fetchJson<Data>(BASE + 'municipalities.json').then(setData, () =>
      setData('error'),
    )
    fetchJson<Libraries>(BASE + 'libraries.json').then(setLibraries, () => {})
    fetchJson<Coverage>(BASE + 'coverage.json').then(setCoverage, () => {})
    fetchJson<Geometry>('sweden/similarity/geometry.json').then(
      setGeo,
      () => {},
    )
    fetchJson<{ municipalities: Municipality[] }>(
      'sweden/similarity/municipalities.json',
    ).then(
      (d) => setPlaces(d.municipalities),
      () => {},
    )
  }, [])
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
          state="ingestion"
          shows={l(
            'Public libraries per municipality, by availability and use.',
            'Folkbibliotek per kommun, efter tillgång och användning.',
          )}
          needs={l(
            'sweden/belonging/municipalities.json from the sweden pipeline subject.',
            'sweden/belonging/municipalities.json från pipeline-subjektet sweden.',
          )}
        />
      </ProductEmpty>
    )

  const measure = (route.params.get('matt') as Measure) || 'service_points_rate'
  const scene3d = route.params.get('scen') !== '2d'
  const years = data.years
  const last = years[years.length - 1]
  const first = years[0]
  const year = Number(route.params.get('ar')) || last
  const code = route.params.get('kommun')
  const place = new Map((places ?? []).map((m) => [m.code, m]))
  const nameOf = (c: string) => place.get(c)?.name ?? c
  const rowsOf = (y: number) => data.rows.filter((r) => r.year === y)
  const byYear = rowsOf(year)
  const selected = code ? byYear.find((r) => r.code === code) : undefined

  // National totals over the municipalities that report both years, so changes in who reports
  // do not read as changes in libraries.
  const paired = (k: 'service_points' | 'visits' | 'activities') => {
    const a = new Map(
      rowsOf(first)
        .filter((r) => r[k] != null)
        .map((r) => [r.code, r[k]!]),
    )
    const both = rowsOf(last).filter((r) => r[k] != null && a.has(r.code))
    return {
      n: both.length,
      from: both.reduce((s, r) => s + a.get(r.code)!, 0),
      to: both.reduce((s, r) => s + r[k]!, 0),
    }
  }
  const points = paired('service_points')
  const visits = paired('visits')
  const rel = (from: number, to: number) =>
    `${to >= from ? '+' : ''}${Math.round((to / from - 1) * 100)} %`

  const typeOf = (c: string) => place.get(c)?.skr_group ?? null
  const groups = [
    ...new Set(
      (places ?? []).map((m) => m.skr_group).filter(Boolean) as string[],
    ),
  ].sort()
  const latest = rowsOf(last)
  const groupMedian = (g: string, k: Measure) =>
    median(
      latest
        .filter((r) => typeOf(r.code) === g && r[k] != null)
        .map((r) => r[k] as number),
    )
  // SKR's 2023 groups: the two rural groups against the two city groups.
  const rural = groups.filter((g) => g.startsWith('Landsbygdskommun'))
  const urban = groups.filter((g) => g === 'Storstäder' || g === 'Större stad')
  const mean = (gs: string[], k: Measure) =>
    median(gs.map((g) => groupMedian(g, k)).filter((v) => !Number.isNaN(v)))

  const pairs = latest.filter(
    (r) => r.service_points_rate != null && r.visits_rate != null,
  )
  const rho =
    pairs.length > 20
      ? spearman(
          pairs.map((r) => r.service_points_rate!),
          pairs.map((r) => r.visits_rate!),
        )
      : null

  const findings: Finding[] = [
    {
      key: 'decline',
      statement: l(
        `Staffed library service points ${points.to < points.from ? 'fell' : 'rose'} from ${fmt(points.from)} to ${fmt(points.to)} between ${first} and ${last}; physical visits ${rel(visits.from, visits.to)}.`,
        `Bemannade biblioteksserviceställen ${points.to < points.from ? 'minskade' : 'ökade'} från ${fmt(points.from)} till ${fmt(points.to)} mellan ${first} och ${last}; fysiska besök ${rel(visits.from, visits.to)}.`,
      ),
      values: (
        <ul>
          <li>
            {l('Service points', 'Serviceställen')}: {fmt(points.from)} →{' '}
            {fmt(points.to)} ({rel(points.from, points.to)}), {points.n}{' '}
            {l(
              'municipalities reporting both years',
              'kommuner som rapporterat båda åren',
            )}
          </li>
          <li>
            {l('Visits', 'Besök')}: {fmt(visits.from / 1e6)} →{' '}
            {fmt(visits.to / 1e6)} {l('million', 'miljoner')}, {visits.n}{' '}
            {l('municipalities', 'kommuner')}
          </li>
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        'KB, official library statistics (CC0)',
        'KB, officiell biblioteksstatistik (CC0)',
      ),
      onShow: () => set({ matt: null, ar: String(last) }),
    },
  ]
  if (rural.length && urban.length)
    findings.push({
      key: 'measure',
      contrary: true,
      statement: l(
        'Which places are best served depends on the measure: rural municipalities have more service points per inhabitant, and far more land per service point.',
        'Vilka platser som har bäst tillgång beror på måttet: landsbygdskommuner har fler serviceställen per invånare, och betydligt mer land per serviceställe.',
      ),
      values: (
        <ul>
          <li>
            {l('Per 10,000 inhabitants', 'Per 10 000 invånare')}:{' '}
            {l('rural', 'landsbygd')} {fmt(mean(rural, 'service_points_rate'))}{' '}
            · {l('cities', 'städer')} {fmt(mean(urban, 'service_points_rate'))}
          </li>
          <li>
            {l('km² per service point', 'km² per serviceställe')}:{' '}
            {l('rural', 'landsbygd')}{' '}
            {fmt(mean(rural, 'km2_per_service_point'))} ·{' '}
            {l('cities', 'städer')} {fmt(mean(urban, 'km2_per_service_point'))}
          </li>
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        `Medians of SKR municipality groups, ${last}`,
        `Medianer för SKR:s kommungrupper, ${last}`,
      ),
      onShow: () => set({ matt: 'km2_per_service_point', ar: String(last) }),
    })
  if (rho != null)
    findings.push({
      key: 'use',
      statement: l(
        `Having more service points per inhabitant goes with ${Math.abs(rho) < 0.2 ? 'hardly any difference in' : rho > 0 ? 'more' : 'fewer'} visits per inhabitant (Spearman ρ = ${rho.toFixed(2)}, ${pairs.length} municipalities, ${last}).`,
        `Fler serviceställen per invånare går ihop med ${Math.abs(rho) < 0.2 ? 'knappast någon skillnad i' : rho > 0 ? 'fler' : 'färre'} besök per invånare (Spearman ρ = ${rho.toFixed(2)}, ${pairs.length} kommuner, ${last}).`,
      ),
      values: (
        <p>
          {l(
            'Availability and use are measured separately; a correlation across municipalities says nothing about why.',
            'Tillgång och användning mäts var för sig; ett samband mellan kommuner säger inget om varför.',
          )}
        </p>
      ),
      evidence: 'exploratory',
      source: l(
        'KB library statistics; population SCB/Kolada',
        'KB:s biblioteksstatistik; folkmängd SCB/Kolada',
      ),
      onShow: () => set({ matt: 'visits_rate', ar: String(last) }),
    })

  const scene = (
    <Scene
      product={product}
      line={l(
        `${l(MEASURES[measure].en, MEASURES[measure].sv)}, ${year}. Points are public libraries registered in Biblioteksdatabasen.`,
        `${l(MEASURES[measure].en, MEASURES[measure].sv)}, ${year}. Punkterna är folkbibliotek registrerade i Biblioteksdatabasen.`,
      )}
      legend={
        <>
          <b>{l(MEASURES[measure].en, MEASURES[measure].sv)}</b>
          <p className="sw-note">
            {MEASURES[measure].kind === 'availability'
              ? l('Availability', 'Tillgång')
              : l('Participation', 'Deltagande')}{' '}
            ·{' '}
            {MEASURES[measure].low
              ? l('higher = more land per point', 'högre = mer land per ställe')
              : l('higher = more', 'högre = mer')}{' '}
            ·{' '}
            {l(
              'grey or hatched = not reported',
              'grått eller streckat = inte rapporterat',
            )}
          </p>
          <div className="sw-ramp" aria-hidden="true" />
          <p className="sw-note">
            {l(
              'Height and colour: rank among municipalities, so a few extremes do not flatten the rest. Lights: public libraries.',
              'Höjd och färg: rang bland kommunerna, så att några ytterligheter inte plattar till resten. Ljuspunkter: folkbibliotek.',
            )}
          </p>
          <ViewToggle
            view={scene3d ? '3d' : 'matrix'}
            onChange={(v) => set({ scen: v === '3d' ? null : '2d' })}
          />
        </>
      }
      control={
        <div className="sw-controls">
          <label>
            {l('Measure', 'Mått')}
            <select
              value={measure}
              onChange={(e) =>
                set({
                  matt:
                    e.target.value === 'service_points_rate'
                      ? null
                      : e.target.value,
                })
              }
            >
              {(Object.keys(MEASURES) as Measure[]).map((m) => (
                <option key={m} value={m}>
                  {l(MEASURES[m].en, MEASURES[m].sv)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {l('Year', 'År')} <span className="sw-mono">{year}</span>
            <input
              type="range"
              min={first}
              max={last}
              step={1}
              value={year}
              onChange={(e) =>
                set({
                  ar: e.target.value === String(last) ? null : e.target.value,
                })
              }
            />
          </label>
        </div>
      }
      info={
        selected ? (
          <>
            <b>
              {nameOf(selected.code)}{' '}
              <span className="sw-mono">{selected.code}</span>
            </b>
            <dl className="sw-info-list">
              {(Object.keys(MEASURES) as Measure[]).map((m) => (
                <div key={m}>
                  <dt>{l(MEASURES[m].en, MEASURES[m].sv)}</dt>
                  <dd className="sw-mono">
                    {fmt(selected[m] as number | null)}
                  </dd>
                </div>
              ))}
              <div>
                <dt>
                  {l('Staffed service points', 'Bemannade serviceställen')}
                </dt>
                <dd className="sw-mono">{fmt(selected.service_points)}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="sw-note">
            {l(
              'Choose a municipality on the map.',
              'Välj en kommun på kartan.',
            )}
          </p>
        )
      }
    >
      {geo && scene3d ? (
        <BelongingField
          geo={geo}
          values={
            new Map(byYear.map((r) => [r.code, r[measure] as number | null]))
          }
          libraries={libraries?.libraries ?? []}
          nameOf={nameOf}
          selected={code}
          onPick={(c) => set({ kommun: c })}
          fallback={
            <BelongingMap
              geo={geo}
              rows={byYear}
              measure={measure}
              libraries={libraries?.libraries ?? []}
              nameOf={nameOf}
              selected={code}
              onPick={(c) => set({ kommun: c })}
            />
          }
        />
      ) : geo ? (
        <BelongingMap
          geo={geo}
          rows={byYear}
          measure={measure}
          libraries={libraries?.libraries ?? []}
          nameOf={nameOf}
          selected={code}
          onPick={(c) => set({ kommun: c })}
        />
      ) : (
        <p className="sw-note" role="status">
          {l('Loading…', 'Laddar…')}
        </p>
      )}
    </Scene>
  )

  const nulled =
    coverage?.set_to_missing &&
    Object.values(coverage.set_to_missing).reduce((a, b) => a + b, 0)
  const method: Method = {
    question: <p>{l(product.question.en, product.question.sv)}</p>,
    theory: (
      <p>
        {l(
          'Durkheim on integration through shared institutions, Habermas on a public sphere outside the market, Putnam on social capital in civic places, and the Swedish folkbildning tradition of libraries and study circles as commons. They suggest looking at where non-commercial meeting places exist and whether they are used; none of them is tested here.',
          'Durkheim om integration genom gemensamma institutioner, Habermas om en offentlighet utanför marknaden, Putnam om socialt kapital i civila platser och den svenska folkbildningstraditionen av bibliotek och studiecirklar som allmänning. De pekar på var icke-kommersiella mötesplatser finns och om de används; ingen av dem prövas här.',
        )}
      </p>
    ),
    data: (
      <ul>
        {coverage?.sources.map((s) => (
          <li key={s.name}>
            {s.url ? <a href={s.url}>{s.name}</a> : s.name} — {s.licence}
          </li>
        ))}
        {coverage && (
          <li>
            {l('Population', 'Folkmängd')}:{' '}
            <span className="sw-mono">{coverage.population_source}</span>
          </li>
        )}
      </ul>
    ),
    method: (
      <ol>
        <li>
          {l(
            'Take the public-library observations (folkbibliotek, folk- och skolbibliotek) of four terms of KB’s statistics, 2014 onward.',
            'Ta folkbiblioteksobservationerna (folkbibliotek, folk- och skolbibliotek) för fyra termer i KB:s statistik, från 2014.',
          )}
        </li>
        <li>
          {l(
            'Assign each reporting library organisation to its municipality through Biblioteksdatabasen and sum per municipality and year.',
            'Knyt varje rapporterande biblioteksorganisation till sin kommun via Biblioteksdatabasen och summera per kommun och år.',
          )}
        </li>
        <li>
          {l(
            'If one of a municipality’s organisations did not report a term that year, the municipality’s value for that term is left missing, since the sum would be incomplete. Zero visits with a staffed service point, and zero service points with visits, are also treated as missing.',
            'Om en av kommunens organisationer inte rapporterat en term det året lämnas kommunens värde för termen tomt, eftersom summan skulle bli ofullständig. Noll besök med ett bemannat serviceställe, och noll serviceställen med besök, räknas också som saknade.',
          )}
          {nulled != null &&
            l(
              ` ${nulled} municipality values were set to missing this way.`,
              ` ${nulled} kommunvärden sattes som saknade på det sättet.`,
            )}
        </li>
        <li>
          {l(
            'Divide by the municipality’s population that year; land area from SCB’s boundaries.',
            'Dividera med kommunens folkmängd samma år; landareal från SCB:s gränser.',
          )}
        </li>
        <li>
          {l(
            'National changes use only municipalities reporting in both years compared.',
            'Nationella förändringar använder bara kommuner som rapporterat båda jämförda åren.',
          )}
        </li>
      </ol>
    ),
    results: (
      <p>
        {l(
          'The findings and tables on this page, computed from the published files.',
          'Resultaten och tabellerna på sidan, beräknade ur de publicerade filerna.',
        )}
      </p>
    ),
    alternatives: (
      <ul>
        <li>
          {l(
            'Fewer service points can mean merged branches with longer opening, not less access.',
            'Färre serviceställen kan betyda sammanslagna filialer med längre öppettider, inte sämre tillgång.',
          )}
        </li>
        <li>
          {l(
            'Visits fell sharply in 2020–2021 for the pandemic; a change between two years can be a recovery.',
            'Besöken föll kraftigt 2020–2021 under pandemin; en förändring mellan två år kan vara en återhämtning.',
          )}
        </li>
        <li>
          {l(
            'Libraries are one kind of non-commercial place; study associations, churches, sports clubs and community centres are not here yet.',
            'Bibliotek är en sorts icke-kommersiell plats; studieförbund, kyrkor, idrottsföreningar och föreningslokaler finns inte med ännu.',
          )}
        </li>
      </ul>
    ),
    limitations: (
      <ul>
        <li>
          {l(
            'The presence of a library is not evidence that anyone feels they belong.',
            'Att ett bibliotek finns är inget bevis för att någon känner tillhörighet.',
          )}
        </li>
        <li>
          {l(
            'No travel times: land area per service point describes density, not the trip to a library.',
            'Inga restider: landareal per serviceställe beskriver täthet, inte resan till ett bibliotek.',
          )}
        </li>
        {coverage && (
          <li>
            {l(
              `${coverage.with_coordinates} of ${coverage.public_libraries_registered} public libraries in Biblioteksdatabasen have coordinates; the register is Libris’s, not the official count of service points.`,
              `${coverage.with_coordinates} av ${coverage.public_libraries_registered} folkbibliotek i Biblioteksdatabasen har koordinater; registret är Libris, inte den officiella räkningen av serviceställen.`,
            )}
          </li>
        )}
        <li>
          {l(
            'Not every municipality reports every term every year; missing values are shown as missing.',
            'Inte varje kommun rapporterar varje term varje år; saknade värden visas som saknade.',
          )}
        </li>
        <li>
          {l(
            'Biblioteksdatabasen names no licence; KB describes its open API data as freely available. Contact details are not used.',
            'Biblioteksdatabasen anger ingen licens; KB beskriver datan i sitt öppna API som fritt tillgänglig. Kontaktuppgifter används inte.',
          )}
        </li>
      </ul>
    ),
    references: (
      <ul>
        <li>Durkheim, É. (1893). De la division du travail social.</li>
        <li>Habermas, J. (1962). Strukturwandel der Öffentlichkeit.</li>
        <li>Putnam, R. D. (2000). Bowling Alone. Simon & Schuster.</li>
        <li>Klinenberg, E. (2018). Palaces for the People. Crown.</li>
      </ul>
    ),
    reproducibility: (
      <dl>
        {coverage?.sources[0]?.sha256 &&
          Object.entries(coverage.sources[0].sha256).map(([t, h]) => (
            <div key={t} style={{ display: 'contents' }}>
              <dt className="sw-mono">{t}</dt>
              <dd className="sw-mono">{h?.slice(0, 16) ?? '–'}</dd>
            </div>
          ))}
        <dt>{l('Pipeline run', 'Pipelinekörning')}</dt>
        <dd className="sw-mono">
          {coverage?.run_id ?? l('local build', 'lokal körning')}
        </dd>
        <dt>{l('Reproduce', 'Reproducera')}</dt>
        <dd className="sw-mono">python platform/pipeline.py run sweden</dd>
      </dl>
    ),
  }

  const readings: Reading[] = [
    {
      theory: l(
        'Habermas and Putnam: civic infrastructure',
        'Habermas och Putnam: civil infrastruktur',
      ),
      expects: l(
        'Non-commercial public places thin out as the welfare state contracts.',
        'Icke-kommersiella offentliga platser glesnar när välfärdsstaten krymper.',
      ),
      verdict: 'undetermined',
      why: l(
        `Staffed service points ${rel(points.from, points.to)} between ${first} and ${last} in the municipalities reporting both years. ${points.to < points.from ? 'That is consistent with the reading but does not test it' : 'That does not fit the reading, and a count does not test it either'}: a count of service points says nothing about whether the welfare state contracted.`,
        `Bemannade serviceställen ${rel(points.from, points.to)} mellan ${first} och ${last} i kommunerna som rapporterat båda åren. ${points.to < points.from ? 'Det stämmer med läsningen men prövar den inte' : 'Det stämmer inte med läsningen, och en räkning prövar den inte heller'}: antalet serviceställen säger inget om huruvida välfärdsstaten krympt.`,
      ),
      limits: l(
        'One kind of place; consolidation can keep or improve access.',
        'En sorts plats; sammanslagning kan behålla eller förbättra tillgången.',
      ),
    },
    {
      theory: l('Use follows supply', 'Användning följer utbud'),
      expects: l(
        'Where there are more libraries per inhabitant, more people visit them.',
        'Där det finns fler bibliotek per invånare besöker fler dem.',
      ),
      verdict:
        rho == null
          ? 'undetermined'
          : rho > 0.2
            ? 'supports'
            : rho < -0.2
              ? 'challenges'
              : 'undetermined',
      why: l(
        `Spearman ρ = ${rho?.toFixed(2) ?? '–'} across municipalities in ${last}.`,
        `Spearman ρ = ${rho?.toFixed(2) ?? '–'} mellan kommuner ${last}.`,
      ),
      limits: l(
        'Small municipalities have many points per inhabitant and few visitors per point by construction.',
        'Små kommuner har många ställen per invånare och få besökare per ställe av konstruktionsskäl.',
      ),
    },
  ]

  return (
    <SwedenResearchPage
      product={product}
      scene={scene}
      findings={findings}
      explore={
        <Explore
          data={data}
          groups={groups}
          typeOf={typeOf}
          nameOf={nameOf}
          measure={measure}
          year={year}
          onPick={(c) => set({ kommun: c })}
          selected={code}
        />
      }
      exploreSummary={l(
        'National trends, municipality types compared, and every municipality ranked on the chosen measure.',
        'Nationella trender, kommungrupper jämförda och varje kommun rangordnad på valt mått.',
      )}
      method={method}
      readings={readings}
    />
  )
}

function BelongingMap({
  geo,
  rows,
  measure,
  libraries,
  nameOf,
  selected,
  onPick,
}: {
  geo: Geometry
  rows: Row[]
  measure: Measure
  libraries: Libraries['libraries']
  nameOf: (c: string) => string
  selected: string | null
  onPick: (c: string) => void
}) {
  const layout = useMapLayout(geo)!
  const viewBox = useMapViewBox()
  const values = new Map(rows.map((r) => [r.code, r[measure] as number | null]))
  const sorted = [...values.values()]
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)
  // Rank colouring: a few extreme municipalities would otherwise flatten the rest of the ramp.
  const t = (v: number) =>
    sorted.length > 1 ? sorted.indexOf(v) / (sorted.length - 1) : 1
  return (
    <svg
      viewBox={viewBox}
      className="sw-map"
      role="group"
      aria-label={l(
        'Public libraries by municipality',
        'Folkbibliotek per kommun',
      )}
    >
      <defs>
        <pattern
          id="sw-hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="6"
            stroke="var(--sw-muted)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <g className="sw-choropleth">
        {geo.municipalities.map((m) => {
          const v = values.get(m.code)
          return (
            <path
              key={m.code}
              d={layout.paths.get(m.code)}
              tabIndex={0}
              role="button"
              aria-label={`${nameOf(m.code)}: ${fmt(v)}`}
              data-selected={m.code === selected || undefined}
              style={{
                fill:
                  v == null
                    ? 'url(#sw-hatch)'
                    : `color-mix(in oklab, var(--sw-seq-hi) ${Math.round(t(v) * 100)}%, var(--sw-seq-lo))`,
              }}
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
      <g className="sw-libraries" aria-hidden="true">
        {libraries.map((p, i) => {
          const [x, y] = layout.project(p.x, p.y)
          return <circle key={i} cx={x} cy={y} r={1.6} />
        })}
      </g>
    </svg>
  )
}

function Explore({
  data,
  groups,
  typeOf,
  nameOf,
  measure,
  year,
  onPick,
  selected,
}: {
  data: Data
  groups: string[]
  typeOf: (c: string) => string | null
  nameOf: (c: string) => string
  measure: Measure
  year: number
  onPick: (c: string) => void
  selected: string | null
}) {
  const series = useMemo(() => {
    const keys: ('service_points' | 'visits' | 'activities')[] = [
      'service_points',
      'visits',
      'activities',
    ]
    return keys.map((k) => {
      const base = data.years[0]
      const firstRows = new Map(
        data.rows
          .filter((r) => r.year === base && r[k] != null)
          .map((r) => [r.code, r[k]!]),
      )
      return {
        key: k,
        name: {
          service_points: l('Service points', 'Serviceställen'),
          visits: l('Visits', 'Besök'),
          activities: l('Public activities', 'Publika aktiviteter'),
        }[k],
        points: data.years.map((y) => {
          // The same municipalities as in the first year, so coverage does not move the line.
          const rows = data.rows.filter(
            (r) => r.year === y && r[k] != null && firstRows.has(r.code),
          )
          const now = rows.reduce((s, r) => s + r[k]!, 0)
          const then = rows.reduce((s, r) => s + firstRows.get(r.code)!, 0)
          return {
            date: `${y}-01-01`,
            label: String(y),
            value: then ? (now / then) * 100 : 0,
          }
        }),
      }
    })
  }, [data])
  const rows = data.rows.filter((r) => r.year === year && r[measure] != null)
  return (
    <>
      <h3>
        {l(
          `National change, ${data.years[0]} = 100`,
          `Nationell förändring, ${data.years[0]} = 100`,
        )}
      </h3>
      <MultiLineChart
        series={series}
        label={l('Index of library measures', 'Index för biblioteksmått')}
        format={(v) => v.toFixed(0)}
        colorOf={(k) => series.findIndex((s) => s.key === k) + 1}
      />
      <p className="sw-note">
        {l(
          'Each line follows only the municipalities that reported the measure in the first year.',
          'Varje linje följer bara de kommuner som rapporterat måttet det första året.',
        )}
      </p>

      <h3>
        {l(
          `By SKR municipality group, ${year} (median)`,
          `Per SKR-kommungrupp, ${year} (median)`,
        )}
      </h3>
      <RankBars
        label={l('Median per municipality group', 'Median per kommungrupp')}
        format={fmt}
        rows={groups
          .map((g) => ({
            key: g,
            label: g,
            value: median(
              rows
                .filter((r) => typeOf(r.code) === g)
                .map((r) => r[measure] as number),
            ),
            note: `${rows.filter((r) => typeOf(r.code) === g).length} ${l('municipalities', 'kommuner')}`,
          }))
          .filter((r) => !Number.isNaN(r.value))
          .sort((a, b) => b.value - a.value)}
      />

      <h3>{l(`Every municipality, ${year}`, `Varje kommun, ${year}`)}</h3>
      <RankBars
        label={l(MEASURES[measure].en, MEASURES[measure].sv)}
        format={fmt}
        limit={20}
        onPick={onPick}
        picked={selected}
        rows={rows
          .map((r) => ({
            key: r.code,
            label: nameOf(r.code),
            value: r[measure] as number,
          }))
          .sort((a, b) => b.value - a.value)}
      />
    </>
  )
}
