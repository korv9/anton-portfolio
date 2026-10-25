/**
 * The data platform, a part of the projects hub (#projects-platform): what it does, the pipeline,
 * Ask the platform, 30 days of run health with the cause of each red run, the same pattern on
 * Microsoft Fabric (the DiVA lakehouse) and what each part maps to in another stack.
 *
 * Every number is read at load: the pipeline from architecture/graph.json, the runs and
 * failure issues from GitHub, the MERGE counts from the lakehouse repository's docs/demo.md.
 */
import { l } from '../i18n'
import AskThePlatform from '../ask/AskThePlatform'
import PipelineTour from './PipelineTour'
import type { Graph } from './PipelineTables'
import { RunHealth } from './RunHealth'
import { FabricLakehouse } from './FabricLakehouse'
import type { Summary } from '../hub/Headline'
import { REPO, ok, reading, unread, useFile } from './techData'
import './tech.css'

const BLOB = `https://github.com/${REPO}/blob/main`

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
  const summary = useFile<Summary>('schema/summary.json')
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
            'It fetches Swedish and EU public data on a schedule, keeps every raw file with its source and hash, builds and tests it with dbt in bronze, silver and gold, and releases it to Cloudflare R2 only when every blocking test and contract passes.',
            'Den hämtar svensk och europeisk offentlig data på schema, sparar varje råfil med källa och hash, bygger och testar den med dbt i bronze, silver och gold och släpper den till Cloudflare R2 först när varje blockerande test och kontrakt går igenom.',
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
          <PipelineTour
            nodes={graph.nodes}
            models={ok(summary) ? summary.models : undefined}
          />
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
