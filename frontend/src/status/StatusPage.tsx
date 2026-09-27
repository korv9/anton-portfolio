import { useEffect, useState } from 'react'
import { fetchData, objectStorageUrl } from '../dataSource'
import { l } from '../i18n'
import '../welfare/welfare.css'

type SourceRun = {
  source_key: string
  fetched_at: string | null
  content_changed_at?: string | null
  files?: number
  bytes?: number
}
type Run = {
  exported_at: string
  github_run: { id: string | null; sha: string | null; workflow: string | null }
  dbt: {
    command: string
    generated_at: string
    dbt_version: string
    elapsed_seconds: number
    nodes: Record<string, number>
    tests: Record<string, number>
  }
  sources: SourceRun[]
  rows: Record<string, number>
  parquet_rows: Record<string, number>
}
type Delivery = {
  run_id: string
  bases: Record<string, string>
  parquet_datasets: Record<string, string[]>
}

const REPOSITORY = 'https://github.com/korv9/anton-portfolio'
const SOURCE_NAMES: Record<string, string> = {
  scb: 'SCB (AKU, befolkning)',
  fk: 'Försäkringskassan',
  fohm: 'Folkhälsomyndigheten',
  ess: 'European Social Survey',
  kolada: 'Kolada',
}
// A daily schedule, so a check older than a day and a half means a run was missed.
const STALE_HOURS = 36

function hoursSince(iso: string | null | undefined) {
  return iso ? (Date.now() - Date.parse(iso)) / 3_600_000 : Infinity
}
function ago(iso: string | null | undefined) {
  const hours = hoursSince(iso)
  if (!Number.isFinite(hours)) return '–'
  if (hours < 1) return l('under an hour ago', 'för under en timme sedan')
  if (hours < 48)
    return l(`${Math.round(hours)} h ago`, `för ${Math.round(hours)} h sedan`)
  return l(
    `${Math.round(hours / 24)} days ago`,
    `för ${Math.round(hours / 24)} dagar sedan`,
  )
}
function when(iso: string | null | undefined) {
  return iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '–'
}
function Badge({ state }: { state: 'ok' | 'stale' | 'failing' }) {
  const text = {
    ok: l('✓ Healthy', '✓ Frisk'),
    stale: l('! Stale', '! Inaktuell'),
    failing: l('✕ Failing', '✕ Fallerar'),
  }[state]
  return <span className={`status-badge ${state}`}>{text}</span>
}

/**
 * The data platform's own dashboard: when each source was last checked and last changed,
 * how the last dbt build went, what the warehouse holds and what the site delivers.
 * The live run record comes from object storage, replaced on every scheduled run; the
 * committed copy is the fallback.
 */
export default function StatusPage() {
  const [run, setRun] = useState<Run | null>(null)
  const [live, setLive] = useState(false)
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [jobYears, setJobYears] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    objectStorageUrl('status/welfare-run.json')
      .then((url) => fetch(url, { cache: 'no-store' }))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        setLive(true)
        return response.json()
      })
      .catch(() =>
        fetchData('welfare/run.json').then((response) => {
          if (!response.ok)
            throw new Error(`welfare/run.json: HTTP ${response.status}`)
          return response.json()
        }),
      )
      .then(setRun)
      .catch((reason: Error) => setError(reason.message))
    fetchData('delivery.json')
      .then((response) => response.json())
      .then(setDelivery)
      .catch(() => setDelivery(null))
    fetchData('gold/marts/jobs.json')
      .then((response) => response.json())
      .then((jobs) => setJobYears(jobs.years ?? []))
      .catch(() => setJobYears([]))
  }, [])

  const failing = run
    ? (run.dbt.tests.fail ?? 0) + (run.dbt.tests.error ?? 0) > 0
    : false
  const stale = run
    ? run.sources.some((s) => hoursSince(s.fetched_at) > STALE_HOURS)
    : false
  const overall = failing ? 'failing' : stale ? 'stale' : 'ok'
  const lastJobYear = jobYears.at(-1)

  return (
    <div className="project-page status-page">
      <div className="page-lead">
        <p className="eyebrow">
          {l('Data platform · operations', 'Dataplattform · drift')}
        </p>
        <h1>{l('Pipeline status', 'Pipelinens status')}</h1>
        <p>
          {l(
            'Every day a scheduled workflow fetches the public sources, builds and tests the DuckDB warehouse with dbt, exports what the site reads, uploads it to object storage and republishes the site when data changed. This page reads that run record.',
            'Varje dag hämtar ett schemalagt flöde de öppna källorna, bygger och testar DuckDB-lagret med dbt, exporterar det sajten läser, laddar upp till objektlagring och publicerar om sajten när data ändrats. Den här sidan läser körningens logg.',
          )}
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      {run && (
        <div className="reports">
          <section className="report status-summary">
            <Badge state={overall} />
            <dl>
              <div>
                <dt>{l('Last run', 'Senaste körning')}</dt>
                <dd>
                  {when(run.exported_at)}{' '}
                  <small>({ago(run.exported_at)})</small>
                </dd>
              </div>
              <div>
                <dt>{l('Tests', 'Tester')}</dt>
                <dd>
                  {run.dbt.tests.pass ?? 0} {l('passed', 'godkända')}
                  {failing &&
                    `, ${(run.dbt.tests.fail ?? 0) + (run.dbt.tests.error ?? 0)} ${l('failed', 'fallerade')}`}
                </dd>
              </div>
              <div>
                <dt>{l('Record', 'Källa för sidan')}</dt>
                <dd>
                  {live
                    ? l('live, from object storage', 'live, från objektlagring')
                    : l(
                        'committed copy (live record unavailable)',
                        'committad kopia (live-logg saknas)',
                      )}
                </dd>
              </div>
              {run.github_run.id && (
                <div>
                  <dt>{l('Workflow run', 'Körning')}</dt>
                  <dd>
                    <a
                      href={`${REPOSITORY}/actions/runs/${run.github_run.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      #{run.github_run.id} ↗
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="report">
            <h2>{l('Sources', 'Källor')}</h2>
            <div className="table-scroll">
              <table className="welfare-table">
                <thead>
                  <tr>
                    <th scope="col">{l('Source', 'Källa')}</th>
                    <th scope="col">{l('Checked', 'Kontrollerad')}</th>
                    <th scope="col">
                      {l('Content last changed', 'Innehåll senast ändrat')}
                    </th>
                    <th scope="col">{l('Files', 'Filer')}</th>
                    <th scope="col">{l('Size', 'Storlek')}</th>
                    <th scope="col">{l('State', 'Läge')}</th>
                  </tr>
                </thead>
                <tbody>
                  {run.sources.map((source) => (
                    <tr key={source.source_key}>
                      <th scope="row">
                        {SOURCE_NAMES[source.source_key] ?? source.source_key}
                      </th>
                      <td>
                        {when(source.fetched_at)}{' '}
                        <small>{ago(source.fetched_at)}</small>
                      </td>
                      <td>{when(source.content_changed_at)}</td>
                      <td>{source.files ?? '–'}</td>
                      <td>
                        {source.bytes
                          ? `${(source.bytes / 1_048_576).toFixed(1)} MB`
                          : '–'}
                      </td>
                      <td>
                        <Badge
                          state={
                            hoursSince(source.fetched_at) > STALE_HOURS
                              ? 'stale'
                              : 'ok'
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">JobTech {l('archives', 'arkiv')}</th>
                    <td colSpan={4}>
                      {lastJobYear
                        ? l(
                            `Data through ${lastJobYear}. Checked monthly; the ${lastJobYear + 1} archive is published some months after the year ends.`,
                            `Data till och med ${lastJobYear}. Kontrolleras månadsvis; arkivet för ${lastJobYear + 1} publiceras några månader efter årsskiftet.`,
                          )
                        : '–'}
                    </td>
                    <td>
                      <Badge state="ok" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="status-grid">
            <section className="report">
              <h2>dbt</h2>
              <dl className="status-list">
                <div>
                  <dt>{l('Command', 'Kommando')}</dt>
                  <dd>
                    <code>dbt {run.dbt.command}</code> · {run.dbt.dbt_version}
                  </dd>
                </div>
                <div>
                  <dt>{l('Nodes', 'Noder')}</dt>
                  <dd>
                    {Object.entries(run.dbt.nodes)
                      .map(([kind, count]) => `${count} ${kind}s`)
                      .join(' · ')}
                  </dd>
                </div>
                <div>
                  <dt>{l('Duration', 'Tid')}</dt>
                  <dd>{run.dbt.elapsed_seconds} s</dd>
                </div>
                <div>
                  <dt>{l('Tests', 'Tester')}</dt>
                  <dd>
                    {Object.entries(run.dbt.tests)
                      .filter(([, count]) => count)
                      .map(([status, count]) => `${count} ${status}`)
                      .join(' · ')}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="report">
              <h2>{l('Warehouse rows', 'Rader i lagret')}</h2>
              <dl className="status-list">
                {Object.entries(run.rows).map(([table, count]) => (
                  <div key={table}>
                    <dt>
                      <code>gold.{table}</code>
                    </dt>
                    <dd>{count.toLocaleString()}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="report">
              <h2>{l('Delivery', 'Leverans')}</h2>
              <dl className="status-list">
                <div>
                  <dt>{l('Catalogue run', 'Katalogens run_id')}</dt>
                  <dd>
                    <code>{delivery?.run_id ?? '–'}</code>
                  </dd>
                </div>
                {delivery &&
                  Object.entries(delivery.parquet_datasets).map(
                    ([name, parts]) => (
                      <div key={name}>
                        <dt>
                          <code>{name}</code>
                        </dt>
                        <dd>
                          {parts.length} {l('Parquet parts', 'Parquet-delar')}
                        </dd>
                      </div>
                    ),
                  )}
                <div>
                  <dt>
                    {l('Browser Parquet rows', 'Parquet-rader i webbläsaren')}
                  </dt>
                  <dd>
                    {Object.values(run.parquet_rows)
                      .reduce((sum, count) => sum + count, 0)
                      .toLocaleString()}
                  </dd>
                </div>
              </dl>
              <p>
                <a
                  href={`${REPOSITORY}/actions`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {l('All workflow runs ↗', 'Alla körningar ↗')}
                </a>
              </p>
            </section>
          </div>
        </div>
      )}
      {!run && !error && (
        <div className="loading">{l('Loading…', 'Laddar…')}</div>
      )}
    </div>
  )
}
