import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../welfare/data'
import '../welfare/welfare.css'
import '../parliament/parliament.css'
import './datamodel.css'

type Column = {
  name: string
  type: string | null
  description: string
  tests: string[]
}
type Node = {
  id: string
  name: string
  kind: 'model' | 'seed' | 'source'
  schema: string
  layer: 'source' | 'seed' | 'bronze' | 'silver' | 'gold'
  subject: string
  materialized: string | null
  relation_type: string | null
  description: string
  path: string | null
  reads: string[]
  read_by: string[]
  tests: string[]
  columns: Column[]
  rows: number | null
  sql: string | null
  external: string | null
  has_sample: boolean
}
type Link = { from: string; column: string; to: string; field: string }
type Edge = { from: string; to: string; keys: string[] }
type Schema = {
  dbt_version: string
  layers: Record<string, number>
  tests: number
  links: Link[]
  edges: Edge[]
  nodes: Node[]
}
type Sample = {
  columns: string[]
  rows: (string | number | boolean | null)[][]
  error?: string
}

const LAYERS: {
  key: Node['layer']
  name: [string, string]
  text: [string, string]
}[] = [
  {
    key: 'source',
    name: ['Sources', 'Källor'],
    text: [
      'Files fetched from the agencies, stored as they came with URL, time and SHA-256.',
      'Filer hämtade från myndigheterna, sparade som de kom med URL, tid och SHA-256.',
    ],
  },
  {
    key: 'seed',
    name: ['Seeds', 'Seeds'],
    text: [
      'Small hand-kept tables with a source for every row: governments, committees, tax decisions.',
      'Små handförda tabeller med källa för varje rad: regeringar, utskott, skattebeslut.',
    ],
  },
  {
    key: 'bronze',
    name: ['Bronze', 'Brons'],
    text: [
      'Views that read the raw files in place: typed, renamed, nothing else.',
      'Vyer som läser rådatafilerna där de ligger: typade och omdöpta, inget annat.',
    ],
  },
  {
    key: 'silver',
    name: ['Silver', 'Silver'],
    text: [
      'Cleaned and joined within a source: one row per real-world thing.',
      'Rensat och sammanfogat inom en källa: en rad per sak i verkligheten.',
    ],
  },
  {
    key: 'gold',
    name: ['Gold', 'Guld'],
    text: [
      'Dimensions, facts and marts the site is built from, with tests on keys and sums.',
      'Dimensioner, fakta och marts som webbplatsen byggs av, med tester på nycklar och summor.',
    ],
  },
]
const REPO = 'https://github.com/korv9/anton-portfolio/blob/main/platform/'
const number = (n: number) => n.toLocaleString('sv-SE')
/** A table's address in the page's hash; a source carries its source name. */
const slug = (n: Node) =>
  n.kind === 'source' ? `${n.subject}.${n.name}` : n.name

function Flow({ schema }: { schema: Schema }) {
  const steps: [string, string, string][] = [
    [
      l('Agencies', 'Myndigheter'),
      'Riksdagen, SCB, Skatteverket, OECD, Valmyndigheten, FK, FoHM, Kolada, JobTech',
      l('REST, PxWeb, SDMX, open data', 'REST, PxWeb, SDMX, öppna data'),
    ],
    [
      l('Raw store', 'Rådata'),
      `${schema.layers.source ?? 0} ${l('sources', 'källor')}`,
      l('files + _manifest.jsonl', 'filer + _manifest.jsonl'),
    ],
    [
      l('Bronze → silver → gold', 'Brons → silver → guld'),
      `${(schema.layers.bronze ?? 0) + (schema.layers.silver ?? 0) + (schema.layers.gold ?? 0)} ${l('models', 'modeller')}, ${schema.tests} ${l('tests', 'tester')}`,
      `dbt ${schema.dbt_version} · DuckDB`,
    ],
    [
      l('Export', 'Export'),
      'JSON, Parquet',
      l(
        'checked contracts, object storage',
        'kontrollerade kontrakt, objektlagring',
      ),
    ],
    [
      l('This site', 'Webbplatsen'),
      'React + TypeScript',
      l('Parquet read in the browser', 'Parquet läses i webbläsaren'),
    ],
  ]
  return (
    <ol
      className="dm-flow"
      aria-label={l('How data flows', 'Hur datan flödar')}
    >
      {steps.map(([title, what, how]) => (
        <li key={title}>
          <strong>{title}</strong>
          <span>{what}</span>
          <small>{how}</small>
        </li>
      ))}
    </ol>
  )
}

function Chips({
  ids,
  byId,
  edges,
  self,
  direction,
}: {
  ids: string[]
  byId: Map<string, Node>
  edges: Edge[]
  self: string
  direction: 'up' | 'down'
}) {
  if (ids.length === 0) return <p className="muted">–</p>
  return (
    <ul className="dm-chips">
      {ids.map((id) => {
        const n = byId.get(id)
        const edge = edges.find((e) =>
          direction === 'up'
            ? e.from === self && e.to === id
            : e.from === id && e.to === self,
        )
        return (
          <li key={id} className={`dm-chip ${n?.layer ?? ''}`}>
            <a href={`#data-model-${n ? slug(n) : id}`}>{n ? slug(n) : id}</a>
            {edge && edge.keys.length > 0 && (
              <small>
                {' '}
                {l('on', 'på')} {edge.keys.join(', ')}
              </small>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Detail({ node, schema }: { node: Node; schema: Schema }) {
  const [sample, setSample] = useState<Sample | null>(null)
  const byId = useMemo(
    () => new Map(schema.nodes.map((n) => [n.id, n])),
    [schema],
  )
  useEffect(() => {
    setSample(null)
    if (!node.has_sample) return
    fetchJson<Sample>(
      `schema/samples/${node.id.split('.').slice(1).join('.')}.json`,
    )
      .then(setSample)
      .catch(() => setSample(null))
  }, [node])
  const outgoing = schema.links.filter((k) => k.from === node.id)
  const incoming = schema.links.filter((k) => k.to === node.id)
  return (
    <article className="dm-detail" data-testid="dm-detail">
      <p className="eyebrow">
        <span className={`dm-layer ${node.layer}`}>{node.layer}</span> ·{' '}
        {node.subject} · {node.materialized}
        {node.rows != null && ` · ${number(node.rows)} ${l('rows', 'rader')}`}
      </p>
      <h2>
        {node.kind === 'source' ? node.name : `${node.schema}.${node.name}`}
      </h2>
      {node.description && <p>{node.description}</p>}
      {node.path && (
        <p className="dm-path">
          <a href={REPO + node.path} target="_blank" rel="noreferrer">
            platform/{node.path}
          </a>
        </p>
      )}
      {node.external && (
        <pre className="dm-sql dm-external">{node.external}</pre>
      )}

      <div className="dm-lineage" data-testid="dm-lineage">
        <div>
          <h3>{l('Reads from', 'Läser från')}</h3>
          <Chips
            ids={node.reads}
            byId={byId}
            edges={schema.edges}
            self={node.id}
            direction="up"
          />
        </div>
        <div className="dm-lineage-self">
          <span className={`dm-chip ${node.layer}`}>{node.name}</span>
        </div>
        <div>
          <h3>{l('Read by', 'Läses av')}</h3>
          <Chips
            ids={node.read_by}
            byId={byId}
            edges={schema.edges}
            self={node.id}
            direction="down"
          />
        </div>
      </div>

      {(outgoing.length > 0 || incoming.length > 0) && (
        <>
          <h3>
            {l(
              'Keys tested against other tables',
              'Nycklar som testas mot andra tabeller',
            )}
          </h3>
          <ul className="dm-keys">
            {outgoing.map((k) => (
              <li key={`${k.column}-${k.to}`}>
                <code>{k.column}</code> →{' '}
                <a
                  href={`#data-model-${byId.get(k.to) ? slug(byId.get(k.to)!) : k.to}`}
                >
                  {byId.get(k.to)?.name ?? k.to}
                </a>
                .<code>{k.field}</code>
              </li>
            ))}
            {incoming.map((k) => (
              <li key={`${k.from}-${k.column}`}>
                <a
                  href={`#data-model-${byId.get(k.from) ? slug(byId.get(k.from)!) : k.from}`}
                >
                  {byId.get(k.from)?.name ?? k.from}
                </a>
                .<code>{k.column}</code> → <code>{k.field}</code>
              </li>
            ))}
          </ul>
        </>
      )}

      {node.tests.length > 0 && (
        <p>
          <strong>{l('Table tests', 'Tester på tabellen')}:</strong>{' '}
          {node.tests.join(' · ')}
        </p>
      )}

      {node.columns.length > 0 && (
        <>
          <h3>
            {l('Columns', 'Kolumner')} ({node.columns.length})
          </h3>
          <div className="dm-scroll">
            <table
              className="welfare-table dm-columns"
              data-testid="dm-columns"
            >
              <thead>
                <tr>
                  <th>{l('Column', 'Kolumn')}</th>
                  <th>{l('Type', 'Typ')}</th>
                  <th>{l('Tests', 'Tester')}</th>
                  <th>{l('Description', 'Beskrivning')}</th>
                </tr>
              </thead>
              <tbody>
                {node.columns.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <code>{c.name}</code>
                    </td>
                    <td>
                      <code>{c.type ?? '–'}</code>
                    </td>
                    <td>{c.tests.join(', ')}</td>
                    <td>{c.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {node.has_sample && (
        <>
          <h3>{l('Example rows', 'Exempelrader')}</h3>
          {!sample ? (
            <div className="loading">{l('Loading…', 'Laddar…')}</div>
          ) : (
            <div className="dm-scroll">
              <table
                className="welfare-table dm-sample"
                data-testid="dm-sample"
              >
                <thead>
                  <tr>
                    {sample.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sample.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((v, j) => (
                        <td key={j}>
                          {v === null ? (
                            <span className="muted">null</span>
                          ) : (
                            String(v)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {node.sql && (
        <details className="dm-sql-block">
          <summary>{l('The SQL', 'SQL-koden')}</summary>
          <pre className="dm-sql">{node.sql}</pre>
        </details>
      )}
    </article>
  )
}

/**
 * The warehouse behind the site, table by table: every source, seed and dbt model, how they
 * read from each other and join, their columns, tests, SQL and example rows.
 */
export default function DataModelPage({ view }: { view: string }) {
  const [schema, setSchema] = useState<Schema | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [layer, setLayer] = useState('all')
  const [subject, setSubject] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchJson<Schema>('schema/models.json')
      .then(setSchema)
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const selectedName = view.startsWith('#data-model-')
    ? view.slice('#data-model-'.length)
    : 'dim_tax_decision'
  const selected =
    schema?.nodes.find((n) => slug(n) === selectedName) ??
    schema?.nodes.find((n) => n.layer === 'gold')

  const subjects = useMemo(
    () => [...new Set((schema?.nodes ?? []).map((n) => n.subject))].sort(),
    [schema],
  )
  const listed = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (schema?.nodes ?? []).filter(
      (n) =>
        (layer === 'all' || n.layer === layer) &&
        (subject === 'all' || n.subject === subject) &&
        (!needle ||
          `${n.name} ${n.description} ${n.columns.map((c) => c.name).join(' ')}`
            .toLowerCase()
            .includes(needle)),
    )
  }, [schema, layer, subject, query])

  return (
    <div className="project-page welfare-page data-model-page">
      <div className="page-lead">
        <p className="eyebrow">{l('Under the hood', 'Under huven')}</p>
        <h1>{l('The data model', 'Datamodellen')}</h1>
        <p>
          {l(
            'Everything on this site comes from one warehouse built with dbt and DuckDB. Here is every table in it: where it reads from, what reads from it, the keys that join them, the tests that guard them, the SQL, and example rows.',
            'Allt på webbplatsen kommer från ett datalager byggt med dbt och DuckDB. Här är varje tabell i det: vad den läser från, vad som läser från den, nycklarna som kopplar ihop dem, testerna som vaktar dem, SQL-koden och exempelrader.',
          )}
        </p>
        <p>
          <a href="#er">
            {l(
              'See every relation as an ER diagram',
              'Se alla relationer som ER-diagram',
            )}
          </a>
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      {!schema && !error && (
        <div className="loading">{l('Loading…', 'Laddar…')}</div>
      )}
      {schema && (
        <>
          <section className="report welfare-section" aria-labelledby="dm-flow">
            <h2 id="dm-flow">
              {l('From agency to page', 'Från myndighet till sida')}
            </h2>
            <Flow schema={schema} />
            <ul className="dm-layers">
              {LAYERS.map((layerInfo) => (
                <li key={layerInfo.key}>
                  <button
                    type="button"
                    className={`dm-layer ${layerInfo.key}`}
                    aria-pressed={layer === layerInfo.key}
                    onClick={() =>
                      setLayer(layer === layerInfo.key ? 'all' : layerInfo.key)
                    }
                  >
                    {l(...layerInfo.name)} · {schema.layers[layerInfo.key] ?? 0}
                  </button>
                  <span>{l(...layerInfo.text)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="report welfare-section dm-browser"
            aria-label={l('Tables', 'Tabeller')}
          >
            <div className="dm-list">
              <div className="slicers">
                <label>
                  {l('Layer', 'Lager')}
                  <select
                    value={layer}
                    onChange={(e) => setLayer(e.target.value)}
                    data-field="dm-layer"
                  >
                    <option value="all">{l('All', 'Alla')}</option>
                    {LAYERS.map((x) => (
                      <option key={x.key} value={x.key}>
                        {l(...x.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {l('Subject', 'Ämne')}
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    data-field="dm-subject"
                  >
                    <option value="all">{l('All', 'Alla')}</option>
                    {subjects.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  {l('Search tables and columns', 'Sök tabeller och kolumner')}
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="study_key, fct_, roll_call…"
                    data-field="dm-search"
                  />
                </label>
              </div>
              <ol className="dm-table-list" data-testid="dm-list">
                {listed.map((n) => (
                  <li
                    key={n.id}
                    aria-current={n.id === selected?.id ? 'true' : undefined}
                  >
                    <a href={`#data-model-${slug(n)}`}>
                      <span
                        className={`dm-dot ${n.layer}`}
                        aria-hidden="true"
                      />
                      {slug(n)}
                    </a>
                    <small>
                      {n.subject}
                      {n.rows != null && ` · ${number(n.rows)}`}
                    </small>
                  </li>
                ))}
              </ol>
            </div>
            {selected && <Detail node={selected} schema={schema} />}
          </section>
        </>
      )}
    </div>
  )
}
