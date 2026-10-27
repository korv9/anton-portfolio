/**
 * The data platform, a part of the projects hub (#projects-platform): its name, one sentence and
 * four KPIs, then the pipeline,
 * Ask the platform, the model cards and their gates, 30 days of run health with the cause of each red run, the same pattern on
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
import { ModelCards } from './ModelCards'
import type { Summary } from '../hub/Headline'
import type { Quality } from './WarehouseTables'
import { Legend, Method } from '../ui/PageHead'
import '../ui/page-head.css'
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
  const quality = useFile<Quality>('quality/summary.json')
  const millions = (n: number) => `${(n / 1e6).toFixed(1)}M`
  return (
    <>
      <header
        className="page-head platform-intro"
        id="projects-platform"
        aria-labelledby="projects-platform-title"
      >
        {/* The hub's h1 is "Projects", so the platform's name is an h2 in the page-head style. */}
        <h2 id="projects-platform-title" className="page-head-title">
          {l('The data platform', 'Dataplattformen')}
        </h2>
        <p className="page-head-sentence">
          {l(
            'One pipeline feeds every project here, from raw public data to tested exports.',
            'En pipeline matar varje projekt här, från rå öppen data till testade exporter.',
          )}
        </p>
        <dl className="page-head-kpis">
          {[
            [
              l('warehouse rows', 'rader i lagret'),
              ok(summary) ? millions(summary.rows) : '…',
            ],
            [
              l('dbt models', 'dbt-modeller'),
              ok(summary) ? summary.models : '…',
            ],
            [l('dbt tests', 'dbt-tester'), ok(summary) ? summary.tests : '…'],
            [
              l('quality checks passing', 'kvalitetskontroller godkända'),
              ok(quality)
                ? `${quality.run.check_statuses?.pass ?? '–'}/${quality.run.checks}`
                : '…',
            ],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section id="platform-ask">
        <AskThePlatform ready />
      </section>

      <section id="platform-pipeline" aria-labelledby="platform-pipeline-title">
        <h2 id="platform-pipeline-title">{l('Pipeline', 'Pipeline')}</h2>
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

      <section id="platform-models" aria-labelledby="platform-models-title">
        <h2 id="platform-models-title">{l('Model cards', 'Modellkort')}</h2>
        <ModelCards />
        <Legend>
          {l(
            'Each model against its baseline on an unseen split, 95% interval, scale 0–1',
            'Varje modell mot sin baslinje på en osedd uppdelning, 95-procentsintervall, skala 0–1',
          )}
        </Legend>
      </section>

      <section id="platform-health" aria-labelledby="platform-health-title">
        <h2 id="platform-health-title">
          {l(
            'Scheduled runs, last 30 days',
            'Schemalagda körningar, senaste 30 dagarna',
          )}
        </h2>
        <RunHealth />
        <Legend>
          {l(
            'One square per scheduled run, oldest left; press for the log',
            'En ruta per schemalagd körning, äldst till vänster; tryck för loggen',
          )}
        </Legend>
      </section>

      <section id="platform-fabric" aria-labelledby="platform-fabric-title">
        <h2 id="platform-fabric-title">
          {l('Microsoft Fabric', 'Microsoft Fabric')}
        </h2>
        <FabricLakehouse />
      </section>

      <Method
        summary={l(
          'How it is made · sources · method',
          'Så är det gjort · källor · metod',
        )}
      >
        <p>
          {l(
            'It fetches Swedish and EU public data on a schedule, keeps every raw file with its source and hash, builds and tests it with dbt in bronze, silver and gold, and releases it to Cloudflare R2 only when every blocking test and contract passes.',
            'Den hämtar svensk och europeisk offentlig data på schema, sparar varje råfil med källa och hash, bygger och testar den med dbt i bronze, silver och gold och släpper den till Cloudflare R2 först när varje blockerande test och kontrakt går igenom.',
          )}
        </p>
        <p>
          {l(
            'A model ships only if it clears the gate its card states before publishing, scored on a split it never trained on.',
            'En modell publiceras bara om den klarar spärren som kortet anger i förväg, mätt på en uppdelning den aldrig tränats på.',
          )}
        </p>
        <div id="platform-stack">
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
        </div>
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
      </Method>
    </>
  )
}
