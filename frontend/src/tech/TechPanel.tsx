/**
 * The projects page (#projekt): the platform behind the projects first, then the projects to
 * choose from, then the machinery. In order: what the platform holds, how the pipeline works
 * step by step and per project, the projects, the scheduled runs and fetches, quality checks
 * and delivery, the data model (an ER diagram per subject and every table with its columns),
 * and every cluster map.
 *
 * Nothing here is written by hand: the runs come from GitHub Actions, the rest from the files
 * the pipeline exports (schema/er.json, schema/models.json, architecture/graph.json,
 * quality/summary.json, welfare/run.json), so a new table or script shows up on its own.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { deliveryState, objectStorageUrl } from '../dataSource'
import { fetchJson } from '../welfare/data'
import { Stacked } from '../charts/Compare'
import { l } from '../i18n'
import ErDiagram from './ErDiagram'
import PipelineTour, { type TourNode } from './PipelineTour'
import ProjectList from '../projects/ProjectsPage'
import type { ErModel } from './erLayout'
import './tech.css'

const UmapGallery = lazy(() => import('./UmapGallery'))

const REPO = 'korv9/anton-portfolio'
const num = (n: number) => n.toLocaleString('en-GB')
const day = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 16).replace('T', ' ') : '–'
const size = (bytes: number) =>
  bytes > 1e6
    ? `${(bytes / 1e6).toFixed(1)} MB`
    : `${Math.round(bytes / 1e3)} kB`
function ago(iso: string) {
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min ago`
  if (hours < 48) return `${Math.round(hours)} h ago`
  return `${Math.round(hours / 24)} days ago`
}

/** Loads a published file; null while loading, 'error' when it cannot be read. */
function useFile<T>(path: string) {
  const [data, setData] = useState<T | 'error' | null>(null)
  useEffect(() => {
    fetchJson<T>(path).then(setData, () => setData('error'))
  }, [path])
  return data
}
const ok = <T,>(d: T | 'error' | null): d is T => d != null && d !== 'error'

// ---------- Ingestion: the scheduled runs, live from GitHub Actions ----------
type Run = {
  id: number
  status: string
  conclusion: string | null
  event: string
  run_started_at: string
  updated_at: string
  html_url: string
  head_sha: string
}
type Workflow = { id: number; name: string; path: string; runs: Run[] }

async function loadWorkflows(): Promise<Workflow[]> {
  // GitHub allows 60 unsigned requests an hour; keep the answer for the session.
  const key = 'tech-workflows'
  try {
    const kept = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (kept && Date.now() - kept.at < 5 * 60e3) return kept.workflows
  } catch {
    // No session storage: ask again.
  }
  const api = async (path: string) => {
    const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`)
    if (!response.ok) throw new Error(`GitHub: HTTP ${response.status}`)
    return response.json()
  }
  const list = (await api('actions/workflows')).workflows as Omit<
    Workflow,
    'runs'
  >[]
  const workflows = await Promise.all(
    list
      .filter((w) => w.path.startsWith('.github/workflows/'))
      .map(async (w) => ({
        id: w.id,
        name: w.name,
        path: w.path,
        runs: (await api(`actions/workflows/${w.id}/runs?per_page=14`))
          .workflow_runs as Run[],
      })),
  )
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), workflows }))
  } catch {
    // Nothing to keep it in.
  }
  return workflows
}

const stateOf = (run: Run) =>
  run.status !== 'completed' ? 'running' : (run.conclusion ?? 'unknown')

function Runs() {
  const [workflows, setWorkflows] = useState<Workflow[] | 'error' | null>(null)
  useEffect(() => {
    loadWorkflows().then(setWorkflows, () => setWorkflows('error'))
  }, [])
  if (workflows === null) return <p className="tech-note">Reading GitHub…</p>
  if (workflows === 'error')
    return (
      <p className="tech-note" role="status">
        The run history could not be read from GitHub just now (the open API
        allows 60 requests an hour).{' '}
        <a href={`https://github.com/${REPO}/actions`}>Open GitHub Actions</a>
      </p>
    )
  const sorted = [...workflows].sort((a, b) =>
    (b.runs[0]?.run_started_at ?? '').localeCompare(
      a.runs[0]?.run_started_at ?? '',
    ),
  )
  return (
    <ul className="runs">
      {sorted.map((w) => {
        const last = w.runs[0]
        const took = last
          ? Math.round(
              (new Date(last.updated_at).getTime() -
                new Date(last.run_started_at).getTime()) /
                6e4,
            )
          : 0
        return (
          <li key={w.id} data-state={last ? stateOf(last) : 'never'}>
            <div className="runs-head">
              <b>{w.name}</b>
              <span className="runs-state">
                {last ? stateOf(last) : 'never run'}
              </span>
            </div>
            <p className="tech-meta">
              {w.path.replace('.github/workflows/', '')}
              {last &&
                ` · ${ago(last.run_started_at)} · ${took} min · ${last.event} · ${last.head_sha.slice(0, 7)}`}
            </p>
            <ol className="runs-strip" aria-label={`Latest runs of ${w.name}`}>
              {[...w.runs].reverse().map((run) => (
                <li key={run.id}>
                  <a
                    href={run.html_url}
                    data-state={stateOf(run)}
                    title={`${day(run.run_started_at)}: ${stateOf(run)}`}
                  >
                    <span className="visually-hidden">
                      {day(run.run_started_at)}: {stateOf(run)}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </li>
        )
      })}
    </ul>
  )
}

// ---------- The architecture graph: sources, scripts and what each subject holds ----------
type GraphNode = TourNode & {
  domain: string
  url?: string
  description?: string
}
type Graph = {
  nodes: GraphNode[]
  edges: { source: string; target: string; type: string }[]
  domains: { id: string; label: string; counts: Record<string, number> }[]
  generated_at: string
  dbt_version: string
}

function Scripts({ graph }: { graph: Graph }) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const scripts = graph.nodes.filter((n) => n.type === 'ingestion')
  const joined = (id: string, side: 'source' | 'target', type: string) =>
    graph.edges
      .filter((e) => e[side === 'source' ? 'target' : 'source'] === id)
      .map((e) => byId.get(e[side]))
      .filter((n): n is GraphNode => n?.type === type)
  return (
    <div className="tech-scroll" tabIndex={0}>
      <table className="tech-table">
        <thead>
          <tr>
            <th scope="col">Script</th>
            <th scope="col">Subject</th>
            <th scope="col">Reads from</th>
            <th scope="col">Writes raw</th>
            <th scope="col">What it fetches</th>
          </tr>
        </thead>
        <tbody>
          {scripts.map((s) => (
            <tr key={s.id}>
              <th scope="row">
                <a href={`https://github.com/${REPO}/tree/main/${s.path}`}>
                  {s.path}
                </a>
              </th>
              <td>{s.domain}</td>
              <td>
                {joined(s.id, 'source', 'source')
                  .map((n) => n.label)
                  .join(', ') || '–'}
              </td>
              <td>
                {joined(s.id, 'target', 'raw')
                  .map((n) => n.label)
                  .join(', ') || '–'}
              </td>
              <td>{s.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// What platform/publish/ingest_status.py records after each subject's ingest steps.
type Fetched = {
  source_key: string
  fetched_at: string | null
  content_changed_at?: string | null
  files?: number
  bytes?: number
  fetched?: number
  changed?: number
  errors?: number
}
type Ingestion = {
  subjects: Record<
    string,
    {
      recorded_at: string
      outcome: 'success' | 'failure'
      error: string | null
      github_run: string | null
      sources: Fetched[]
    }
  >
}

function Fetches() {
  const [status, setStatus] = useState<Ingestion | 'error' | null>(null)
  useEffect(() => {
    objectStorageUrl('status/ingestion.json')
      .then((url) => fetch(url, { cache: 'no-cache' }))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setStatus, () => setStatus('error'))
  }, [])
  if (status === null) return reading
  if (status === 'error')
    return (
      <p className="tech-note">
        No ingestion has been recorded here yet. The pipeline writes
        status/ingestion.json after each subject’s ingest steps.
      </p>
    )
  const subjects = Object.entries(status.subjects).sort((a, b) =>
    b[1].recorded_at.localeCompare(a[1].recorded_at),
  )
  return (
    <div className="tech-scroll" tabIndex={0}>
      <table className="tech-table fetches">
        <thead>
          <tr>
            <th scope="col">Subject</th>
            <th scope="col">Ingest</th>
            <th scope="col">Source</th>
            <th scope="col">Last fetched</th>
            <th scope="col">Content last changed</th>
            <th scope="col" className="num">
              Files
            </th>
            <th scope="col" className="num">
              Size
            </th>
            <th scope="col" className="num">
              This run: fetched, changed, failed
            </th>
          </tr>
        </thead>
        <tbody>
          {subjects.flatMap(([name, s]) => {
            const sources = s.sources.length
              ? s.sources
              : [{ source_key: '–', fetched_at: null }]
            return sources.map((f, i) => (
              <tr key={`${name}-${f.source_key}`} data-state={s.outcome}>
                {i === 0 && (
                  <>
                    <th scope="row" rowSpan={sources.length}>
                      {name}
                    </th>
                    <td rowSpan={sources.length}>
                      <span className="fetches-state">{s.outcome}</span>{' '}
                      {s.github_run ? (
                        <a href={s.github_run}>{ago(s.recorded_at)}</a>
                      ) : (
                        ago(s.recorded_at)
                      )}
                      {s.error && <p className="tech-meta">{s.error}</p>}
                    </td>
                  </>
                )}
                <td>{f.source_key}</td>
                <td>{day(f.fetched_at)}</td>
                <td>{day(f.content_changed_at)}</td>
                <td className="num">{f.files == null ? '–' : num(f.files)}</td>
                <td className="num">{f.bytes == null ? '–' : size(f.bytes)}</td>
                <td className="num">
                  {f.fetched == null
                    ? '–'
                    : `${num(f.fetched)}, ${num(f.changed ?? 0)}, ${num(f.errors ?? 0)}`}
                </td>
              </tr>
            ))
          })}
        </tbody>
      </table>
    </div>
  )
}

type WelfareRun = {
  exported_at: string
  dbt: {
    command: string
    generated_at: string
    dbt_version: string
    elapsed_seconds: number
    nodes: Record<string, number>
    tests: Record<string, number>
  }
  sources: {
    source_key: string
    fetched_at: string
    content_changed_at: string
    files: number
    bytes: number
  }[]
}

function RunRecord({ run }: { run: WelfareRun }) {
  const t = run.dbt.tests
  return (
    <>
      <p className="tech-meta">
        Exported {day(run.exported_at)} · dbt {run.dbt.command}{' '}
        {run.dbt.dbt_version}, {run.dbt.elapsed_seconds} s ·{' '}
        {num(run.dbt.nodes.model ?? 0)} models, {num(run.dbt.nodes.seed ?? 0)}{' '}
        seeds · tests: {t.pass} passed, {t.fail} failed, {t.error} errors,{' '}
        {t.warn} warnings
      </p>
      <div className="tech-scroll" tabIndex={0}>
        <table className="tech-table">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Fetched</th>
              <th scope="col">Content last changed</th>
              <th scope="col" className="num">
                Files
              </th>
              <th scope="col" className="num">
                Size
              </th>
            </tr>
          </thead>
          <tbody>
            {run.sources.map((s) => (
              <tr key={s.source_key}>
                <th scope="row">{s.source_key}</th>
                <td>{day(s.fetched_at)}</td>
                <td>{day(s.content_changed_at)}</td>
                <td className="num">{num(s.files)}</td>
                <td className="num">{size(s.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ---------- Pipeline ----------
const STAGES: [string, string][] = [
  ['sources', 'Sources'],
  ['ingestion', 'Ingestion'],
  ['raw', 'Raw'],
  ['seeds', 'Seeds'],
  ['models', 'dbt models'],
  ['gold', 'Gold'],
  ['ml', 'ML'],
  ['delivery', 'Delivery'],
  ['products', 'Pages'],
]

function Stages({ graph }: { graph: Graph }) {
  const top = Object.fromEntries(
    STAGES.map(([key]) => [
      key,
      Math.max(1, ...graph.domains.map((d) => d.counts[key] ?? 0)),
    ]),
  )
  return (
    <div className="tech-scroll" tabIndex={0}>
      <table className="tech-table stages">
        <caption className="visually-hidden">
          What each subject holds at each stage, from source to page
        </caption>
        <thead>
          <tr>
            <th scope="col">Subject</th>
            {STAGES.map(([key, label]) => (
              <th scope="col" key={key} className="num">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {graph.domains.map((d) => (
            <tr key={d.id}>
              <th scope="row">{d.label}</th>
              {STAGES.map(([key]) => {
                const v = d.counts[key] ?? 0
                return (
                  <td
                    key={key}
                    className="num"
                    style={{ ['--share' as string]: v / top[key] }}
                  >
                    {v || '·'}
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

type Quality = {
  products: { product_id: string; label_en: string }[]
  product_dimensions: {
    product_id: string
    pass_count: number
    warning_count: number
    fail_count: number
    not_measured_count: number
    not_applicable_count: number
  }[]
  run: { evaluated_at: string; checks: number; dbt: string }
}

function Checks({ quality }: { quality: Quality }) {
  const rows = quality.products.map((p) => {
    const own = quality.product_dimensions.filter(
      (d) => d.product_id === p.product_id,
    )
    const sum = (k: keyof (typeof own)[number]) =>
      own.reduce((s, d) => s + (d[k] as number), 0)
    const values = [
      sum('pass_count'),
      sum('warning_count'),
      sum('fail_count'),
      sum('not_measured_count') + sum('not_applicable_count'),
    ]
    return {
      key: p.product_id,
      label: p.label_en,
      values,
      text: `${values[0]} / ${values.reduce((s, v) => s + v, 0)}`,
    }
  })
  return (
    <Stacked
      rows={rows.filter((r) => r.values.some(Boolean))}
      parts={[
        { label: 'Passed', colour: 'var(--color-chart-neutral)' },
        { label: 'Warning', colour: 'var(--color-chart-muted)' },
        { label: 'Failed', colour: 'var(--negative)' },
        { label: 'Not measured', colour: 'var(--color-panel)' },
      ]}
      format={(v) => String(v)}
      label="Quality checks per product, by outcome"
    />
  )
}

// ---------- Every table, with its columns ----------
type Model = {
  id: string
  name: string
  kind: string
  layer: string
  subject: string | null
  materialized: string | null
  description: string
  path: string | null
  reads: string[]
  read_by: string[]
  tests: string[]
  columns: { name: string; type: string | null; tests: string[] }[]
  rows: number | null
}
type Models = {
  dbt_version: string
  layers: Record<string, number>
  tests: number
  nodes: Model[]
}

const short = (id: string) => id.split('.').at(-1)!

function Tables({ models }: { models: Models }) {
  const [query, setQuery] = useState('')
  const [layer, setLayer] = useState('')
  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () =>
      models.nodes
        .filter((n) => !layer || n.layer === layer)
        .filter(
          (n) =>
            !q ||
            n.name.toLowerCase().includes(q) ||
            n.columns.some((c) => c.name.toLowerCase().includes(q)),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [models, q, layer],
  )
  return (
    <>
      <div className="tech-filters">
        <label>
          Search tables and columns
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="fct_, party, region_code…"
          />
        </label>
        <label>
          Layer
          <select value={layer} onChange={(e) => setLayer(e.target.value)}>
            <option value="">All ({models.nodes.length})</option>
            {Object.entries(models.layers).map(([key, count]) => (
              <option key={key} value={key}>
                {key} ({count})
              </option>
            ))}
          </select>
        </label>
        <p className="tech-meta" aria-live="polite">
          {shown.length} tables
        </p>
      </div>
      <ul className="tables">
        {shown.map((n) => (
          <li key={n.id}>
            <details>
              <summary>
                <b>{n.name}</b>
                <span className="tech-meta">
                  {n.layer}
                  {n.subject ? ` · ${n.subject}` : ''}
                  {n.columns.length ? ` · ${n.columns.length} columns` : ''}
                  {n.rows != null ? ` · ${num(n.rows)} rows` : ''}
                  {n.tests.length ? ` · ${n.tests.length} tests` : ''}
                </span>
              </summary>
              {n.description && <p>{n.description}</p>}
              <p className="tech-meta">
                {n.path ?? 'declared source'}
                {n.reads.length
                  ? ` · reads ${n.reads.map(short).join(', ')}`
                  : ''}
                {n.read_by.length
                  ? ` · read by ${n.read_by.map(short).join(', ')}`
                  : ''}
              </p>
              {n.columns.length > 0 && (
                <table className="tech-table">
                  <thead>
                    <tr>
                      <th scope="col">Column</th>
                      <th scope="col">Type</th>
                      <th scope="col">Tests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {n.columns.map((c) => (
                      <tr key={c.name}>
                        <th scope="row">{c.name}</th>
                        <td>{c.type ?? '–'}</td>
                        <td>{c.tests.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </details>
          </li>
        ))}
      </ul>
    </>
  )
}

// ---------- The page ----------
const SECTIONS: [string, () => string][] = [
  ['tech-pipeline', () => l('How it works', 'Så fungerar det')],
  ['projects', () => l('Projects', 'Projekt')],
  ['tech-ingestion', () => l('Runs', 'Körningar')],
  ['tech-quality', () => l('Quality', 'Kvalitet')],
  ['tech-er', () => l('Data model', 'Datamodell')],
  ['tech-tables', () => l('Tables', 'Tabeller')],
  ['tech-maps', () => l('Cluster maps', 'Klusterkartor')],
]

const unread = <p className="tech-note">This file could not be read.</p>
const reading = <p className="tech-note">Loading…</p>

export default function TechPanel() {
  const graph = useFile<Graph>('architecture/graph.json')
  const er = useFile<ErModel>('schema/er.json')
  const models = useFile<Models>('schema/models.json')
  const summary = useFile<Record<string, number>>('schema/summary.json')
  const quality = useFile<Quality>('quality/summary.json')
  const run = useFile<WelfareRun>('welfare/run.json')
  const [delivery, setDelivery] = useState<Awaited<
    ReturnType<typeof deliveryState>
  > | null>(null)
  useEffect(() => {
    deliveryState().then(setDelivery, () => setDelivery(null))
  }, [])
  const [domain, setDomain] = useState('')
  const domains = ok(er)
    ? er.domains.filter((d) => er.tables.some((t) => t.domain === d.key))
    : []
  const chosen = domains.find((d) => d.key === domain) ?? domains[0]
  const part = (d: unknown, body: () => React.ReactNode) =>
    d === null ? reading : d === 'error' ? unread : body()
  const layer = (...keys: string[]) =>
    ok(graph) ? graph.nodes.filter((n) => keys.includes(n.layer)).length : 0
  return (
    <article className="tech projects-page" id="projekt">
      <header className="tech-head">
        <h1>{l('Projects', 'Projekt')}</h1>
        <p>
          {l(
            'Most of these projects run on one data platform I built: public sources fetched on a schedule, built and tested with dbt, passed through machine learning where the data is text, and published to the pages. First how it works, then the projects, then the machinery itself.',
            'De flesta av projekten körs på en dataplattform jag har byggt: offentliga källor som hämtas på schema, byggs och testas med dbt, går genom maskininlärning där datan är text och publiceras till sidorna. Först hur det fungerar, sedan projekten, sedan själva maskineriet.',
          )}
        </p>
        {ok(graph) && ok(summary) && (
          <dl className="tech-figures">
            <div>
              <dt>{l('Public sources', 'Offentliga källor')}</dt>
              <dd>{num(layer('source'))}</dd>
            </div>
            <div>
              <dt>{l('dbt models', 'dbt-modeller')}</dt>
              <dd>{num(layer('bronze', 'silver', 'gold'))}</dd>
            </div>
            <div>
              <dt>{l('dbt tests', 'dbt-tester')}</dt>
              <dd>{num(summary.tests)}</dd>
            </div>
            <div>
              <dt>{l('Rows in the warehouse', 'Rader i lagret')}</dt>
              <dd>{num(summary.rows)}</dd>
            </div>
            <div>
              <dt>{l('ML stages', 'ML-steg')}</dt>
              <dd>{num(layer('ml'))}</dd>
            </div>
          </dl>
        )}
        <nav aria-label={l('Sections', 'Avsnitt')}>
          {SECTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() =>
                document
                  .getElementById(id)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              {label()}
            </button>
          ))}
        </nav>
      </header>

      <section id="tech-pipeline" aria-labelledby="tech-pipeline-title">
        <h2 id="tech-pipeline-title">
          {l('How the pipeline works', 'Så fungerar pipelinen')}
        </h2>
        <p className="tech-note">
          {l(
            'Seven steps from a public source to a page. Choose a step to see what it does and what it holds; the numbers are counted from the code and the dbt project.',
            'Sju steg från en offentlig källa till en sida. Välj ett steg för att se vad det gör och vad det rymmer; siffrorna räknas fram ur koden och dbt-projektet.',
          )}
        </p>
        {part(graph, () => (
          <PipelineTour nodes={(graph as Graph).nodes} />
        ))}
      </section>

      <section id="projects" aria-labelledby="projects-title">
        <h2 id="projects-title">{l('Choose a project', 'Välj ett projekt')}</h2>
        <p className="tech-note">
          {l(
            'Each project opens on its charts. Under a project on the platform: what it holds in the pipeline.',
            'Varje projekt öppnas på sina grafer. Under ett projekt på plattformen: vad det rymmer i pipelinen.',
          )}
        </p>
        <ProjectList domains={ok(graph) ? graph.domains : []} />
        <h3>
          {l('Each project, stage by stage', 'Varje projekt, steg för steg')}
        </h3>
        {part(graph, () => (
          <>
            <Stages graph={graph as Graph} />
            <p className="tech-meta">
              Built {day((graph as Graph).generated_at)} from the dbt manifest,
              the ingestion folders and the delivery specs.
            </p>
          </>
        ))}
      </section>

      <section id="tech-ingestion" aria-labelledby="tech-ingestion-title">
        <h2 id="tech-ingestion-title">{l('Runs', 'Körningar')}</h2>
        <h3>Scheduled runs</h3>
        <p className="tech-note">
          Each square is one run of a GitHub Actions workflow, oldest to the
          left; press it for the log.
        </p>
        <Runs />
        <h3>Fetches per subject</h3>
        <Fetches />
        <h3>Sources and scripts</h3>
        {part(graph, () => (
          <Scripts graph={graph as Graph} />
        ))}
        <h3>Latest run record with dbt tests: public statistics</h3>
        {part(run, () => (
          <RunRecord run={run as WelfareRun} />
        ))}
      </section>

      <section id="tech-quality" aria-labelledby="tech-quality-title">
        <h2 id="tech-quality-title">
          {l('Quality and delivery', 'Kvalitet och leverans')}
        </h2>
        <h3>Quality checks</h3>
        {part(quality, () => (
          <>
            <Checks quality={quality as Quality} />
            <p className="tech-meta">
              {(quality as Quality).run.checks} checks, evaluated{' '}
              {day((quality as Quality).run.evaluated_at)}
            </p>
          </>
        ))}
        <h3>Delivery in use</h3>
        {delivery ? (
          <p className="tech-meta">
            {delivery.mode === 'remote'
              ? `Release approved ${day(delivery.activatedAt)}`
              : 'Local files (no approved release in use on this address)'}
            {delivery.groups
              ? ` · groups: ${Object.keys(delivery.groups).join(', ')}`
              : ''}
            {delivery.lastRefreshError
              ? ` · last refresh failed: ${delivery.lastRefreshError}`
              : ''}
          </p>
        ) : (
          reading
        )}
      </section>

      <section id="tech-er" aria-labelledby="tech-er-title">
        <h2 id="tech-er-title">ER diagrams</h2>
        {part(er, () => {
          const model = er as ErModel
          return (
            <>
              <p className="tech-note">
                {model.method.tables} {model.method.relations}
              </p>
              <div className="tech-pick" role="group" aria-label="Subject">
                {domains.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    aria-pressed={d.key === chosen?.key}
                    onClick={() => setDomain(d.key)}
                  >
                    {d.en}{' '}
                    <span>
                      {model.tables.filter((t) => t.domain === d.key).length}
                    </span>
                  </button>
                ))}
              </div>
              {chosen && <ErDiagram model={model} domain={chosen.key} />}
              <p className="tech-meta">
                {model.tables.length} tables, {model.relations.length} relations
                · exported {model.generated} by platform/publish/export_er.py
              </p>
            </>
          )
        })}
      </section>

      <section id="tech-tables" aria-labelledby="tech-tables-title">
        <h2 id="tech-tables-title">Tables and columns</h2>
        {part(models, () => (
          <Tables models={models as Models} />
        ))}
      </section>

      <section id="tech-maps" aria-labelledby="tech-maps-title">
        <h2 id="tech-maps-title">Cluster maps</h2>
        <p className="tech-note">
          Every UMAP and cluster map on the site. Press one to open it full
          size.
        </p>
        <Suspense fallback={reading}>
          <UmapGallery />
        </Suspense>
      </section>
    </article>
  )
}
