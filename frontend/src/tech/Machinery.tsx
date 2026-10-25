/**
 * The platform's machinery, the drill-down at the end of the projects hub (#projekt): how the
 * pipeline works, each project stage by stage, the scheduled runs and fetches, quality checks
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
import type { ErModel } from './erLayout'
import { useFile, ok, day, unread, reading } from './techData'
import { Runs } from './WorkflowRuns'
import { Scripts, Stages, type Graph } from './PipelineTables'
import { Fetches, RunRecord, type WelfareRun } from './IngestionRecords'
import { Checks, Tables, type Quality, type Models } from './WarehouseTables'
import './tech.css'

const UmapGallery = lazy(() => import('./UmapGallery'))

export default function Machinery() {
  const graph = useFile<Graph>('architecture/graph.json')
  const er = useFile<ErModel>('schema/er.json')
  const models = useFile<Models>('schema/models.json')
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
  return (
    <>
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

      <section id="tech-stages" aria-labelledby="tech-stages-title">
        <h2 id="tech-stages-title">
          {l('Each project, stage by stage', 'Varje projekt, steg för steg')}
        </h2>
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
    </>
  )
}
