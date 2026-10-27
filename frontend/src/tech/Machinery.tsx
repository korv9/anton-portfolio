/**
 * The platform's machinery, the drill-down at the end of the projects hub (#projects): each
 * project stage by stage, the scheduled runs and fetches, quality checks
 * and delivery, the data model (an ER diagram per subject and every table with its columns),
 * and every cluster map.
 *
 * Nothing here is written by hand: the runs come from the GitHub snapshot, the rest from the files
 * the pipeline exports (schema/er.json, schema/models.json, architecture/graph.json,
 * quality/summary.json, welfare/run.json), so a new table or script shows up on its own.
 */
import { Suspense, lazy, useEffect, useState } from 'react'
import { deliveryState } from '../dataSource'
import type { Summary } from '../hub/Headline'
import { l } from '../i18n'
import ErDiagram from './ErDiagram'
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
  const summary = useFile<Summary>('schema/summary.json')
  const [delivery, setDelivery] = useState<Awaited<
    ReturnType<typeof deliveryState>
  > | null>(null)
  useEffect(() => {
    deliveryState().then(setDelivery, () => setDelivery(null))
  }, [])
  // The table list shows only when it comes from the same export as the headline's model
  // count: export_schema.py writes both, so an older models.json waits for the next export.
  const current =
    ok(models) &&
    ok(summary) &&
    models.nodes.filter((n) => n.kind === 'model').length === summary.models
  const [domain, setDomain] = useState('')
  const domains = ok(er)
    ? er.domains.filter((d) => er.tables.some((t) => t.domain === d.key))
    : []
  const chosen = domains.find((d) => d.key === domain) ?? domains[0]
  const part = (d: unknown, body: () => React.ReactNode) =>
    d === null ? reading : d === 'error' ? unread : body()
  return (
    <>
      <section id="tech-stages" aria-labelledby="tech-stages-title">
        <h2 id="tech-stages-title">
          {l('Each project, stage by stage', 'Varje projekt, steg för steg')}
        </h2>
        {part(graph, () => (
          <>
            <Stages graph={graph as Graph} />
            <p className="tech-meta">
              {l(
                `Built ${day((graph as Graph).generated_at)} from the dbt manifest, the ingestion folders and the delivery specs.`,
                `Byggd ${day((graph as Graph).generated_at)} från dbt-manifestet, inläsningsmapparna och leveransspecifikationerna.`,
              )}
            </p>
          </>
        ))}
      </section>

      <section id="tech-ingestion" aria-labelledby="tech-ingestion-title">
        <h2 id="tech-ingestion-title">{l('Runs', 'Körningar')}</h2>
        <h3>{l('Scheduled runs', 'Schemalagda körningar')}</h3>
        <p className="tech-note">
          {l(
            'Each square is one run of a GitHub Actions workflow, oldest to the left; press it for the log.',
            'Varje ruta är en körning av ett GitHub Actions-arbetsflöde, äldst till vänster; tryck för loggen.',
          )}
        </p>
        <Runs />
        <h3>{l('Fetches per subject', 'Hämtningar per ämne')}</h3>
        <Fetches />
        <h3>{l('Sources and scripts', 'Källor och skript')}</h3>
        {part(graph, () => (
          <Scripts graph={graph as Graph} />
        ))}
        <h3>
          {l(
            'A run record with dbt tests: public statistics',
            'En körlogg med dbt-tester: offentlig statistik',
          )}
        </h3>
        {part(run, () => (
          <RunRecord run={run as WelfareRun} />
        ))}
      </section>

      <section id="tech-quality" aria-labelledby="tech-quality-title">
        <h2 id="tech-quality-title">
          {l('Quality and delivery', 'Kvalitet och leverans')}
        </h2>
        <h3>{l('Quality checks', 'Kvalitetskontroller')}</h3>
        {part(quality, () => (
          <>
            <Checks quality={quality as Quality} />
            <p className="tech-meta">
              {l(
                `${(quality as Quality).run.checks} checks, evaluated ${day((quality as Quality).run.evaluated_at)}; a check that does not apply to a product is left out of its bar.`,
                `${(quality as Quality).run.checks} kontroller, utvärderade ${day((quality as Quality).run.evaluated_at)}; en kontroll som inte gäller en produkt räknas inte i dess stapel.`,
              )}
            </p>
          </>
        ))}
        {/* Only an approved release is worth a line; local files are the development copy. */}
        {delivery?.mode === 'remote' && (
          <>
            <h3>{l('Delivery in use', 'Leverans som används')}</h3>
            <p className="tech-meta">
              {l(
                `Release approved ${day(delivery.activatedAt)}`,
                `Release godkänd ${day(delivery.activatedAt)}`,
              )}
              {delivery.groups
                ? ` · ${l('groups', 'grupper')}: ${Object.keys(delivery.groups).join(', ')}`
                : ''}
            </p>
          </>
        )}
      </section>

      <section id="tech-er" aria-labelledby="tech-er-title">
        <h2 id="tech-er-title">{l('ER diagrams', 'ER-diagram')}</h2>
        {part(er, () => {
          const model = er as ErModel
          return (
            <>
              <p className="tech-note">
                {model.method.tables} {model.method.relations}
              </p>
              <div
                className="tech-pick"
                role="group"
                aria-label={l('Subject', 'Ämne')}
              >
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
                {l(
                  `${model.tables.length} gold tables and seeds, ${model.relations.length} relations · exported ${model.generated} by platform/publish/export_er.py`,
                  `${model.tables.length} gold-tabeller och seeds, ${model.relations.length} relationer · exporterad ${model.generated} av platform/publish/export_er.py`,
                )}
              </p>
            </>
          )
        })}
      </section>

      {current && (
        <section id="tech-tables" aria-labelledby="tech-tables-title">
          <h2 id="tech-tables-title">
            {l('Tables and columns', 'Tabeller och kolumner')}
          </h2>
          <Tables models={models as Models} />
          {(models as Models).generated_at && (
            <p className="tech-meta">
              {l(
                `Exported ${day((models as Models).generated_at)} by platform/publish/export_schema.py`,
                `Exporterad ${day((models as Models).generated_at)} av platform/publish/export_schema.py`,
              )}
            </p>
          )}
        </section>
      )}

      <section id="tech-maps" aria-labelledby="tech-maps-title">
        <h2 id="tech-maps-title">{l('Cluster maps', 'Klusterkartor')}</h2>
        <p className="tech-note">
          {l(
            'Every UMAP and cluster map on the site. Press one to open it full size.',
            'Varje UMAP- och klusterkarta på sidan. Tryck på en för att öppna den i full storlek.',
          )}
        </p>
        <Suspense fallback={reading}>
          <UmapGallery />
        </Suspense>
      </section>
    </>
  )
}
