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
import { Suspense, lazy, useEffect, useState } from 'react'
import { deliveryState } from '../dataSource'
import { l } from '../i18n'
import ErDiagram from './ErDiagram'
import PipelineTour from './PipelineTour'
import ProjectList from '../projects/ProjectsPage'
import type { ErModel } from './erLayout'
import { useFile, ok, num, day, unread, reading } from './techData'
import { Runs } from './WorkflowRuns'
import { Scripts, Stages, type Graph } from './PipelineTables'
import { Fetches, RunRecord, type WelfareRun } from './IngestionRecords'
import { Checks, Tables, type Quality, type Models } from './WarehouseTables'
import './tech.css'

const UmapGallery = lazy(() => import('./UmapGallery'))

const SECTIONS: [string, () => string][] = [
  ['tech-pipeline', () => l('How it works', 'Så fungerar det')],
  ['projects', () => l('Projects', 'Projekt')],
  ['tech-ingestion', () => l('Runs', 'Körningar')],
  ['tech-quality', () => l('Quality', 'Kvalitet')],
  ['tech-er', () => l('Data model', 'Datamodell')],
  ['tech-tables', () => l('Tables', 'Tabeller')],
  ['tech-maps', () => l('Cluster maps', 'Klusterkartor')],
]

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
              <dt>{l('dbt source tables', 'dbt-källtabeller')}</dt>
              <dd>{num(summary.sources)}</dd>
            </div>
            <div>
              <dt>{l('dbt models', 'dbt-modeller')}</dt>
              <dd>{num(summary.models)}</dd>
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
