/**
 * Data catalogue (#data-catalogue): every published dataset as a data product, and the
 * platform's status, read only from metadata the platform publishes.
 *
 * Status: when each domain's data was last built or checked, from the files themselves
 * (graph, catalog, quality checks, the AI Act summary, the run records of the models). Nothing is
 * shown that the files do not state. Catalogue: per published file or file group, the tested
 * models it comes from (description, grain, columns, rows), its sources, the pages that read it,
 * its quality checks, and a download link.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchData } from '../dataSource'
import { DataQuestion } from '../ui/Story'
import type { Graph } from '../constellation/graph'
import { nowAndNext, isoToday } from '../aiact/logic'
import {
  buildCatalogue,
  type Catalog,
  type Dataset,
  type QualityCheck,
} from './logic'
import { Disclosure } from '../ui/Disclosure'
import { PlatformNav } from '../datamodel/PlatformNav'
import './catalogue.css'

const StatusPage = lazy(() => import('../status/StatusPage'))

type Status = {
  aiAct?: {
    latest_retrieval: string | null
    version: string
    latestChange: string | null
    next: string | null
  }
  jobs?: { generated_at: string; last_month: string; archives: number }
  symbolic?: { run_at: string; documents: number }
  philosophy?: { ran_at: string; works: number }
  concepts?: { ran_at: string; passages: number }
}

async function json<T>(path: string): Promise<T> {
  const r = await fetchData(path)
  if (!r.ok) throw new Error(path)
  return r.json()
}
const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '–')
const size = (bytes: number) =>
  bytes > 1e6
    ? `${(bytes / 1e6).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1e3)).toLocaleString(l('en-GB', 'sv-SE'))} kB`

export default function CataloguePage() {
  const [graph, setGraph] = useState<Graph | null>(null)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [checks, setChecks] = useState<QualityCheck[]>([])
  const [status, setStatus] = useState<Status>({})
  const [failed, setFailed] = useState(false)
  const [domain, setDomain] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    Promise.all([
      json<Graph>('architecture/graph.json'),
      json<Catalog>('catalog.json'),
      json<QualityCheck[]>('quality/checks.json'),
    ])
      .then(([g, c, q]) => {
        setGraph(g)
        setCatalog(c)
        setChecks(q)
      })
      .catch(() => setFailed(true))
    // Each domain's own record of when it was built; a file that fails to load is left out.
    const add = (part: Partial<Status>) => setStatus((s) => ({ ...s, ...part }))
    json<{
      latest_retrieval: string | null
      current_version: { published_at: string }
    }>('ai-act/summary.json')
      .then(async (s) => {
        const [changes, timeline] = await Promise.all([
          json<{ change_date: string; change_kind: string }[]>(
            'ai-act/changes.json',
          ),
          json<Parameters<typeof nowAndNext>[0]>('ai-act/timeline.json'),
        ])
        const official = changes
          .filter((c) => c.change_kind !== 'provision')
          .map((c) => c.change_date)
          .sort()
        add({
          aiAct: {
            latest_retrieval: s.latest_retrieval,
            version: s.current_version.published_at,
            latestChange: official.at(-1) ?? null,
            next: nowAndNext(timeline, isoToday()).next?.date ?? null,
          },
        })
      })
      .catch(() => {})
    json<{ generated_at: string; last_month: string; archives: unknown[] }>(
      'jobs/market.json',
    )
      .then((m) =>
        add({
          jobs: {
            generated_at: m.generated_at,
            last_month: m.last_month,
            archives: m.archives.length,
          },
        }),
      )
      .catch(() => {})
    json<{ document_count: number; run: { run_at: string } }>(
      'symbolic/summary.json',
    )
      .then((s) =>
        add({
          symbolic: { run_at: s.run.run_at, documents: s.document_count },
        }),
      )
      .catch(() => {})
    json<{ run: { ran_at: string; works: number } }>('philosophy/summary.json')
      .then((p) =>
        add({ philosophy: { ran_at: p.run.ran_at, works: p.run.works } }),
      )
      .catch(() => {})
    json<{ run: { ran_at: string; corpus_size: number } }>(
      'concepts/summary.json',
    )
      .then((c) =>
        add({
          concepts: { ran_at: c.run.ran_at, passages: c.run.corpus_size },
        }),
      )
      .catch(() => {})
  }, [])

  const datasets = useMemo(
    () => (graph && catalog ? buildCatalogue(graph, catalog, checks) : []),
    [graph, catalog, checks],
  )
  const domains = graph?.domains ?? []
  const domainLabel = (id: string) =>
    domains.find((d) => d.id === id)?.label ?? id
  const shown = datasets.filter(
    (d) =>
      (!domain || d.domain === domain) &&
      (!query ||
        `${d.label} ${d.models.map((m) => `${m.label} ${m.description ?? ''}`).join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  )
  const passed = checks.filter((c) => c.status === 'pass').length

  return (
    <div className="catalogue ds-container">
      <header className="catalogue-hero">
        <DataQuestion
          level={1}
          eyebrow={l('Under the hood', 'Under huven')}
          question={l(
            'What data does the platform publish, and how fresh is it?',
            'Vilken data publicerar plattformen, och hur färsk är den?',
          )}
        >
          <p>
            {l(
              'Every published dataset as a data product: what it is, the tested model it comes from, its grain and columns, its source, the pages that use it and its quality checks. Read from the platform’s own metadata.',
              'Varje publicerat dataset som en dataprodukt: vad det är, den testade modellen det kommer från, dess korn och kolumner, dess källa, sidorna som använder det och dess kvalitetskontroller. Läst ur plattformens egen metadata.',
            )}
          </p>
        </DataQuestion>
        <PlatformNav current="#data-catalogue" />
      </header>

      {failed && (
        <p role="alert">
          {l(
            'The catalogue could not be loaded.',
            'Katalogen kunde inte laddas.',
          )}
        </p>
      )}

      <section className="catalogue-status" aria-labelledby="status-title">
        <h2 id="status-title">{l('Platform status', 'Plattformens status')}</h2>
        <p className="catalogue-note">
          {l(
            'Dates as the published files state them. A domain without a record is left out rather than guessed.',
            'Datum så som de publicerade filerna anger dem. En domän utan uppgift lämnas utanför i stället för att gissas.',
          )}
        </p>
        <Disclosure
          label={l(
            'Pipeline runs and dbt tests',
            'Pipelinekörningar och dbt-tester',
          )}
        >
          <Suspense fallback={null}>
            <StatusPage />
          </Suspense>
        </Disclosure>
        <dl className="catalogue-status-grid">
          {graph && catalog && (
            <div>
              <dt>{l('Platform', 'Plattform')}</dt>
              <dd>
                {l('Architecture graph built', 'Arkitekturgrafen byggd')}{' '}
                {day(graph.generated_at)}, dbt {graph.dbt_version}
              </dd>
              <dd>
                {l('Export run', 'Exportkörning')} <code>{catalog.run_id}</code>{' '}
                , {catalog.files.length} {l('files', 'filer')}
              </dd>
              <dd>
                {l('Quality checks passing', 'Kvalitetskontroller som klaras')}:{' '}
                {passed} / {checks.length}{' '}
                <a href="#quality">{l('Details', 'Detaljer')}</a>
              </dd>
            </div>
          )}
          {status.aiAct && (
            <div>
              <dt>EU AI Act</dt>
              <dd>
                {l('Source checked', 'Källan kontrollerad')}{' '}
                {day(status.aiAct.latest_retrieval)}
              </dd>
              <dd>
                {l('Current version', 'Gällande version')}{' '}
                {status.aiAct.version}
              </dd>
              <dd>
                {l('Latest official change', 'Senaste officiella ändring')}{' '}
                {day(status.aiAct.latestChange)}
              </dd>
              <dd>
                {l('Next milestone', 'Nästa milstolpe')}{' '}
                {day(status.aiAct.next)}
              </dd>
            </div>
          )}
          {status.jobs && (
            <div>
              <dt>{l('Job market', 'Jobbmarknaden')}</dt>
              <dd>
                {l('Built', 'Byggd')} {day(status.jobs.generated_at)}
              </dd>
              <dd>
                {l('Latest month', 'Senaste månad')} {status.jobs.last_month}
              </dd>
              <dd>
                {status.jobs.archives} {l('archives counted', 'räknade arkiv')}
              </dd>
            </div>
          )}
          {status.symbolic && (
            <div>
              <dt>Symbolic Atlas</dt>
              <dd>
                {l('Latest model run', 'Senaste modellkörning')}{' '}
                {day(status.symbolic.run_at)}
              </dd>
              <dd>
                {l('Corpus', 'Korpus')} v4, {status.symbolic.documents}{' '}
                {l('books', 'böcker')}
              </dd>
            </div>
          )}
          {status.philosophy && (
            <div>
              <dt>Philosophy Atlas</dt>
              <dd>
                {l('Latest model run', 'Senaste modellkörning')}{' '}
                {day(status.philosophy.ran_at)}
              </dd>
              <dd>
                {status.philosophy.works} {l('works', 'verk')}
              </dd>
            </div>
          )}
          {status.concepts && (
            <div>
              <dt>{l('Concept layer', 'Begreppslagret')}</dt>
              <dd>
                {l('Latest model run', 'Senaste modellkörning')}{' '}
                {day(status.concepts.ran_at)}
              </dd>
              <dd>
                {status.concepts.passages.toLocaleString(l('en-GB', 'sv-SE'))}{' '}
                {l('passages', 'passager')}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="catalogue-list" aria-labelledby="catalogue-title">
        <h2 id="catalogue-title">
          {l('Datasets', 'Dataset')}{' '}
          <small>
            {shown.length} / {datasets.length}
          </small>
        </h2>
        <div className="catalogue-filters">
          <label>
            {l('Domain', 'Domän')}{' '}
            <select value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="">{l('All', 'Alla')}</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {l('Search', 'Sök')}{' '}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={l('obligations, votes …', 'skyldigheter, röster …')}
            />
          </label>
        </div>
        {graph && !shown.length && (
          <p className="catalogue-note">
            {l(
              'No dataset matches these filters.',
              'Inget dataset matchar filtren.',
            )}
          </p>
        )}
        <ol className="catalogue-items">
          {shown.map((d) => (
            <DatasetRow
              key={d.id}
              d={d}
              domain={domainLabel(d.domain)}
              base={catalog?.bases.json ?? 'data/'}
            />
          ))}
        </ol>
      </section>
    </div>
  )
}

function DatasetRow({
  d,
  domain,
  base,
}: {
  d: Dataset
  domain: string
  base: string
}) {
  const model = d.models[0]
  return (
    <li className="catalogue-item">
      <details>
        <summary>
          <span className="catalogue-name">{d.label}</span>
          <span className="catalogue-domain">{domain}</span>
          <span className="catalogue-desc">
            {model?.description ??
              l(
                'Published by its export script.',
                'Publiceras av sitt exportskript.',
              )}
          </span>
        </summary>
        <dl className="catalogue-facts">
          {d.models.map((m) => (
            <div key={m.id}>
              <dt>{l('Model', 'Modell')}</dt>
              <dd>
                <a
                  href={`#data-constellation?view=lineage&node=${encodeURIComponent(m.id)}`}
                >
                  {m.label}
                </a>
                {m.rows != null &&
                  `, ${m.rows.toLocaleString(l('en-GB', 'sv-SE'))} ${l('rows', 'rader')}`}
                {m.keys?.length ? (
                  <>
                    {', '}
                    {l('grain', 'korn')}: <code>{m.keys.join(', ')}</code>
                  </>
                ) : null}
                {m.columns?.length ? (
                  <span className="catalogue-columns">
                    {m.columns.join(', ')}
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
          <div>
            <dt>{l('Files', 'Filer')}</dt>
            <dd>
              {d.files.length
                ? `${d.files.length}, ${d.formats.join(', ')}, ${size(d.bytes)}${d.rows ? `, ${d.rows.toLocaleString(l('en-GB', 'sv-SE'))} ${l('rows', 'rader')}` : ''}`
                : l(
                    'Not in the delivery catalog (built locally or offloaded).',
                    'Inte i leveranskatalogen (byggs lokalt eller ligger utlagt).',
                  )}
              {d.files.slice(0, 3).map((f) => (
                <a
                  key={f.path}
                  className="catalogue-download"
                  href={f.format === 'json' ? `${base}${f.path}` : undefined}
                  download={f.format === 'json' || undefined}
                >
                  {f.path}
                </a>
              ))}
            </dd>
          </div>
          <div>
            <dt>{l('Source', 'Källa')}</dt>
            <dd>
              {d.sources.length
                ? d.sources.map((s) => s.label).join(', ')
                : l('Curated in the repository', 'Kuraterad i repot')}
            </dd>
          </div>
          <div>
            <dt>{l('Used by', 'Används av')}</dt>
            <dd>
              {d.consumers.length
                ? d.consumers.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 && ', '}
                      {c.href ? <a href={c.href}>{c.label}</a> : c.label}
                    </span>
                  ))
                : '–'}
            </dd>
          </div>
          <div>
            <dt>{l('Quality', 'Kvalitet')}</dt>
            <dd>
              {d.checks.length
                ? d.checks.map((c) => (
                    <span key={c.quality_check_id} className="catalogue-check">
                      <b className={`catalogue-check-${c.status}`}>
                        {c.status}
                      </b>{' '}
                      {c.dimension_label}: {c.description}
                    </span>
                  ))
                : l(
                    'No registered check on this dataset’s model.',
                    'Ingen registrerad kontroll på datasetets modell.',
                  )}
            </dd>
          </div>
        </dl>
      </details>
    </li>
  )
}
