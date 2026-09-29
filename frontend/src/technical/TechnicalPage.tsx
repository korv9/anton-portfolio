/**
 * Technical: the architecture behind the site, written for a technical reader. The system
 * layers are described in prose tables; every number (models, tests, rows, relations, model
 * scores) is read at view time from the files the pipeline publishes: the dbt schema export
 * (schema/models.json) and the DrugComb evaluation tables.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../welfare/data'
import { useReveal } from '../home/reveal'
import '../home/home.css'
import './technical.css'

type Node = {
  id: string
  name: string
  kind: 'model' | 'seed' | 'source'
  layer: 'source' | 'seed' | 'bronze' | 'silver' | 'gold'
  subject: string
  materialized: string | null
  description: string
  tests: string[]
  columns: { name: string; tests: string[] }[]
  rows: number | null
  reads: string[]
  read_by: string[]
}
type Schema = {
  dbt_version: string
  layers: Record<string, number>
  tests: number
  edges: { from: string; to: string; keys: string[] }[]
  links: { from: string; column: string; to: string; field: string }[]
  nodes: Node[]
}
type Metric = {
  scheme: string
  model: string
  model_label: string
  pearson: number | null
  rmse: number
  auprc_synergy: number
  prevalence_synergy: number
}

const T = (en: string, sv: string) => l(en, sv)
const LAYERS: Node['layer'][] = ['source', 'seed', 'bronze', 'silver', 'gold']
const LAYER_NAME: Record<Node['layer'], [string, string]> = {
  source: ['Sources', 'Källor'],
  seed: ['Seeds', 'Seeds'],
  bronze: ['Bronze', 'Brons'],
  silver: ['Silver', 'Silver'],
  gold: ['Gold', 'Guld'],
}

/** The system, layer by layer: what runs where and what contract it hands on. */
const SYSTEM: [string, string, [string, string], [string, string]][] = [
  [
    'Ingestion',
    'Python 3, requests, pyarrow',
    [
      'One package per source under platform/ingest (Riksdagen, SCB PxWeb, Valmyndigheten, Kolada, Försäkringskassan, Folkhälsomyndigheten, ESS, JobTech, Statskontoret, Skatteverket, news feeds). Every fetch is idempotent and written append-only.',
      'Ett paket per källa under platform/ingest (Riksdagen, SCB PxWeb, Valmyndigheten, Kolada, Försäkringskassan, Folkhälsomyndigheten, ESS, JobTech, Statskontoret, Skatteverket, nyhetsflöden). Varje hämtning är idempotent och skrivs append-only.',
    ],
    [
      'Raw files in warehouse/raw with provenance: URL, fetch time, SHA-256.',
      'Råfiler i warehouse/raw med proveniens: URL, hämtningstid, SHA-256.',
    ],
  ],
  [
    'Bronze',
    'dbt Core on DuckDB',
    [
      'Views over the raw files (read_csv / read_json as external sources, all_varchar, filename kept) so nothing is lost before typing.',
      'Vyer över råfilerna (read_csv / read_json som externa källor, all_varchar, filnamn kvar) så att inget går förlorat före typning.',
    ],
    [
      'Schema-on-read: one relation per source table.',
      'Schema-on-read: en relation per källtabell.',
    ],
  ],
  [
    'Silver',
    'dbt (int_ models)',
    [
      'Conformed and typed: casting, deduplication, code lists mapped to shared keys (region, period, party, age group).',
      'Konformerat och typat: typkonvertering, deduplicering, kodlistor mappade till gemensamma nycklar (region, period, parti, åldersgrupp).',
    ],
    [
      'Clean entities at a declared grain.',
      'Rena entiteter med deklarerat korn.',
    ],
  ],
  [
    'Gold',
    'dbt (dim_, fct_, bridge_, mart_)',
    [
      'Kimball-style star schemas: conformed dimensions shared across subjects, fact tables at one grain, bridge tables for many-to-many, marts shaped for one question. The job-ads fact is incremental.',
      'Stjärnscheman i Kimball-stil: konformerade dimensioner delade mellan ämnen, faktatabeller med ett korn, bryggtabeller för många-till-många, marts formade för en fråga. Faktatabellen för jobbannonser är inkrementell.',
    ],
    [
      'Tested tables with primary and foreign keys.',
      'Testade tabeller med primär- och främmande nycklar.',
    ],
  ],
  [
    T('Quality', 'Kvalitet'),
    'dbt tests, pytest, contracts',
    [
      'Generic tests (unique, not_null, relationships, accepted values), singular tests for totals and complete months, pytest for ingestion and the evidence engine, JSON data contracts, and a reconcile step that must reproduce the delivered file byte for byte.',
      'Generiska tester (unique, not_null, relationships, accepted values), singulära tester för totaler och fullständiga månader, pytest för inläsning och evidensmotorn, JSON-datakontrakt och ett avstämningssteg som måste återskapa den levererade filen byte för byte.',
    ],
    [
      'A red test stops the build and the deploy.',
      'Ett rött test stoppar bygget och deployen.',
    ],
  ],
  [
    'Delivery',
    'platform/publish, boto3',
    [
      'Serialisation sized for first paint: small JSON for the first view, Parquet marts, sharded JSON for large corpora (speeches). A catalogue lists every file with bytes and SHA-256; upload to object storage over the S3 API, then verify.',
      'Serialisering dimensionerad för första renderingen: liten JSON för första vyn, Parquet-marts, shardad JSON för stora korpusar (anföranden). En katalog listar varje fil med storlek och SHA-256; uppladdning till objektlagring via S3-API:t och sedan verifiering.',
    ],
    [
      'Immutable, content-hashed files.',
      'Oföränderliga filer med innehållshash.',
    ],
  ],
  [
    'Serving',
    'Cloudflare Workers, R2',
    [
      'Static assets from the edge; a Worker answers /api/* (taLLMan) and reads secrets at runtime. Large data is served from an R2 bucket, so the repository stays small.',
      'Statiska filer från edge; en Worker svarar på /api/* (taLLMan) och läser hemligheter vid körning. Stora datamängder serveras från en R2-bucket så att repot hålls litet.',
    ],
    [
      'No database server to run: read-only, cacheable HTTP.',
      'Ingen databasserver att drifta: skrivskyddad, cachebar HTTP.',
    ],
  ],
  [
    'Frontend',
    'React 19, TypeScript, Vite',
    [
      'Hash routing with shareable query state, route-level code splitting (lazy), bilingual copy, hand-built SVG charts. Playwright end-to-end tests on desktop and mobile, with axe accessibility checks.',
      'Hash-routing med delbart tillstånd i URL:en, koddelning per route (lazy), tvåspråkig text, egenbyggda SVG-diagram. Playwright end-to-end-tester på desktop och mobil, med axe-kontroller för tillgänglighet.',
    ],
    [
      'Each page loads only the data it shows.',
      'Varje sida laddar bara den data den visar.',
    ],
  ],
  [
    'CI/CD',
    'GitHub Actions',
    [
      'CI on every push: format, type check, build, browser tests; platform tests, data contracts, dbt parse and compile, politics reconciliation. Separate workflows publish to R2 and refresh jobs, news and public data (their schedules are paused; they run by hand).',
      'CI vid varje push: formatering, typkontroll, bygge, webbläsartester; plattformstester, datakontrakt, dbt parse och compile, avstämning av politikdatan. Separata arbetsflöden publicerar till R2 och uppdaterar jobb, nyheter och offentlig data (schemana är pausade; de körs manuellt).',
    ],
    [
      'Environment secrets only in GitHub and Cloudflare.',
      'Hemligheter bara i GitHub och Cloudflare.',
    ],
  ],
]

/** taLLMan, request by request. */
const RAG: [string, [string, string], string][] = [
  [
    T('Index', 'Index'),
    [
      'Built offline from the published data: datapoints (numbers that can be recomputed) and one entry per debate; speeches are read from their shards at answer time.',
      'Byggs offline från den publicerade datan: datapunkter (siffror som kan räknas om) och en post per debatt; anförandena läses från sina shards vid svarstillfället.',
    ],
    'platform/tallman/build_index.py',
  ],
  [
    T('Entities', 'Entiteter'),
    [
      'Parties, people and years recognised in the question narrow the search.',
      'Partier, personer och år i frågan känns igen och smalnar av sökningen.',
    ],
    'engine/entities.ts',
  ],
  [
    T('Retrieval', 'Hämtning'),
    [
      'Hybrid: BM25 lexical ranking plus dense vectors (multilingual bge-m3 embeddings in Cloudflare Vectorize), merged. Without Vectorize, lexical only.',
      'Hybrid: lexikal BM25-rankning plus täta vektorer (flerspråkiga bge-m3-inbäddningar i Cloudflare Vectorize), sammanslagna. Utan Vectorize bara lexikal.',
    ],
    'engine/retrieve.ts, worker/vector.ts',
  ],
  [
    T('Claims', 'Påståenden'),
    [
      'An LLM (Claude through the Anthropic API) writes the answer as claims, each citing passages. Without a key an extractive fallback builds the claims.',
      'En språkmodell (Claude via Anthropics API) skriver svaret som påståenden som vart och ett citerar passager. Utan nyckel bygger en extraktiv reserv påståendena.',
    ],
    'engine/claims.ts, worker/llm.ts',
  ],
  [
    T('Verification', 'Verifiering'),
    [
      'Allegoria checks every claim deterministically against its passages: quotes word for word, numbers recomputed; six labels from "directly supported" to "conflicting sources". The model proposes, the code decides.',
      'Allegoria kontrollerar varje påstående deterministiskt mot sina passager: citat ord för ord, siffror räknas om; sex etiketter från "direkt belagt" till "motstridiga källor". Modellen föreslår, koden avgör.',
    ],
    'engine/allegoria.ts',
  ],
  [
    T('Answer', 'Svar'),
    [
      'Claims with labels, certainty, sources and a timed trace of every step.',
      'Påståenden med etiketter, säkerhet, källor och ett tidsatt spår av varje steg.',
    ],
    'engine/pipeline.ts',
  ],
]

/** Decisions a reviewer would ask about. */
const DECISIONS: [[string, string], [string, string], [string, string]][] = [
  [
    ['DuckDB as the warehouse', 'DuckDB som datalager'],
    [
      'In-process columnar engine: fast joins over tens of millions of rows on a laptop or a CI runner, no server, and dbt works against it unchanged.',
      'Kolumnbaserad motor i processen: snabba joins över tiotals miljoner rader på en laptop eller i CI, ingen server, och dbt fungerar mot den oförändrat.',
    ],
    [
      'Single writer; moving to a cloud warehouse would be a profile change in dbt.',
      'En skrivare åt gången; att byta till ett molnlager vore en profiländring i dbt.',
    ],
  ],
  [
    [
      'Static delivery instead of an API',
      'Statisk leverans i stället för ett API',
    ],
    [
      'Data changes daily at most, so pre-computed, content-hashed files on a CDN are cheaper, faster and simpler to operate than a query service.',
      'Datan ändras som mest dagligen, så förberäknade filer med innehållshash på ett CDN är billigare, snabbare och enklare att drifta än en frågetjänst.',
    ],
    [
      'Ad hoc questions need a new mart; the explorer covers the rest in the browser.',
      'Ad hoc-frågor kräver en ny mart; utforskaren täcker resten i webbläsaren.',
    ],
  ],
  [
    [
      'Medallion layers in one dbt project',
      'Medaljongslager i ett dbt-projekt',
    ],
    [
      'Lineage, tests and documentation in one graph; every gold table can be traced to the raw file and the URL it came from.',
      'Härkomst, tester och dokumentation i en graf; varje guldtabell kan spåras till råfilen och URL:en den kom från.',
    ],
    [
      'Some older builders still live in platform/legacy and are being moved one subject at a time.',
      'Några äldre byggskript finns kvar i platform/legacy och flyttas ett ämne i taget.',
    ],
  ],
  [
    [
      'Deterministic verification of LLM output',
      'Deterministisk kontroll av LLM-svar',
    ],
    [
      'A language model can be wrong fluently. Checking each claim in code makes the same answer get the same labels, and makes errors visible instead of hidden.',
      'En språkmodell kan ha fel med god formulering. När varje påstående kontrolleras i kod får samma svar samma etiketter, och fel blir synliga i stället för dolda.',
    ],
    [
      'Stricter than a human reader: paraphrases are labelled summary or interpretation.',
      'Striktare än en mänsklig läsare: omskrivningar märks som sammanfattning eller tolkning.',
    ],
  ],
  [
    [
      'Leakage-aware ML evaluation',
      'ML-utvärdering som tar hänsyn till läckage',
    ],
    [
      'Random splits flatter a model when the same drugs and cell lines are in training and test. Cold splits show what generalises.',
      'Slumpvisa uppdelningar smickrar en modell när samma läkemedel och cellinjer finns i både träning och test. Kalla uppdelningar visar vad som generaliserar.',
    ],
    [
      'Lower headline scores, but honest ones.',
      'Lägre toppsiffror, men ärliga.',
    ],
  ],
]

const fmt = (n: number, digits = 0) =>
  n.toLocaleString(l('en-GB', 'sv-SE'), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

function testsOf(n: Node) {
  return n.tests.length + n.columns.reduce((s, c) => s + c.tests.length, 0)
}

export default function TechnicalPage() {
  const [schema, setSchema] = useState<Schema | null>(null)
  const [metrics, setMetrics] = useState<Metric[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetchJson<Schema>('schema/models.json')
      .then(setSchema)
      .catch((e: Error) => setError(e.message))
    fetchJson<Metric[]>('products/drugcomb/tables/metrics.json')
      .then(setMetrics)
      .catch(() => setMetrics([]))
  }, [])
  const root = useReveal<HTMLDivElement>([schema, metrics])

  const view = useMemo(() => {
    if (!schema) return null
    const byId = new Map(schema.nodes.map((n) => [n.id, n]))
    const layers = LAYERS.map((layer) => {
      const nodes = schema.nodes.filter((n) => n.layer === layer)
      const mats = new Map<string, number>()
      for (const n of nodes)
        mats.set(
          n.materialized ?? '—',
          (mats.get(n.materialized ?? '—') ?? 0) + 1,
        )
      return {
        layer,
        count: nodes.length,
        rows: nodes.reduce((s, n) => s + (n.rows ?? 0), 0),
        tests: nodes.reduce((s, n) => s + testsOf(n), 0),
        columns: nodes.reduce((s, n) => s + n.columns.length, 0),
        mats: [...mats.entries()].sort((a, b) => b[1] - a[1]),
      }
    })
    // Subject areas by layer: how wide each subject is in the warehouse.
    const subjects = [...new Set(schema.nodes.map((n) => n.subject))]
      .map((subject) => {
        const counts = LAYERS.map(
          (layer) =>
            schema.nodes.filter(
              (n) => n.subject === subject && n.layer === layer,
            ).length,
        )
        return { subject, counts, total: counts.reduce((s, c) => s + c, 0) }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)
    const cellMax = Math.max(...subjects.flatMap((s) => s.counts))
    // Conformed dimensions: which dimension joins to how many models, on which key.
    const dims = new Map<
      string,
      { name: string; keys: Set<string>; to: Set<string> }
    >()
    for (const e of schema.edges) {
      const from = byId.get(e.from)
      if (!from || !from.name.startsWith('dim_') || !e.keys.length) continue
      const entry = dims.get(from.id) ?? {
        name: from.name,
        keys: new Set<string>(),
        to: new Set<string>(),
      }
      e.keys.forEach((k) => entry.keys.add(k))
      const to = byId.get(e.to)
      if (to) entry.to.add(to.name)
      dims.set(from.id, entry)
    }
    const dimensions = [...dims.values()]
      .sort((a, b) => b.to.size - a.to.size)
      .slice(0, 10)
    const largest = [...schema.nodes]
      .filter((n) => n.rows)
      .sort((a, b) => (b.rows ?? 0) - (a.rows ?? 0))
      .slice(0, 10)
    const models = schema.nodes.filter((n) => n.kind === 'model')
    const prefixes = ['stg_', 'int_', 'dim_', 'fct_', 'bridge_', 'mart_'].map(
      (p) => ({ p, n: models.filter((m) => m.name.startsWith(p)).length }),
    )
    return {
      layers,
      subjects,
      cellMax,
      dimensions,
      largest,
      models,
      prefixes,
      keyed: schema.edges.filter((e) => e.keys.length).length,
      rows: schema.nodes.reduce((s, n) => s + (n.rows ?? 0), 0),
      columns: schema.nodes.reduce((s, n) => s + n.columns.length, 0),
    }
  }, [schema])

  const ml = useMemo(() => {
    if (!metrics?.length) return null
    const schemes = [...new Set(metrics.map((m) => m.scheme))]
    const models = [...new Set(metrics.map((m) => m.model))].filter(
      (m) => m !== 'mean',
    )
    const cell = (scheme: string, model: string) =>
      metrics.find((m) => m.scheme === scheme && m.model === model)
    return { schemes, models, cell }
  }, [metrics])

  return (
    <div className="cv technical" id="technical" ref={root}>
      <header className="page-hero">
        <p className="page-eyebrow">Technical</p>
        <h1>{T('How it all works', 'Hur allt fungerar')}</h1>
        <p className="page-lead">
          {T(
            'The architecture behind this site, from raw public data to the charts: ingestion with provenance, a medallion warehouse in dbt and DuckDB, tested star schemas, static delivery on the edge, and an LLM pipeline whose answers are verified in code. The numbers below are read live from the dbt schema export.',
            'Arkitekturen bakom sajten, från rå offentlig data till diagrammen: inläsning med proveniens, ett medaljongslager i dbt och DuckDB, testade stjärnscheman, statisk leverans från edge och en LLM-pipeline vars svar verifieras i kod. Siffrorna nedan läses live från dbt:s schemaexport.',
          )}
        </p>
        <nav className="tech-toc" aria-label={T('On this page', 'På sidan')}>
          {[
            ['#tech-flow', T('Data flow', 'Dataflöde')],
            ['#tech-system', T('System', 'System')],
            ['#tech-layers', T('Layers', 'Lager')],
            ['#tech-model', T('Data model', 'Datamodell')],
            ['#tech-ml', T('ML models', 'ML-modeller')],
            ['#tech-rag', 'RAG'],
            ['#tech-decisions', T('Decisions', 'Beslut')],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={(e) => {
                e.preventDefault()
                document
                  .getElementById(href.slice(1))
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      {error && (
        <p role="alert" className="theme-error">
          {error}
        </p>
      )}

      {view && schema && (
        <ul className="tech-kpis reveal">
          {(
            [
              [view.models.length, T('dbt models', 'dbt-modeller')],
              [schema.tests, T('data tests', 'datatester')],
              [schema.layers.source ?? 0, T('source tables', 'källtabeller')],
              [view.keyed, T('keyed relations', 'nyckelrelationer')],
              [view.columns, T('documented columns', 'dokumenterade kolumner')],
              [
                `${fmt(view.rows / 1e6, 1)} M`,
                T('rows in the warehouse', 'rader i lagret'),
              ],
            ] as [number | string, string][]
          ).map(([value, label]) => (
            <li key={label}>
              <strong>{typeof value === 'number' ? fmt(value) : value}</strong>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      )}

      <section
        className="tech-section reveal"
        id="tech-flow"
        aria-labelledby="tech-flow-title"
      >
        <h2 id="tech-flow-title">
          {T('Data flow, end to end', 'Dataflödet, från början till slut')}
        </h2>
        <ol className="tech-flow">
          {(
            [
              ['APIs & files', 'API:er & filer', '11 agencies'],
              ['Ingest', 'Inläsning', 'Python · SHA-256'],
              ['Bronze', 'Brons', 'dbt views'],
              ['Silver', 'Silver', 'typed · conformed'],
              ['Gold', 'Guld', 'star schemas'],
              ['Tests', 'Tester', `${schema?.tests ?? '…'} checks`],
              ['Publish', 'Publicering', 'JSON · Parquet · shards'],
              ['Edge', 'Edge', 'R2 · Workers'],
              ['React', 'React', 'charts · RAG'],
            ] as const
          ).map(([en, sv, note], i) => (
            <li key={en} style={{ ['--i' as string]: i }}>
              <b>{T(en, sv)}</b>
              <small>{note}</small>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="tech-section reveal"
        id="tech-system"
        aria-labelledby="tech-system-title"
      >
        <h2 id="tech-system-title">
          {T('The system, layer by layer', 'Systemet, lager för lager')}
        </h2>
        <div className="tech-table-wrap">
          <table className="tech-table">
            <thead>
              <tr>
                <th scope="col">{T('Layer', 'Lager')}</th>
                <th scope="col">{T('Technology', 'Teknik')}</th>
                <th scope="col">{T('Responsibility', 'Ansvar')}</th>
                <th scope="col">{T('Contract out', 'Kontrakt ut')}</th>
              </tr>
            </thead>
            <tbody>
              {SYSTEM.map(([layer, tech, what, out]) => (
                <tr key={layer}>
                  <th scope="row">{layer}</th>
                  <td className="mono">{tech}</td>
                  <td>{T(...what)}</td>
                  <td>{T(...out)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {view && (
        <section
          className="tech-section reveal"
          id="tech-layers"
          aria-labelledby="tech-layers-title"
        >
          <h2 id="tech-layers-title">
            {T('The medallion layers', 'Medaljongslagren')}
          </h2>
          <p className="tech-lead">
            {T(
              `dbt ${schema?.dbt_version} on DuckDB. Model names follow a convention the reader can rely on:`,
              `dbt ${schema?.dbt_version} på DuckDB. Modellnamnen följer en konvention som går att lita på:`,
            )}{' '}
            {view.prefixes.map(({ p, n }, i) => (
              <span key={p}>
                {i > 0 && ', '}
                <code>{p}</code> ({n})
              </span>
            ))}
            .
          </p>
          <div className="tech-table-wrap">
            <table className="tech-table numeric">
              <thead>
                <tr>
                  <th scope="col">{T('Layer', 'Lager')}</th>
                  <th scope="col">{T('Relations', 'Relationer')}</th>
                  <th scope="col">{T('Materialisation', 'Materialisering')}</th>
                  <th scope="col">{T('Columns', 'Kolumner')}</th>
                  <th scope="col">{T('Tests', 'Tester')}</th>
                  <th scope="col">{T('Rows', 'Rader')}</th>
                </tr>
              </thead>
              <tbody>
                {view.layers.map((row) => (
                  <tr key={row.layer}>
                    <th scope="row">
                      <span className={`tech-layer ${row.layer}`} />
                      {T(...LAYER_NAME[row.layer])}
                    </th>
                    <td>{fmt(row.count)}</td>
                    <td className="text">
                      {row.mats.map(([m, n]) => `${m} ${n}`).join(' · ')}
                    </td>
                    <td>{fmt(row.columns)}</td>
                    <td>{fmt(row.tests)}</td>
                    <td>{row.rows ? fmt(row.rows) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>
            {T('Subject areas across the layers', 'Ämnesområden genom lagren')}
          </h3>
          <div className="tech-table-wrap">
            <table className="tech-table numeric heat">
              <caption className="sr-only">
                {T(
                  'Number of relations per subject area and layer',
                  'Antal relationer per ämnesområde och lager',
                )}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{T('Subject', 'Ämne')}</th>
                  {LAYERS.map((layer) => (
                    <th key={layer} scope="col">
                      {T(...LAYER_NAME[layer])}
                    </th>
                  ))}
                  <th scope="col">{T('Total', 'Totalt')}</th>
                </tr>
              </thead>
              <tbody>
                {view.subjects.map((s) => (
                  <tr key={s.subject}>
                    <th scope="row" className="mono">
                      {s.subject}
                    </th>
                    {s.counts.map((c, i) => (
                      <td
                        key={i}
                        style={{
                          ['--heat' as string]: c
                            ? 0.12 + (0.88 * c) / view.cellMax
                            : 0,
                        }}
                        className={c / view.cellMax > 0.55 ? 'hot' : undefined}
                      >
                        {c || ''}
                      </td>
                    ))}
                    <td>
                      <b>{s.total}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view && (
        <section
          className="tech-section reveal"
          id="tech-model"
          aria-labelledby="tech-model-title"
        >
          <h2 id="tech-model-title">
            {T(
              'Data model: conformed dimensions',
              'Datamodell: konformerade dimensioner',
            )}
          </h2>
          <p className="tech-lead">
            {T(
              'The dimensions shared across subject areas, the key they join on and how many models reference them. Shared dimensions are what let a county, a year or a party mean the same thing in every chart.',
              'Dimensionerna som delas mellan ämnesområden, nyckeln de joinas på och hur många modeller som refererar till dem. Delade dimensioner gör att ett län, ett år eller ett parti betyder samma sak i varje diagram.',
            )}
          </p>
          <div className="tech-table-wrap">
            <table className="tech-table">
              <thead>
                <tr>
                  <th scope="col">{T('Dimension', 'Dimension')}</th>
                  <th scope="col">{T('Join key', 'Joinnyckel')}</th>
                  <th scope="col">{T('Referenced by', 'Refereras av')}</th>
                  <th scope="col">{T('Examples', 'Exempel')}</th>
                </tr>
              </thead>
              <tbody>
                {view.dimensions.map((d) => (
                  <tr key={d.name}>
                    <th scope="row" className="mono">
                      <a href={`#data-model-${d.name}`}>{d.name}</a>
                    </th>
                    <td className="mono">{[...d.keys].join(', ')}</td>
                    <td>
                      <span
                        className="tech-bar"
                        style={{
                          ['--w' as string]:
                            d.to.size / view.dimensions[0].to.size,
                        }}
                      />
                      {d.to.size}
                    </td>
                    <td className="mono small">
                      {[...d.to].slice(0, 3).join(', ')}
                      {d.to.size > 3 && ' …'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>{T('The largest relations', 'De största relationerna')}</h3>
          <div className="tech-table-wrap">
            <table className="tech-table">
              <thead>
                <tr>
                  <th scope="col">{T('Relation', 'Relation')}</th>
                  <th scope="col">{T('Layer', 'Lager')}</th>
                  <th scope="col">{T('Rows', 'Rader')}</th>
                  <th scope="col">{T('What it holds', 'Innehåll')}</th>
                </tr>
              </thead>
              <tbody>
                {view.largest.map((n) => (
                  <tr key={n.id}>
                    <th scope="row" className="mono">
                      <a href={`#data-model-${n.name}`}>{n.name}</a>
                    </th>
                    <td>{T(...LAYER_NAME[n.layer])}</td>
                    <td className="num">
                      <span
                        className="tech-bar"
                        style={{
                          ['--w' as string]:
                            (n.rows ?? 0) / (view.largest[0].rows ?? 1),
                        }}
                      />
                      {fmt(n.rows ?? 0)}
                    </td>
                    <td className="small">{n.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tech-more">
            <a href="#data-model">
              {T(
                'Every table, column, test and SQL in the data model explorer',
                'Varje tabell, kolumn, test och SQL i datamodellsutforskaren',
              )}{' '}
              →
            </a>
          </p>
        </section>
      )}

      <section
        className="tech-section reveal"
        id="tech-ml"
        aria-labelledby="tech-ml-title"
      >
        <h2 id="tech-ml-title">
          {T('Machine-learning models', 'Maskininlärningsmodeller')}
        </h2>
        <div className="tech-table-wrap">
          <table className="tech-table">
            <thead>
              <tr>
                <th scope="col">{T('Project', 'Projekt')}</th>
                <th scope="col">{T('Task', 'Uppgift')}</th>
                <th scope="col">{T('Method', 'Metod')}</th>
                <th scope="col">{T('Evaluation', 'Utvärdering')}</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  [
                    '#drugcomb',
                    ['Drug synergy', 'Läkemedelssynergi'],
                    [
                      'Regression on synergy score',
                      'Regression på synergipoäng',
                    ],
                    'Ridge, LightGBM, TensorFlow',
                    [
                      'Four split schemes (random and cold splits), Pearson, RMSE, AUPRC, calibration, y-scrambling',
                      'Fyra uppdelningar (slumpvis och kalla), Pearson, RMSE, AUPRC, kalibrering, y-scrambling',
                    ],
                  ],
                  [
                    '#thesis',
                    ['Incident clustering', 'Klustring av incidenter'],
                    ['Unsupervised NLP', 'Oövervakad NLP'],
                    'sentence-transformers, UMAP, HDBSCAN',
                    [
                      'Cluster quality against K-means, stakeholder review',
                      'Klusterkvalitet mot K-means, granskning med verksamheten',
                    ],
                  ],
                  [
                    'https://github.com/korv9/MIMII-pump-diagnostics',
                    ['Pump diagnostics', 'Pumpdiagnostik'],
                    [
                      'Audio anomaly classification',
                      'Klassificering av avvikande ljud',
                    ],
                    'Mel spectrograms, CNN (Keras)',
                    [
                      'ROC-AUC, confusion matrix; dropout and L2',
                      'ROC-AUC, förväxlingsmatris; dropout och L2',
                    ],
                  ],
                  [
                    '#rfc-drift',
                    ['Meaning drift', 'Betydelseförskjutning'],
                    ['LLM evaluation', 'LLM-utvärdering'],
                    'DuckDB lakehouse, pytest',
                    [
                      'Meaning shift across repeated LLM rewrites of 1,952 provisions',
                      'Förskjutning i innebörd vid upprepade LLM-omskrivningar av 1 952 bestämmelser',
                    ],
                  ],
                  [
                    '#tallman',
                    ['Question answering', 'Frågesvar'],
                    ['RAG with verification', 'RAG med verifiering'],
                    'BM25 + bge-m3, Claude',
                    [
                      'Six evidence labels per claim, offline eval set',
                      'Sex evidensetiketter per påstående, offline-eval',
                    ],
                  ],
                ] as [
                  string,
                  [string, string],
                  [string, string],
                  string,
                  [string, string],
                ][]
              ).map(([href, name, task, method, evaluation]) => (
                <tr key={href}>
                  <th scope="row">
                    <a
                      href={href}
                      {...(href.startsWith('http')
                        ? { target: '_blank', rel: 'noreferrer' }
                        : {})}
                    >
                      {T(...name)}
                    </a>
                  </th>
                  <td>{T(...task)}</td>
                  <td className="mono">{method}</td>
                  <td>{T(...evaluation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ml && (
          <>
            <h3>
              {T(
                'DrugComb: Pearson r by split (higher is better)',
                'DrugComb: Pearson r per uppdelning (högre är bättre)',
              )}
            </h3>
            <div className="tech-table-wrap">
              <table className="tech-table numeric heat">
                <thead>
                  <tr>
                    <th scope="col">{T('Model', 'Modell')}</th>
                    {ml.schemes.map((s) => (
                      <th key={s} scope="col" className="mono">
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ml.models.map((model) => (
                    <tr key={model}>
                      <th scope="row">
                        {ml.cell(ml.schemes[0], model)?.model_label ?? model}
                      </th>
                      {ml.schemes.map((s) => {
                        const r = ml.cell(s, model)?.pearson
                        return (
                          <td
                            key={s}
                            style={{
                              ['--heat' as string]: r ? Math.max(0, r) : 0,
                            }}
                            className={r && r > 0.55 ? 'hot' : undefined}
                          >
                            {r == null ? '—' : fmt(r, 2)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section
        className="tech-section reveal"
        id="tech-rag"
        aria-labelledby="tech-rag-title"
      >
        <h2 id="tech-rag-title">
          {T(
            'taLLMan: a RAG pipeline that checks itself',
            'taLLMan: en RAG-pipeline som kontrollerar sig själv',
          )}
        </h2>
        <p className="tech-lead">
          {T(
            'Every part degrades gracefully: without an LLM key the extractor writes the claims, without Vectorize the lexical retriever finds the passages. Verification always runs.',
            'Varje del degraderar kontrollerat: utan LLM-nyckel skriver extraktorn påståendena, utan Vectorize hittar den lexikala sökningen passagerna. Verifieringen körs alltid.',
          )}
        </p>
        <ol className="tech-steps">
          {RAG.map(([step, text, file], i) => (
            <li key={step} style={{ ['--i' as string]: i }}>
              <span className="tech-step-no">{i + 1}</span>
              <div>
                <b>{step}</b>
                <p>{T(...text)}</p>
                <code>{file}</code>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="tech-section reveal"
        id="tech-decisions"
        aria-labelledby="tech-decisions-title"
      >
        <h2 id="tech-decisions-title">
          {T('Architecture decisions', 'Arkitekturbeslut')}
        </h2>
        <div className="tech-table-wrap">
          <table className="tech-table">
            <thead>
              <tr>
                <th scope="col">{T('Decision', 'Beslut')}</th>
                <th scope="col">{T('Why', 'Varför')}</th>
                <th scope="col">{T('Trade-off', 'Avvägning')}</th>
              </tr>
            </thead>
            <tbody>
              {DECISIONS.map(([what, why, cost]) => (
                <tr key={what[0]}>
                  <th scope="row">{T(...what)}</th>
                  <td>{T(...why)}</td>
                  <td>{T(...cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tech-more">
          <a href="#status">{T('Pipeline status', 'Pipelinestatus')} →</a>
          <a
            href="https://github.com/korv9/anton-portfolio"
            target="_blank"
            rel="noreferrer"
          >
            {T('Source code on GitHub', 'Källkoden på GitHub')} ↗
          </a>
        </p>
      </section>
    </div>
  )
}
