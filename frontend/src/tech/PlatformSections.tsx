/**
 * The data platform, a part of the projects hub (#projects-platform): what it does, the pipeline,
 * Ask the platform, 30 days of run health with the cause of each red run, the same pattern on
 * Microsoft Fabric (the DiVA lakehouse) and what each part maps to in another stack.
 *
 * Every number is read at load: the status strip from status/ingestion.json in object storage
 * (platform/publish/ingest_status.py), the pipeline from architecture/graph.json, the runs and
 * failure issues from GitHub, the MERGE counts from the lakehouse repository's docs/demo.md.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import AskThePlatform from '../ask/AskThePlatform'
import { loadStatus, SUBJECTS, type Entry } from '../meaning/freshness'
import PipelineTour from './PipelineTour'
import type { Graph } from './PipelineTables'
import { RunHealth } from './RunHealth'
import { FabricLakehouse } from './FabricLakehouse'
import { REPO, ago, num, ok, reading, unread, useFile } from './techData'
import './tech.css'

const BLOB = `https://github.com/${REPO}/blob/main`

type Status = Record<
  string,
  Entry & { sources?: { source_key: string; fetched_at?: string | null }[] }
>

/** Subject -> its fresh_within in hours, as freshness.ts mirrors platform/pipeline.yml. */
const SLA = new Map(Object.values(SUBJECTS))

export function StatusStrip() {
  const [status, setStatus] = useState<Status | 'error' | null>(null)
  useEffect(() => {
    loadStatus().then((s) => setStatus((s as Status) ?? 'error'))
  }, [])
  if (status === null) return reading
  if (status === 'error')
    return (
      <p className="tech-note" role="status">
        {l(
          'The live run status could not be read just now.',
          'Den levande körstatusen kunde inte läsas just nu.',
        )}
      </p>
    )
  const entries = Object.entries(status)
  if (!entries.length) return null
  const [lastName, last] = entries.reduce((a, b) =>
    (b[1].recorded_at ?? '') > (a[1].recorded_at ?? '') ? b : a,
  )
  const passed = entries.filter(([, e]) => e.outcome === 'success').length
  const failed = entries
    .filter(([, e]) => e.outcome && e.outcome !== 'success')
    .map(([name]) => name.replace(/_/g, ' '))
  const sources = new Set(
    entries.flatMap(([, e]) =>
      (e.sources ?? []).filter((s) => s.fetched_at).map((s) => s.source_key),
    ),
  )
  const timed = entries.filter(([name]) => SLA.has(name))
  const fresh = timed.filter(([name, e]) => {
    const at = e.outcome === 'success' ? e.recorded_at : e.last_success_at
    return at && Date.now() - Date.parse(at) <= SLA.get(name)! * 36e5
  }).length
  return (
    <dl className="tech-figures platform-status" data-testid="platform-status">
      <div>
        <dt>{l('Last run', 'Senaste körning')}</dt>
        <dd>{last.recorded_at ? ago(last.recorded_at) : '–'}</dd>
        <dd className="tech-meta">
          {last.github_run ? (
            <a href={last.github_run}>{lastName.replace(/_/g, ' ')}</a>
          ) : (
            lastName
          )}
          ,{' '}
          {last.outcome === 'success'
            ? l('passed', 'gick igenom')
            : l('failed', 'föll')}
        </dd>
      </div>
      <div>
        <dt>{l('Subjects passing', 'Ämnen som gick igenom')}</dt>
        <dd>
          {num(passed)}/{num(entries.length)}
        </dd>
        <dd className="tech-meta">
          {l('each by its latest run', 'var och ett vid sin senaste körning')}
          {failed.length > 0 &&
            `; ${l('failed', 'föll')}: ${failed.join(', ')}`}
        </dd>
      </div>
      <div>
        <dt>{l('Source feeds', 'Källflöden')}</dt>
        <dd>{num(sources.size)}</dd>
        <dd className="tech-meta">
          {l('with a fetch log', 'med hämtningslogg')}
        </dd>
      </div>
      <div>
        <dt>{l('Within update limit', 'Inom uppdateringsgränsen')}</dt>
        <dd>
          {num(fresh)}/{num(timed.length)}
        </dd>
        <dd className="tech-meta">
          {l(
            'subjects with a limit, from each last success',
            'ämnen med en gräns, från varje senaste lyckade körning',
          )}
        </dd>
      </div>
    </dl>
  )
}

const STACK: [string, string, () => string][] = [
  [
    'DuckDB',
    'Snowflake, Databricks SQL',
    () => l('the warehouse dbt builds into', 'lagret som dbt bygger in i'),
  ],
  [
    'GitHub Actions',
    'Airflow, Azure Data Factory',
    () =>
      l(
        'schedules, retries and failure issues',
        'scheman, omförsök och felärenden',
      ),
  ],
  [
    'dbt',
    'dbt',
    () =>
      l(
        'models, tests and contracts move over as they are',
        'modeller, tester och kontrakt flyttar med som de är',
      ),
  ],
  [
    'Cloudflare R2',
    'Amazon S3, ADLS Gen2',
    () => l('raw files, Parquet and releases', 'råfiler, Parquet och releaser'),
  ],
]

/** The platform's part of the hub; the hub's dashboard above it carries the status strip. */
export default function PlatformSections() {
  const graph = useFile<Graph>('architecture/graph.json')
  return (
    <>
      <section
        className="platform-intro"
        id="projects-platform"
        aria-labelledby="projects-platform-title"
      >
        <h2 id="projects-platform-title">
          {l('The data platform', 'Dataplattformen')}
        </h2>
        <p>
          {l(
            'It fetches Swedish and EU public data on a schedule, keeps every raw file with its source and hash, builds and tests it with dbt in bronze, silver and gold, and releases it to Cloudflare R2 only when every check in the run has passed.',
            'Den hämtar svensk och europeisk offentlig data på schema, sparar varje råfil med källa och hash, bygger och testar den med dbt i bronze, silver och gold och släpper den till Cloudflare R2 först när alla kontroller i körningen har gått igenom.',
          )}
        </p>
        <p className="tech-meta platform-links-inline">
          <a href={`${BLOB}/docs/case-studies/platform.md`}>
            {l('Case study', 'Fallstudie')}
          </a>
          {' · '}
          <a href={`https://github.com/${REPO}/tree/main/docs/incidents`}>
            {l('Incident log', 'Incidentlogg')}
          </a>
          {' · '}
          <a href={`https://github.com/${REPO}`}>{l('Code', 'Kod')}</a>
        </p>
      </section>

      <section id="platform-ask">
        <AskThePlatform ready />
      </section>

      <section id="platform-pipeline" aria-labelledby="platform-pipeline-title">
        <h2 id="platform-pipeline-title">
          {l('How the pipeline works', 'Så fungerar pipelinen')}
        </h2>
        <p className="tech-note">
          {l(
            'Choose a step to see what it does and what it holds. Model contracts and dbt tests gate the export, and each raw file keeps its URL, fetch time and SHA-256, so a published number traces back to a source file.',
            'Välj ett steg för att se vad det gör och vad det rymmer. Modellkontrakt och dbt-tester spärrar exporten, och varje råfil behåller URL, hämtningstid och SHA-256, så en publicerad siffra går att spåra till en källfil.',
          )}
        </p>
        {graph === null ? (
          reading
        ) : ok(graph) ? (
          <PipelineTour nodes={graph.nodes} />
        ) : (
          unread
        )}
      </section>

      <section id="platform-health" aria-labelledby="platform-health-title">
        <h2 id="platform-health-title">
          {l('Run health, last 30 days', 'Körhälsa, senaste 30 dagarna')}
        </h2>
        <p className="tech-note">
          {l(
            'Each square is one scheduled run, oldest to the left; press it for the log. A failed run opens a GitHub issue with the failed jobs and steps, and the next good run closes it.',
            'Varje ruta är en schemalagd körning, äldst till vänster; tryck för loggen. En körning som faller öppnar ett ärende på GitHub med de jobb och steg som föll, och nästa lyckade körning stänger det.',
          )}
        </p>
        <RunHealth />
      </section>

      <section id="platform-fabric" aria-labelledby="platform-fabric-title">
        <h2 id="platform-fabric-title">
          {l(
            'The same pattern on Microsoft Fabric',
            'Samma mönster i Microsoft Fabric',
          )}
        </h2>
        <FabricLakehouse />
      </section>

      <section id="platform-stack" aria-labelledby="platform-stack-title">
        <h2 id="platform-stack-title">
          {l('What this maps to in your stack', 'Vad det motsvarar i er stack')}
        </h2>
        <div className="tech-scroll" tabIndex={0}>
          <table className="tech-table">
            <thead>
              <tr>
                <th scope="col">{l('Here', 'Här')}</th>
                <th scope="col">{l('In your stack', 'I er stack')}</th>
                <th scope="col">{l('What it does', 'Vad den gör')}</th>
              </tr>
            </thead>
            <tbody>
              {STACK.map(([here, there, what]) => (
                <tr key={here}>
                  <th scope="row">{here}</th>
                  <td>{there}</td>
                  <td>{what()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
