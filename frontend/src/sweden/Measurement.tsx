/**
 * A — Politics of Measurement (#sweden-matning). What Swedish official statistics publish, by
 * research domain, period and finest geography, from SCB's table catalogue and Kolada's key
 * figures (sweden/measurement/*.json, built by platform/publish/sweden/export_measurement.py).
 *
 * Every number on the page is computed from those files. Counts describe what is published,
 * not what matters: one table is not one indicator, and a domain held by an agency outside the
 * two catalogues looks thin here without being unmeasured.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../welfare/data'
import RankBars from '../charts/RankBars'
import MultiLineChart from '../charts/MultiLineChart'
import { setHashParams, type Route } from '../router'
import { productById } from './products'
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

type Geo = 'national' | 'county' | 'municipality' | 'subarea'
type Domain = {
  id: string
  label_en: string
  label_sv: string
  scope_en: string
  scb_tables: number
  kolada_kpis: number
  scb_current: number
  kolada_current: number
  scb_municipal: number
  scb_subannual: number
  first_year: number | null
  institutions: number
  geo: Record<Geo, number>
}
type Summary = {
  current_from: number
  domains: Domain[]
  totals: {
    catalogue: string
    items: number
    first_year: number | null
    last_year: number | null
    institutions: number
  }[]
  provenance: {
    sources: { name: string; url: string; licence: string }[]
    fetched: { fetched_at: string | null; files?: number; bytes?: number }
    run_id: string | null
    code_sha: string | null
    models: string[]
    classification: string[]
  }
}
type Coverage = { rows: [string, number, Geo, number][] }
type Items = { rows: (string | number | null)[][] }

const BASE = 'sweden/measurement/'
const GEO_LEVELS: Geo[] = ['national', 'county', 'municipality', 'subarea']
const GEO_LABEL: Record<Geo, [string, string]> = {
  national: ['Country only', 'Bara riket'],
  county: ['Counties', 'Län'],
  municipality: ['Municipalities', 'Kommuner'],
  subarea: ['Below municipality', 'Under kommun'],
}
const DECADES = Array.from({ length: 13 }, (_, i) => 1900 + i * 10)
const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))
const name = (d: Domain) => l(d.label_en, d.label_sv)

/** Domain × decade: the most SCB tables that report any single year of the decade. */
function decadeMatrix(coverage: Coverage, minGeo: Geo) {
  const keep = new Set(GEO_LEVELS.slice(GEO_LEVELS.indexOf(minGeo)))
  const perYear = new Map<string, number>()
  for (const [domain, year, geo, tables] of coverage.rows) {
    if (!keep.has(geo)) continue
    const key = `${domain}|${year}`
    perYear.set(key, (perYear.get(key) ?? 0) + tables)
  }
  const cell = new Map<string, number>()
  for (const [key, tables] of perYear) {
    const [domain, year] = key.split('|')
    const decade = Math.floor(Number(year) / 10) * 10
    const k = `${domain}|${decade}`
    cell.set(k, Math.max(cell.get(k) ?? 0, tables))
  }
  return cell
}

const BarField = lazy(() => import('./BarField'))

export default function Measurement({ route }: { route: Route }) {
  const product = productById('A')
  const [summary, setSummary] = useState<Summary | 'error' | null>(null)
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  useEffect(() => {
    fetchJson<Summary>(BASE + 'summary.json').then(setSummary, () =>
      setSummary('error'),
    )
    fetchJson<Coverage>(BASE + 'coverage.json').then(setCoverage, () => {})
  }, [])
  const geo = (route.params.get('geo') as Geo) || 'national'
  const picked = route.params.get('domain')
  const decade = Number(route.params.get('decade')) || null
  const set = (changes: Record<string, string | null>, push = true) => {
    const params = new URLSearchParams(route.params)
    for (const [k, v] of Object.entries(changes))
      v == null || v === '' ? params.delete(k) : params.set(k, v)
    setHashParams(route.path, params, push)
  }
  const scene3d = route.params.get('scen') === '3d'
  const matrix = useMemo(
    () => (coverage ? decadeMatrix(coverage, geo) : null),
    [coverage, geo],
  )

  if (summary === null)
    return (
      <p className="sweden sw-note" role="status">
        {l('Loading…', 'Laddar…')}
      </p>
    )
  if (summary === 'error')
    return (
      <ProductEmpty product={product}>
        <EmptyState
          state="cloud"
          shows={l(
            'The coverage of Swedish official statistics by domain, period and geography.',
            'Täckningen i svensk officiell statistik per domän, period och geografi.',
          )}
          needs={l(
            'The measurement catalogue (sweden/measurement/summary.json) could not be read.',
            'Mätkatalogen (sweden/measurement/summary.json) kunde inte läsas.',
          )}
        />
      </ProductEmpty>
    )

  const domains = summary.domains
  const inside = domains.filter((d) => d.id !== 'other')
  const total = (d: Domain) => d.scb_tables + d.kolada_kpis
  const scb = summary.totals.find((t) => t.catalogue === 'scb')
  const kolada = summary.totals.find((t) => t.catalogue === 'kolada')
  const fewest = [...inside].sort((a, b) => total(a) - total(b))
  const empty = inside.filter((d) => total(d) === 0)
  const most = [...inside].sort((a, b) => b.scb_tables - a.scb_tables)[0]
  const culture = domains.find((d) => d.id === 'culture')
  const health = domains.find((d) => d.id === 'health')
  const selected = domains.find((d) => d.id === picked) ?? null

  const findings: Finding[] = []
  if (fewest.length) {
    const thin = fewest.slice(0, 3)
    findings.push({
      key: 'thinnest',
      statement: empty.length
        ? l(
            `No published table or key figure falls under ${empty.map(name).join(', ')}: no SCB subject or Kolada area is mapped there, so the zero comes from the classification, not from the catalogues.`,
            `Ingen publicerad tabell eller nyckeltal faller under ${empty.map(name).join(', ')}: inget SCB-ämne eller Kolada-område är indelat dit, så nollan kommer från indelningen, inte från katalogerna.`,
          )
        : l(
            `${name(thin[0])} is the thinnest of the twelve domains.`,
            `${name(thin[0])} är den tunnaste av de tolv domänerna.`,
          ),
      values: (
        <ul>
          {thin.map((d) => (
            <li key={d.id}>
              {name(d)}: {num(d.scb_tables)} {l('SCB tables', 'SCB-tabeller')} ·{' '}
              {num(d.kolada_kpis)} {l('Kolada key figures', 'Kolada-nyckeltal')}
            </li>
          ))}
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        'SCB table catalogue and Kolada, as fetched',
        'SCB:s tabellkatalog och Kolada, som hämtade',
      ),
      onShow: () => set({ domain: thin[0].id }),
    })
  }
  if (most && culture)
    findings.push({
      key: 'culture',
      statement: l(
        `SCB publishes ${num(most.scb_tables)} tables on ${name(most).toLowerCase()} and ${num(culture.scb_tables)} on culture.`,
        `SCB publicerar ${num(most.scb_tables)} tabeller om ${name(most).toLowerCase()} och ${num(culture.scb_tables)} om kultur.`,
      ),
      values: (
        <ul>
          <li>
            {name(most)}: {num(most.scb_tables)} ({num(most.scb_current)}{' '}
            {l(
              `reporting ${summary.current_from} or later`,
              `med data ${summary.current_from} eller senare`,
            )}
            ){most.first_year && `, ${l('from', 'från')} ${most.first_year}`}
          </li>
          <li>
            {name(culture)}: {num(culture.scb_tables)}
            {culture.first_year &&
              `, ${l('from', 'från')} ${culture.first_year}`}
            ; {l('Kolada', 'Kolada')} {num(culture.kolada_kpis)}
          </li>
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        'SCB table catalogue; domain classification in seeds/sweden',
        'SCB:s tabellkatalog; domänindelning i seeds/sweden',
      ),
      onShow: () => set({ domain: culture.id }),
    })
  if (health && health.kolada_kpis > health.scb_tables * 10)
    findings.push({
      key: 'health',
      contrary: true,
      statement: l(
        'Health looks unmeasured in SCB’s catalogue and is one of the most measured domains in Kolada: where a domain is counted depends on which agency holds it.',
        'Hälsa ser omätt ut i SCB:s katalog och är en av de mest mätta domänerna i Kolada: var en domän räknas beror på vilken myndighet som äger den.',
      ),
      values: (
        <ul>
          <li>
            SCB: {num(health.scb_tables)} {l('tables', 'tabeller')}
          </li>
          <li>
            Kolada: {num(health.kolada_kpis)} {l('key figures', 'nyckeltal')}
          </li>
        </ul>
      ),
      evidence: 'descriptive',
      source: l('SCB and Kolada catalogues', 'SCB:s och Koladas kataloger'),
      onShow: () => set({ domain: health.id }),
    })

  const scene = (
    <Scene
      product={product}
      line={l(
        'Each cell counts the SCB tables that report a year in that decade, at the chosen geography or finer. Darker means more tables, not more importance.',
        'Varje cell räknar SCB-tabeller som rapporterar ett år i det decenniet, på vald geografi eller finare. Mörkare betyder fler tabeller, inte större vikt.',
      )}
      legend={
        <>
          <b>
            {l(
              'SCB tables reporting the decade',
              'SCB-tabeller som rapporterar decenniet',
            )}
          </b>
          <p className="sw-note">
            {l(
              'Peak count in any single year of the decade, upper bound',
              'Högsta antal under något år i decenniet, övre gräns',
            )}
            {' · '}
            {l(GEO_LABEL[geo][0], GEO_LABEL[geo][1])}{' '}
            {l('or finer', 'eller finare')}
          </p>
          <div className="sw-ramp" aria-hidden="true" />
        </>
      }
      control={
        <div className="sw-controls">
          <ViewToggle
            view={scene3d ? '3d' : 'matrix'}
            onChange={(v) => set({ scen: v === '3d' ? '3d' : null })}
          />
          <label>
            {l('Finest geography at least', 'Finaste geografi minst')}
            <select
              value={geo}
              onChange={(e) =>
                set({
                  geo: e.target.value === 'national' ? null : e.target.value,
                })
              }
            >
              {GEO_LEVELS.map((g) => (
                <option key={g} value={g}>
                  {l(...GEO_LABEL[g])}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
      info={
        selected ? (
          <>
            <b>{name(selected)}</b>
            {decade && matrix && (
              <p className="sw-mono">
                {decade}s: {num(matrix.get(`${selected.id}|${decade}`) ?? 0)}{' '}
                {l('SCB tables', 'SCB-tabeller')}
              </p>
            )}
            <p className="sw-mono">
              SCB {num(selected.scb_tables)} · Kolada{' '}
              {num(selected.kolada_kpis)} ·{' '}
              {l('municipal or finer', 'kommun eller finare')}{' '}
              {num(selected.scb_municipal)}
            </p>
            <p className="sw-note">{selected.scope_en}</p>
          </>
        ) : (
          <p className="sw-note">
            {l(
              'Choose a cell to see its counts.',
              'Välj en cell för att se dess antal.',
            )}
          </p>
        )
      }
    >
      {matrix && scene3d ? (
        <Suspense
          fallback={
            <p className="sw-note" role="status">
              {l('Loading 3D…', 'Laddar 3D…')}
            </p>
          }
        >
          <BarField
            rows={domains.length}
            cols={DECADES.length}
            cells={(() => {
              const top = Math.max(1, ...matrix.values())
              return domains.flatMap((d, row) =>
                DECADES.map((dec, col) => {
                  const v = matrix.get(`${d.id}|${dec}`) ?? 0
                  return {
                    row,
                    col,
                    height: v / top,
                    key: `${d.id}|${dec}`,
                    label: `${name(d)}, ${dec}s: ${num(v)} ${l('SCB tables', 'SCB-tabeller')}`,
                  }
                }),
              )
            })()}
            picked={picked && decade ? `${picked}|${decade}` : null}
            onPick={(key) => {
              const [d, dec] = key.split('|')
              set({ domain: d, decade: dec })
            }}
            label={l(
              'The knowledge cube: SCB tables by domain and decade',
              'Kunskapskuben: SCB-tabeller per domän och decennium',
            )}
            fallback={
              <CoverageMatrix
                domains={domains}
                matrix={matrix}
                picked={picked}
                decade={decade}
                onPick={(d, dec) => set({ domain: d, decade: String(dec) })}
              />
            }
          />
        </Suspense>
      ) : matrix ? (
        <CoverageMatrix
          domains={domains}
          matrix={matrix}
          picked={picked}
          decade={decade}
          onPick={(d, dec) => set({ domain: d, decade: String(dec) })}
        />
      ) : (
        <p className="sw-note" role="status">
          {l('Loading…', 'Laddar…')}
        </p>
      )}
    </Scene>
  )

  const explore = (
    <Explore
      summary={summary}
      coverage={coverage}
      picked={picked}
      onPick={(d) => set({ domain: d })}
    />
  )

  const method: Method = {
    question: <p>{l(product.question.en, product.question.sv)}</p>,
    theory: (
      <p>
        {l(
          'Theodore Porter’s account of quantification as a technology of distance and trust, Ian Hacking’s work on how statistical categories make up kinds of people, Foucault on classification and government, and Goodhart’s law on indicators that become targets. They motivate the question; the catalogue cannot test them directly.',
          'Theodore Porters beskrivning av kvantifiering som en teknik för avstånd och förtroende, Ian Hackings arbete om hur statistiska kategorier skapar sorters människor, Foucault om klassificering och styrning och Goodharts lag om indikatorer som blir mål. De motiverar frågan; katalogen kan inte pröva dem direkt.',
        )}
      </p>
    ),
    data: (
      <ul>
        {summary.provenance.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url}>{s.name}</a> — {s.licence}
          </li>
        ))}
        <li>
          {num(scb?.items ?? 0)}{' '}
          {l('public SCB tables', 'publika SCB-tabeller')} ({scb?.institutions}{' '}
          {l('producing agencies', 'producerande myndigheter')}),{' '}
          {num(kolada?.items ?? 0)}{' '}
          {l('Kolada key figures', 'Kolada-nyckeltal')}.
        </li>
      </ul>
    ),
    method: (
      <ol>
        <li>
          {l(
            'Fetch both catalogues weekly; only catalogue metadata, never the statistics.',
            'Hämta båda katalogerna varje vecka; bara katalogmetadata, aldrig statistiken.',
          )}
        </li>
        <li>
          {l(
            'Classify each SCB subject (level two where it differs from its area) and each Kolada operating area into one research domain, in versioned seed files. Kolada’s culture and leisure area is split by title words (sport, recreation, bathing).',
            'Klassificera varje SCB-ämne (nivå två där det skiljer sig från området) och varje verksamhetsområde i Kolada till en forskningsdomän, i versionerade seedfiler. Koladas kultur och fritid delas med ord i titeln (idrott, fritid, bad).',
          )}
        </li>
        <li>
          {l(
            'Read the finest geography of every SCB table with a region variable from its metadata: two-digit codes are counties, four-digit codes municipalities, longer codes areas below a municipality.',
            'Läs den finaste geografin för varje SCB-tabell med regionvariabel ur dess metadata: tvåsiffriga koder är län, fyrsiffriga kommuner, längre koder områden under kommun.',
          )}
        </li>
        <li>
          {l(
            'Count tables per domain, per year of their period range, and per geography.',
            'Räkna tabeller per domän, per år i deras periodspann och per geografi.',
          )}
        </li>
      </ol>
    ),
    results: (
      <p>
        {l(
          'The findings above and the tables under Explore. Every count is computed from the published files when the page loads.',
          'Resultaten ovan och tabellerna under Utforska. Varje antal räknas fram ur de publicerade filerna när sidan laddas.',
        )}
      </p>
    ),
    alternatives: (
      <ul>
        <li>
          {l(
            'Division of labour between agencies: health statistics sit with Socialstyrelsen and Folkhälsomyndigheten, culture with Myndigheten för kulturanalys, faith communities with Myndigheten för stöd till trossamfund. A thin domain here can be measured elsewhere.',
            'Arbetsfördelning mellan myndigheter: hälsostatistik ligger hos Socialstyrelsen och Folkhälsomyndigheten, kultur hos Myndigheten för kulturanalys, trossamfund hos Myndigheten för stöd till trossamfund. En tunn domän här kan vara mätt någon annanstans.',
          )}
        </li>
        <li>
          {l(
            'Table design: some subjects publish many narrow tables, others a few wide ones, so table counts track publishing practice as much as measurement effort.',
            'Tabelldesign: vissa ämnen publicerar många smala tabeller, andra få breda, så antalet tabeller följer publiceringspraxis lika mycket som mätinsats.',
          )}
        </li>
        <li>
          {l(
            'Survey measures of well-being, relationships and leisure live inside broad surveys (ULF/SILC) that count as few tables.',
            'Enkätmått på välbefinnande, relationer och fritid finns i breda undersökningar (ULF/SILC) som räknas som få tabeller.',
          )}
        </li>
      </ul>
    ),
    limitations: (
      <ul>
        <li>
          {l(
            'Two catalogues only. Socialstyrelsen, Folkhälsomyndigheten, Kulturanalys, Brå and survey archives (SND) are not included yet.',
            'Bara två kataloger. Socialstyrelsen, Folkhälsomyndigheten, Kulturanalys, Brå och enkätarkiv (SND) ingår inte ännu.',
          )}
        </li>
        <li>
          {l(
            'A table counts for every year between its first and last period; gaps inside a series are not visible in the catalogue.',
            'En tabell räknas för varje år mellan dess första och sista period; luckor inne i en serie syns inte i katalogen.',
          )}
        </li>
        <li>
          {l(
            'Kolada’s catalogue has no first year, so Kolada is left out of the time view. A key figure counts as current when Kolada schedules a publication.',
            'Koladas katalog har inget första år, så Kolada saknas i tidsvyn. Ett nyckeltal räknas som aktuellt när Kolada planerar en publicering.',
          )}
        </li>
        <li>
          {l(
            'The domain classification is a judgement recorded in seed files; another classification would move tables between domains.',
            'Domänindelningen är en bedömning som ligger i seedfiler; en annan indelning skulle flytta tabeller mellan domäner.',
          )}
        </li>
        <li>
          {l(
            'Data quality (is a value recorded correctly) and construct validity (does a measure represent its concept) are different questions. The catalogue answers neither; it shows what is published. The platform’s own quality checks and validity reviews are on the Quality page.',
            'Datakvalitet (är ett värde korrekt registrerat) och begreppsvaliditet (representerar ett mått sitt begrepp) är olika frågor. Katalogen besvarar ingen av dem; den visar vad som publiceras. Plattformens egna kvalitetskontroller och validitetsgranskningar finns på kvalitetssidan.',
          )}
        </li>
      </ul>
    ),
    references: (
      <ul>
        <li>
          Porter, T. M. (1995). Trust in Numbers. Princeton University Press.
        </li>
        <li>
          Hacking, I. (1990). The Taming of Chance. Cambridge University Press.
        </li>
        <li>Foucault, M. (1966/1970). The Order of Things. Pantheon.</li>
        <li>
          Goodhart, C. (1975). Problems of Monetary Management: The U.K.
          Experience.
        </li>
      </ul>
    ),
    reproducibility: (
      <dl>
        <dt>{l('Fetched', 'Hämtad')}</dt>
        <dd className="sw-mono">
          {summary.provenance.fetched.fetched_at ?? '–'}
        </dd>
        <dt>{l('Files', 'Filer')}</dt>
        <dd className="sw-mono">{summary.provenance.fetched.files ?? '–'}</dd>
        <dt>{l('Pipeline run', 'Pipelinekörning')}</dt>
        <dd className="sw-mono">
          {summary.provenance.run_id ?? l('local build', 'lokal körning')}
        </dd>
        <dt>{l('Code', 'Kod')}</dt>
        <dd className="sw-mono">
          {summary.provenance.code_sha?.slice(0, 12) ?? '–'}
        </dd>
        <dt>{l('Models', 'Modeller')}</dt>
        <dd className="sw-mono">{summary.provenance.models.join(', ')}</dd>
        <dt>{l('Classification', 'Klassificering')}</dt>
        <dd className="sw-mono">
          {summary.provenance.classification.join(', ')}
        </dd>
        <dt>{l('Reproduce', 'Reproducera')}</dt>
        <dd className="sw-mono">python platform/pipeline.py run sweden</dd>
      </dl>
    ),
  }

  const byTables = [...inside].sort((a, b) => b.scb_tables - a.scb_tables)
  const bySubannual = [...inside].sort(
    (a, b) => b.scb_subannual - a.scb_subannual,
  )
  const governed = ['economy', 'employment']
  const porterHolds =
    governed.includes(byTables[0].id) && governed.includes(bySubannual[0].id)
  const readings: Reading[] = [
    {
      theory: 'Porter: trust in numbers',
      expects: l(
        'Quantification concentrates where central institutions need comparable numbers to govern at a distance: the economy, the labour market, public finances.',
        'Kvantifiering koncentreras där centrala institutioner behöver jämförbara siffror för att styra på avstånd: ekonomin, arbetsmarknaden, offentliga finanser.',
      ),
      verdict: porterHolds ? 'supports' : 'challenges',
      why: l(
        `Most SCB tables: ${name(byTables[0])} (${num(byTables[0].scb_tables)}), then ${name(byTables[1])} (${num(byTables[1].scb_tables)}). Most monthly or quarterly tables: ${name(bySubannual[0])} (${num(bySubannual[0].scb_subannual)}).`,
        `Flest SCB-tabeller: ${name(byTables[0])} (${num(byTables[0].scb_tables)}), sedan ${name(byTables[1])} (${num(byTables[1].scb_tables)}). Flest månads- eller kvartalstabeller: ${name(bySubannual[0])} (${num(bySubannual[0].scb_subannual)}).`,
      ),
      limits: l(
        'A count of tables shows where publishing is dense, not why; administrative demand is one explanation among several.',
        'Ett antal tabeller visar var publiceringen är tät, inte varför; administrativ efterfrågan är en förklaring bland flera.',
      ),
    },
    {
      theory: 'Hacking and Foucault: categories',
      expects: l(
        'What lacks an official category is hard to see: social life outside work and consumption should have few statistical objects of its own.',
        'Det som saknar officiell kategori är svårt att se: socialt liv utanför arbete och konsumtion borde ha få egna statistiska objekt.',
      ),
      verdict: 'undetermined',
      why: l(
        'Culture and leisure are thin here, but they are also counted by agencies outside these catalogues. Spirituality is zero because no subject is mapped to it, which says nothing about whether it is measured.',
        'Kultur och fritid är tunna här, men de räknas också av myndigheter utanför dessa kataloger. Andlighet är noll eftersom inget ämne är indelat dit, vilket inte säger något om huruvida den mäts.',
      ),
      limits: l(
        'Deciding this needs the other agencies’ catalogues and a reading of how categories changed over time.',
        'Att avgöra det kräver övriga myndigheters kataloger och en läsning av hur kategorierna förändrats över tid.',
      ),
    },
    {
      theory: 'Goodhart’s law',
      expects: l(
        'Indicators that become targets lose their meaning; municipal key figures used for comparison would be the first to show it.',
        'Indikatorer som blir mål förlorar sin mening; kommunala nyckeltal som används för jämförelse borde visa det först.',
      ),
      verdict: 'undetermined',
      why: l(
        'The catalogue says which figures exist, not how they are used or whether behaviour shifted toward them.',
        'Katalogen säger vilka nyckeltal som finns, inte hur de används eller om beteenden har förskjutits mot dem.',
      ),
      limits: l(
        'Testing it needs time series of the figures themselves and records of their use in steering.',
        'Att pröva det kräver tidsserier av nyckeltalen och underlag om hur de används i styrning.',
      ),
    },
  ]

  return (
    <SwedenResearchPage
      product={product}
      scene={scene}
      findings={findings}
      explore={explore}
      exploreSummary={l(
        'Counts per domain, tables per year, and every table and key figure.',
        'Antal per domän, tabeller per år och varje tabell och nyckeltal.',
      )}
      method={method}
      readings={readings}
    />
  )
}

/** Sequential cell colour; the number sits on its own label, so no shade limits contrast. */
function ramp(t: number) {
  return {
    background: `color-mix(in oklab, var(--sw-seq-hi) ${Math.round(t * 100)}%, var(--sw-seq-lo))`,
  }
}

function CoverageMatrix({
  domains,
  matrix,
  picked,
  decade,
  onPick,
}: {
  domains: Domain[]
  matrix: Map<string, number>
  picked: string | null
  decade: number | null
  onPick: (domain: string, decade: number) => void
}) {
  const top = Math.max(1, ...matrix.values())
  return (
    <div className="sw-table-wrap sw-matrix">
      <table className="sw-table">
        <caption className="visually-hidden">
          {l(
            'SCB tables per research domain and decade',
            'SCB-tabeller per forskningsdomän och decennium',
          )}
        </caption>
        <thead>
          <tr>
            <th scope="col">{l('Domain', 'Domän')}</th>
            {DECADES.map((d) => (
              <th key={d} scope="col" className="sw-n">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {domains.map((dom) => (
            <tr key={dom.id} aria-current={dom.id === picked || undefined}>
              <th scope="row">{name(dom)}</th>
              {DECADES.map((d) => {
                const v = matrix.get(`${dom.id}|${d}`) ?? 0
                // Square-root scale: a few domains have hundreds of tables, most have tens.
                const t = Math.sqrt(v / top)
                return (
                  <td
                    key={d}
                    className="sw-cell"
                    data-zero={v === 0 || undefined}
                    style={{
                      ...(v ? ramp(t) : {}),
                      outline:
                        dom.id === picked && d === decade
                          ? '2px solid var(--sw-ink)'
                          : undefined,
                    }}
                  >
                    <button
                      type="button"
                      className="sw-cell-button"
                      aria-label={`${name(dom)}, ${d}s: ${v}`}
                      onClick={() => onPick(dom.id, d)}
                    >
                      <span>{v || '·'}</span>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Explore({
  summary,
  coverage,
  picked,
  onPick,
}: {
  summary: Summary
  coverage: Coverage | null
  picked: string | null
  onPick: (domain: string) => void
}) {
  const domains = summary.domains
  // The full list (about 2 MB) loads only when asked for, so the page's first data stays small.
  const [items, setItems] = useState<Items | 'loading' | 'error' | null>(null)
  const [query, setQuery] = useState('')
  const domain = picked ?? domains[0].id
  const loadItems = () => {
    setItems('loading')
    fetchJson<Items>(BASE + 'items.json').then(setItems, () =>
      setItems('error'),
    )
  }
  const series = useMemo(() => {
    if (!coverage) return []
    const per = new Map<string, Map<number, number>>()
    for (const [d, year, , tables] of coverage.rows) {
      if (year < 1950) continue
      const m = per.get(d) ?? new Map()
      m.set(year, (m.get(year) ?? 0) + tables)
      per.set(d, m)
    }
    const order = [...domains].sort((a, b) => b.scb_tables - a.scb_tables)
    const keys = [...new Set([domain, ...order.map((d) => d.id)])].slice(0, 5)
    return keys
      .filter((k) => per.has(k))
      .map((k) => ({
        key: k,
        name: name(domains.find((d) => d.id === k)!),
        points: [...per.get(k)!.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([y, v]) => ({
            date: `${y}-01-01`,
            label: String(y),
            value: v,
          })),
      }))
  }, [coverage, domain, domains])
  const shown = useMemo(() => {
    if (!items || typeof items === 'string') return []
    const q = query.trim().toLowerCase()
    return items.rows
      .filter(
        (r) =>
          r[3] === domain && (!q || String(r[2]).toLowerCase().includes(q)),
      )
      .slice(0, 200)
  }, [items, domain, query])
  const keys = series.map((s) => s.key)
  return (
    <>
      <h3>
        {l(
          'Published tables and key figures per domain',
          'Publicerade tabeller och nyckeltal per domän',
        )}
      </h3>
      <RankBars
        label={l('SCB tables per domain', 'SCB-tabeller per domän')}
        format={num}
        picked={picked}
        onPick={onPick}
        rows={[...domains]
          .sort(
            (a, b) =>
              b.scb_tables + b.kolada_kpis - a.scb_tables - a.kolada_kpis,
          )
          .map((d) => ({
            key: d.id,
            label: name(d),
            value: d.scb_tables + d.kolada_kpis,
            note: `SCB ${num(d.scb_tables)} · Kolada ${num(d.kolada_kpis)}`,
          }))}
      />
      <div className="sw-table-wrap">
        <table className="sw-table">
          <caption>
            {l('Every domain in numbers', 'Varje domän i siffror')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Domain', 'Domän')}</th>
              <th scope="col" className="sw-n">
                SCB
              </th>
              <th scope="col" className="sw-n">
                {l(
                  `SCB, data ${summary.current_from}+`,
                  `SCB, data ${summary.current_from}+`,
                )}
              </th>
              <th scope="col" className="sw-n">
                {l('SCB monthly/quarterly', 'SCB månad/kvartal')}
              </th>
              {GEO_LEVELS.map((g) => (
                <th key={g} scope="col" className="sw-n">
                  SCB: {l(...GEO_LABEL[g])}
                </th>
              ))}
              <th scope="col" className="sw-n">
                Kolada
              </th>
              <th scope="col" className="sw-n">
                {l('Kolada current', 'Kolada aktuella')}
              </th>
              <th scope="col" className="sw-n">
                {l('First year', 'Första år')}
              </th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.id}>
                <th scope="row">{name(d)}</th>
                <td className="sw-n">{num(d.scb_tables)}</td>
                <td className="sw-n">{num(d.scb_current)}</td>
                <td className="sw-n">{num(d.scb_subannual)}</td>
                {GEO_LEVELS.map((g) => (
                  <td key={g} className="sw-n">
                    {num(d.geo[g])}
                  </td>
                ))}
                <td className="sw-n">{num(d.kolada_kpis)}</td>
                <td className="sw-n">{num(d.kolada_current)}</td>
                <td className="sw-n">{d.first_year ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>
        {l(
          'SCB tables reporting each year, since 1950',
          'SCB-tabeller som rapporterar varje år, sedan 1950',
        )}
      </h3>
      {series.length > 0 && (
        <MultiLineChart
          series={series}
          label={l(
            'SCB tables per year by domain',
            'SCB-tabeller per år och domän',
          )}
          format={num}
          colorOf={(k) => keys.indexOf(k) + 1}
        />
      )}

      <h3>
        {l(
          'Tables and key figures in a domain',
          'Tabeller och nyckeltal i en domän',
        )}
      </h3>
      <div className="sw-controls">
        <label>
          {l('Domain', 'Domän')}
          <select value={domain} onChange={(e) => onPick(e.target.value)}>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {name(d)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {l('Search titles', 'Sök i titlar')}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {items === null ? (
        <button type="button" className="sw-link" onClick={loadItems}>
          {l(
            'Show every table and key figure',
            'Visa varje tabell och nyckeltal',
          )}
        </button>
      ) : items === 'error' ? (
        <p className="sw-note" role="status">
          {l('The list could not be read.', 'Listan kunde inte läsas.')}
        </p>
      ) : items !== 'loading' ? (
        <div className="sw-table-wrap">
          <table className="sw-table">
            <caption className="visually-hidden">
              {l('Tables and key figures', 'Tabeller och nyckeltal')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{l('Catalogue', 'Katalog')}</th>
                <th scope="col">{l('Title', 'Titel')}</th>
                <th scope="col">{l('Source', 'Källa')}</th>
                <th scope="col">{l('Frequency', 'Frekvens')}</th>
                <th scope="col" className="sw-n">
                  {l('Period', 'Period')}
                </th>
                <th scope="col">{l('Finest geography', 'Finaste geografi')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={`${r[0]}-${r[1]}`}>
                  <td className="sw-mono">
                    {r[0] === 'scb' ? 'SCB' : 'Kolada'} {r[1]}
                  </td>
                  <td>{r[2]}</td>
                  <td>{r[4]}</td>
                  <td>{r[6]}</td>
                  <td className="sw-n">
                    {r[7] ? `${r[7]}–${r[8]}` : (r[8] ?? '–')}
                  </td>
                  <td>{l(...GEO_LABEL[r[9] as Geo])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 200 && (
            <p className="sw-note">
              {l(
                'First 200 rows; narrow the search.',
                'De första 200 raderna; smalna av sökningen.',
              )}
            </p>
          )}
        </div>
      ) : (
        <p className="sw-note" role="status">
          {l('Loading…', 'Laddar…')}
        </p>
      )}
    </>
  )
}
