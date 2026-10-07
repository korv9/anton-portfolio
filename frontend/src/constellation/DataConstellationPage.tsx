/**
 * Data Constellation (#data-constellation): the whole data platform as one map, from the public
 * sources through ingestion, the dbt warehouse and ML to the published files and the products
 * that read them. The graph is generated from the repository (platform/architecture/
 * build_graph.py: dbt's manifest, the ER export and a small registry), never drawn by hand.
 *
 * Three views: Platform (the architecture), Data model (gold tables and seeds joined by their
 * keys) and Lineage (choose a node, see everything it is built from and everything built from
 * it). A domain filter fades the other products; layer chips hide stages. Choosing a node opens
 * its details. The same graph is listed as text below the map, with every node selectable by
 * keyboard. View, domain, hidden layers and the chosen node live in the address.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { count } from '../format'
import type { Route } from '../router'
import { fetchData } from '../dataSource'
import { useViewParams } from '../politik/useViewParams'
import ConstellationCanvas, { STYLE } from './ConstellationCanvas'
import {
  domainFocus,
  layout,
  lineageOf,
  neighbours,
  search,
  type Graph,
  type GraphNode,
  type Mode,
  type NodeType,
} from './graph'
import { useQuality } from '../quality/data'
import { cellOf, cellText, nodesOfCheck, nodeStatuses } from '../quality/logic'
import { QualityLegend, StatusMark } from '../quality/QualityPanel'
import type { QualityData } from '../quality/types'
import { ProjectHero } from '../ui/Project'
import './constellation.css'

const DEFAULTS = { view: 'platform', domain: '', node: '', hide: '' }
const MODES: { key: Mode; name: [string, string]; hint: [string, string] }[] = [
  {
    key: 'platform',
    name: ['Platform', 'Plattform'],
    hint: [
      'Data flows from the sources to the products; one lane per domain, shared infrastructure in the middle.',
      'Data flödar från källorna till produkterna; ett band per domän, gemensam infrastruktur i mitten.',
    ],
  },
  {
    key: 'model',
    name: ['Data model', 'Datamodell'],
    hint: [
      'Gold tables and seeds by kind, joined by their keys (dashed). Joins are logical relations, not build steps.',
      'Guldtabeller och seeds efter typ, sammanfogade via sina nycklar (streckat). Kopplingarna är logiska relationer, inte byggsteg.',
    ],
  },
  {
    key: 'lineage',
    name: ['Lineage', 'Härkomst'],
    hint: [
      'Choose a node: everything it is built from and everything built from it lights up.',
      'Välj en nod: allt den byggs av och allt som byggs av den lyser upp.',
    ],
  },
  {
    key: 'quality',
    name: ['Quality', 'Kvalitet'],
    hint: [
      'Products and models with registered quality checks carry a small mark: their weakest measured result. Choose one to see its checks and validity.',
      'Produkter och modeller med registrerade kvalitetskontroller har en liten markering: deras svagaste uppmätta resultat. Välj en för att se dess kontroller och validitet.',
    ],
  },
]
const LAYER_TYPES: NodeType[] = [
  'source',
  'ingestion',
  'raw',
  'seed',
  'bronze',
  'silver',
  'ml',
  'gold',
  'delivery',
  'frontend',
  'shared',
]
const GITHUB = 'https://github.com/korv9/anton-portfolio/blob/main/'
const num = count

export default function DataConstellationPage({ route }: { route: Route }) {
  const [graph, setGraph] = useState<Graph | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [params, set] = useViewParams(route, DEFAULTS)
  const { data: quality } = useQuality()
  const marks = useMemo(
    () => (quality ? nodeStatuses(quality.checks) : null),
    [quality],
  )
  const mode = (
    MODES.some((m) => m.key === params.view) ? params.view : 'platform'
  ) as Mode

  useEffect(() => {
    let live = true
    fetchData('architecture/graph.json')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then((g: Graph) => live && setGraph(g))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [])

  const byId = useMemo(
    () => new Map((graph?.nodes ?? []).map((n) => [n.id, n])),
    [graph],
  )
  const placed = useMemo(
    () => (graph ? layout(graph, mode) : new Map()),
    [graph, mode],
  )
  // Lineage view opens on a product, so the first thing it shows is a path.
  const selected =
    params.node && byId.has(params.node)
      ? params.node
      : mode === 'lineage'
        ? 'app:symbolic'
        : null
  const path = useMemo(
    () => (graph && selected ? lineageOf(graph, selected) : null),
    [graph, selected],
  )
  const focus = useMemo(
    () => (graph && params.domain ? domainFocus(graph, params.domain) : null),
    [graph, params.domain],
  )
  const hidden = useMemo(
    () => new Set(params.hide ? params.hide.split(',') : []),
    [params.hide],
  )
  const found = useMemo(
    () => (graph ? search(graph, query) : []),
    [graph, query],
  )

  if (failed)
    return (
      <p className="ds-container" role="alert">
        {l('The map could not be loaded.', 'Kartan kunde inte laddas.')}
      </p>
    )
  if (!graph)
    return (
      <p className="ds-container" role="status">
        {l('Loading the map…', 'Laddar kartan…')}
      </p>
    )

  const select = (id: string | null) => set({ node: id ?? '' })
  const node = selected ? byId.get(selected) : undefined
  const toggleLayer = (t: NodeType) => {
    const next = new Set(hidden)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    set({ hide: [...next].join(',') })
  }
  const total = (key: string) =>
    graph.domains.reduce((s, d) => s + (d.counts[key] ?? 0), 0)

  return (
    <div className="constellation">
      <div className="ds-container">
        <ProjectHero
          eyebrow={l('Under the hood · platform', 'Under huven · plattform')}
          title="Data Constellation"
          question={l(
            'How do raw sources become analytical products?',
            'Hur blir råa källor till analytiska produkter?',
          )}
          findingLabel={l('The platform', 'Plattformen')}
          finding={l(
            `${total('sources')} public sources, ${total('ingestion')} Python ingesters, ${total('models')} dbt models (${total('gold')} gold) and ${total('delivery')} published file sets, read by ${total('products')} React products.`,
            `${total('sources')} öppna källor, ${total('ingestion')} Python-inläsare, ${total('models')} dbt-modeller (${total('gold')} guld) och ${total('delivery')} publicerade filgrupper, lästa av ${total('products')} React-produkter.`,
          )}
          nav={[
            {
              href: '#quality',
              label: l('Quality & Validity', 'Kvalitet och validitet'),
            },
            {
              href: '#data-model',
              label: l('Data platform', 'Dataplattformen'),
            },
          ]}
        >
          <p>
            {l(
              'This map shows how the portfolio’s sources, pipelines, models and products are connected: one shared data platform, several products on top. It is generated from the repository itself.',
              'Kartan visar hur portfoliots källor, pipelines, modeller och produkter hänger ihop: en gemensam dataplattform med flera produkter ovanpå. Den genereras ur själva repot.',
            )}
          </p>
        </ProjectHero>
      </div>

      <section
        className="constellation-stage ds-container"
        aria-labelledby="constellation-map-title"
      >
        <h2 id="constellation-map-title" className="visually-hidden">
          {l('The map', 'Kartan')}
        </h2>
        <div className="constellation-toolbar">
          <div
            className="constellation-chips"
            role="group"
            aria-label={l('View', 'Vy')}
          >
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={mode === m.key}
                onClick={() => set({ view: m.key })}
              >
                {l(...m.name)}
              </button>
            ))}
          </div>
          <label className="constellation-select">
            <span>{l('Domain', 'Domän')}</span>
            <select
              value={params.domain}
              onChange={(e) => set({ domain: e.target.value })}
            >
              <option value="">{l('All', 'Alla')}</option>
              {[...graph.domains]
                .sort((a, b) => a.lane - b.lane)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
            </select>
          </label>
          <div className="constellation-search">
            <label>
              <span className="visually-hidden">
                {l('Search models and files', 'Sök modeller och filer')}
              </span>
              <input
                type="search"
                value={query}
                placeholder={l('Search models…', 'Sök modeller…')}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {found.length > 0 && (
              <ul className="constellation-results">
                {found.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        select(n.id)
                        setQuery('')
                      }}
                    >
                      <Marker type={n.type} /> {n.label}
                      <small>{l(...STYLE[n.type].name)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <p className="constellation-hint">
          {l(...MODES.find((m) => m.key === mode)!.hint)}
        </p>
        <div
          className="constellation-layers"
          role="group"
          aria-label={l('Layers', 'Lager')}
        >
          {LAYER_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={!hidden.has(t)}
              onClick={() => toggleLayer(t)}
            >
              <Marker type={t} /> {l(...STYLE[t].name)}
            </button>
          ))}
        </div>

        <div className="constellation-body plate">
          <div
            className="constellation-scroll"
            tabIndex={0}
            aria-label={l(
              'The map; scroll sideways on small screens',
              'Kartan; rulla i sidled på små skärmar',
            )}
          >
            <ConstellationCanvas
              graph={graph}
              placed={placed}
              mode={mode}
              focus={focus}
              path={path}
              selected={selected}
              hiddenLayers={hidden}
              marks={marks}
              onSelect={select}
            />
          </div>
          <aside className="constellation-panel" aria-live="polite">
            {node ? (
              <Detail
                node={node}
                graph={graph}
                mode={mode}
                byId={byId}
                lineage={path?.size ?? 0}
                quality={quality}
                onSelect={select}
              />
            ) : (
              <Products graph={graph} onSelect={select} />
            )}
          </aside>
        </div>
        {mode === 'quality' && (
          <div className="constellation-quality-legend">
            <QualityLegend />
            <p className="constellation-muted">
              {l(
                'Quality asks whether the data is correct. Validity asks whether the analysis answers the question it claims to answer. Both matter.',
                'Kvalitet frågar om datan är korrekt. Validitet frågar om analysen besvarar den fråga den säger sig besvara. Båda spelar roll.',
              )}{' '}
              <a href="#quality">
                {l('Quality & validity', 'Kvalitet och validitet')}
              </a>
            </p>
          </div>
        )}
        <p className="constellation-legend">
          {l(
            'Solid line: data built from data. Teal: a published file and the product that reads it. Dashed: a key that joins two tables. Dotted: shared infrastructure. Faded markers are models switched off by default.',
            'Heldragen linje: data byggd av data. Turkos: en publicerad fil och produkten som läser den. Streckad: en nyckel som förenar två tabeller. Prickad: gemensam infrastruktur. Bleka markörer är modeller som är avstängda som standard.',
          )}
        </p>
      </section>

      <Fallback graph={graph} onSelect={select} />
      <Editorial graph={graph} />
    </div>
  )
}

function Marker({ type }: { type: NodeType }) {
  return (
    <span
      className={`constellation-marker is-${type}`}
      style={{ color: STYLE[type].colour }}
      aria-hidden="true"
    />
  )
}

function Products({
  graph,
  onSelect,
}: {
  graph: Graph
  onSelect: (id: string) => void
}) {
  return (
    <>
      <h3>{l('Products', 'Produkter')}</h3>
      <p className="constellation-muted">
        {l(
          'Choose a product to see its whole path back to the sources.',
          'Välj en produkt för att se hela vägen tillbaka till källorna.',
        )}
      </p>
      <ul className="constellation-products">
        {graph.nodes
          .filter((n) => n.type === 'frontend')
          .map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => onSelect(n.id)}>
                <strong>{n.label}</strong>
                <small>{n.description}</small>
              </button>
            </li>
          ))}
      </ul>
    </>
  )
}

function Detail({
  node,
  graph,
  mode,
  byId,
  lineage,
  quality,
  onSelect,
}: {
  node: GraphNode
  graph: Graph
  mode: Mode
  byId: Map<string, GraphNode>
  lineage: number
  quality: QualityData | null
  onSelect: (id: string | null) => void
}) {
  const { up, down } = neighbours(graph, node.id)
  const joins = graph.edges.filter(
    (e) =>
      e.type === 'relationship' &&
      (e.source === node.id || e.target === node.id),
  )
  const domain = graph.domains.find((d) => d.id === node.domain)
  const list = (ids: string[]) =>
    ids.length ? (
      <ul className="constellation-links">
        {ids.slice(0, 12).map((id) => (
          <li key={id}>
            <button type="button" onClick={() => onSelect(id)}>
              <Marker type={byId.get(id)!.type} /> {byId.get(id)!.label}
            </button>
          </li>
        ))}
        {ids.length > 12 && (
          <li className="constellation-muted">
            {l(`and ${ids.length - 12} more`, `och ${ids.length - 12} till`)}
          </li>
        )}
      </ul>
    ) : (
      <p className="constellation-muted">–</p>
    )
  return (
    <>
      <p className="constellation-kicker">
        <Marker type={node.type} /> {l(...STYLE[node.type].name)}
        {node.kind ? ` · ${node.kind}` : ''}
      </p>
      <h3 className="constellation-node-title">{node.label}</h3>
      {node.description && <p>{node.description}</p>}
      {node.type === 'frontend' && node.href && (
        <p>
          <a className="constellation-cta" href={node.href}>
            {l(`Explore ${node.label}`, `Utforska ${node.label}`)}
          </a>
        </p>
      )}
      {node.url && (
        <p>
          <a href={node.url} target="_blank" rel="noreferrer">
            {node.url.replace(/^https?:\/\//, '')}
          </a>
        </p>
      )}
      <dl className="constellation-meta">
        <div>
          <dt>{l('Domain', 'Domän')}</dt>
          <dd>{domain?.label ?? node.domain}</dd>
        </div>
        <div>
          <dt>{l('Layer', 'Lager')}</dt>
          <dd>{node.layer}</dd>
        </div>
        {node.path && (
          <div>
            <dt>{l('Repository path', 'Sökväg i repot')}</dt>
            <dd>
              {node.type === 'delivery' ? (
                <code>{node.path}</code>
              ) : (
                <a href={GITHUB + node.path} target="_blank" rel="noreferrer">
                  <code>{node.path}</code>
                </a>
              )}
            </dd>
          </div>
        )}
        {node.materialized && (
          <div>
            <dt>{l('Materialisation', 'Materialisering')}</dt>
            <dd>{node.materialized}</dd>
          </div>
        )}
        {node.keys && node.keys.length > 0 && (
          <div>
            <dt>{l('Key', 'Nyckel')}</dt>
            <dd>
              <code>{node.keys.join(', ')}</code>
            </dd>
          </div>
        )}
        {node.rows != null && (
          <div>
            <dt>{l('Rows', 'Rader')}</dt>
            <dd>{num(node.rows)}</dd>
          </div>
        )}
        {node.files != null && (
          <div>
            <dt>{l('Files', 'Filer')}</dt>
            <dd>
              {num(node.files)} {Object.keys(node.formats ?? {}).join(', ')}
            </dd>
          </div>
        )}
        {node.enabled === false && (
          <div>
            <dt>{l('Status', 'Status')}</dt>
            <dd>
              {l(
                'Off by default (enabled by a dbt variable)',
                'Avstängd som standard (slås på med en dbt-variabel)',
              )}
            </dd>
          </div>
        )}
      </dl>
      {node.published_by && (
        <>
          <h4>{l('Written by', 'Skrivs av')}</h4>
          <ul className="constellation-plain">
            {node.published_by.map((p) => (
              <li key={p.path}>
                <a href={GITHUB + p.path} target="_blank" rel="noreferrer">
                  <code>{p.path}</code>
                </a>
                {p.legacy && ` (${l('legacy', 'äldre')})`}
              </li>
            ))}
          </ul>
        </>
      )}
      {quality && <NodeQuality node={node} quality={quality} />}
      {mode === 'model' && node.columns && node.columns.length > 0 && (
        <>
          <h4>
            {l('Columns', 'Kolumner')} ({node.column_count})
          </h4>
          <p className="constellation-columns">
            {node.columns.map((c) => (
              <code
                key={c}
                className={node.keys?.includes(c) ? 'is-key' : undefined}
              >
                {c}
              </code>
            ))}
          </p>
        </>
      )}
      {joins.length > 0 && (
        <>
          <h4>{l('Joins', 'Kopplingar')}</h4>
          <ul className="constellation-plain">
            {joins.slice(0, 10).map((e) => {
              const other = e.source === node.id ? e.target : e.source
              return (
                <li key={e.source + e.target}>
                  <button
                    type="button"
                    className="constellation-inline"
                    onClick={() => onSelect(other)}
                  >
                    {byId.get(other)?.label}
                  </button>{' '}
                  <small>
                    {(e.source === node.id ? e.from_cols : e.to_cols)?.join(
                      ', ',
                    )}{' '}
                    · {e.cardinality}
                  </small>
                </li>
              )
            })}
          </ul>
        </>
      )}
      <h4>
        {l('Built from', 'Byggs av')} ({up.length})
      </h4>
      {list(up)}
      <h4>
        {l('Feeds', 'Matar')} ({down.length})
      </h4>
      {list(down)}
      <p className="constellation-muted">
        {l(
          `${lineage - 1} nodes on its full path up- and downstream.`,
          `${lineage - 1} noder på hela vägen upp- och nedströms.`,
        )}
      </p>
      <button
        type="button"
        className="constellation-inline"
        onClick={() => onSelect(null)}
      >
        {l('Clear selection', 'Rensa valet')}
      </button>
    </>
  )
}

const STAGES: { types: NodeType[]; name: [string, string] }[] = [
  { types: ['source'], name: ['Sources', 'Källor'] },
  { types: ['ingestion'], name: ['Ingestion', 'Inläsning'] },
  { types: ['raw', 'seed'], name: ['Raw data and seeds', 'Rådata och seeds'] },
  {
    types: ['bronze', 'silver'],
    name: ['Bronze and silver models', 'Brons- och silvermodeller'],
  },
  { types: ['ml'], name: ['ML', 'ML'] },
  { types: ['gold'], name: ['Gold models', 'Guldmodeller'] },
  { types: ['delivery'], name: ['Published files', 'Publicerade filer'] },
  { types: ['frontend'], name: ['Products', 'Produkter'] },
  { types: ['shared'], name: ['Infrastructure', 'Infrastruktur'] },
]

/** The same graph as text, by domain and stage; every node a button. */
function Fallback({
  graph,
  onSelect,
}: {
  graph: Graph
  onSelect: (id: string) => void
}) {
  return (
    <section
      className="constellation-fallback ds-container"
      aria-labelledby="constellation-list-title"
    >
      <h2 id="constellation-list-title">
        {l('Architecture by domain', 'Arkitekturen per domän')}
      </h2>
      {[...graph.domains]
        .sort((a, b) => a.lane - b.lane)
        .map((d) => {
          const own = graph.nodes.filter((n) => n.domain === d.id)
          return (
            <details key={d.id}>
              <summary>
                <strong>{d.label}</strong>{' '}
                <small>
                  {d.counts.sources} {l('sources', 'källor')} ·{' '}
                  {d.counts.models} {l('models', 'modeller')} · {d.counts.gold}{' '}
                  {l('gold', 'guld')} · {d.counts.delivery}{' '}
                  {l('file sets', 'filgrupper')}
                </small>
              </summary>
              {STAGES.map((s) => {
                const nodes = own.filter((n) => s.types.includes(n.type))
                if (!nodes.length) return null
                return (
                  <div key={s.name[0]} className="constellation-fallback-stage">
                    <h3>{l(...s.name)}</h3>
                    <ul>
                      {nodes.map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onSelect(n.id)
                              document
                                .getElementById('constellation-map-title')
                                ?.parentElement?.scrollIntoView({
                                  block: 'start',
                                })
                            }}
                          >
                            {n.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </details>
          )
        })}
    </section>
  )
}

function Editorial({ graph }: { graph: Graph }) {
  const count = (t: NodeType) => graph.nodes.filter((n) => n.type === t).length
  return (
    <section
      className="constellation-editorial ds-container"
      aria-label={l('How it works', 'Hur det fungerar')}
    >
      <div>
        <h2>{l('Ingestion', 'Inläsning')}</h2>
        <p>
          {l(
            `${count('ingestion')} Python ingesters call public APIs and download files. Most land what they fetch through one module, rawstore, which stores each response unchanged under warehouse/raw with its URL, time and SHA-256, so every number can be traced to the bytes it came from.`,
            `${count('ingestion')} Python-inläsare anropar öppna API:er och laddar ned filer. De flesta lägger det de hämtar via en modul, rawstore, som sparar varje svar oförändrat under warehouse/raw med URL, tid och SHA-256, så att varje siffra kan spåras till de byte den kom från.`,
          )}
        </p>
      </div>
      <div>
        <h2>{l('Modelling', 'Modellering')}</h2>
        <p>
          {l(
            `dbt builds the warehouse in DuckDB in three layers: bronze views read the raw files as they are (${count('bronze')} models), silver cleans and joins them (${count('silver')}), and gold holds facts, dimensions and marts (${count('gold')}), with shared dimensions for dates, periods, regions and indicators. Keys and relationships are tested in dbt; analytical stages such as the embeddings and clustering run in Python and enter the warehouse as sources.`,
            `dbt bygger lagret i DuckDB i tre lager: bronsvyer läser rådatafilerna som de är (${count('bronze')} modeller), silver rensar och kopplar ihop (${count('silver')}), och guld håller fakta, dimensioner och marts (${count('gold')}), med gemensamma dimensioner för datum, perioder, regioner och indikatorer. Nycklar och relationer testas i dbt; analytiska steg som inbäddningar och klustring körs i Python och kommer in i lagret som källor.`,
          )}
        </p>
      </div>
      <div>
        <h2>{l('Delivery', 'Leverans')}</h2>
        <p>
          {l(
            `Export scripts write the gold tables as small JSON files and Parquet (${count('delivery')} file sets here). A catalogue lists every published file with its hash and format, and a delivery manifest tells the site where each is served from: JSON with the site, Parquet and document shards from Cloudflare R2. The React pages read through that manifest, never a hard-coded URL.`,
            `Exportskript skriver guldtabellerna som små JSON-filer och Parquet (${count('delivery')} filgrupper här). En katalog listar varje publicerad fil med hash och format, och ett leveransmanifest talar om för sajten var varje fil serveras: JSON med sajten, Parquet och dokumentdelar från Cloudflare R2. React-sidorna läser via manifestet, aldrig via en hårdkodad adress.`,
          )}
        </p>
      </div>
      <div className="constellation-principles">
        <h2>{l('Principles', 'Principer')}</h2>
        <ul>
          <li>
            {l(
              'Raw data preserved, with provenance',
              'Rådata bevaras, med härkomst',
            )}
          </li>
          <li>{l('Models tested in dbt', 'Modeller testade i dbt')}</li>
          <li>
            {l(
              'Lineage read from the code, not drawn',
              'Härkomst läst ur koden, inte ritad',
            )}
          </li>
          <li>
            {l(
              'Every published file catalogued with its hash',
              'Varje publicerad fil katalogiserad med hash',
            )}
          </li>
          <li>
            {l(
              'Heavy files served from object storage',
              'Tunga filer serveras från objektlagring',
            )}
          </li>
        </ul>
        <p className="constellation-muted">
          {l(
            `Generated ${graph.generated_at?.slice(0, 10) ?? ''} from dbt ${graph.dbt_version ?? ''} and the registry in platform/architecture/.`,
            `Genererad ${graph.generated_at?.slice(0, 10) ?? ''} från dbt ${graph.dbt_version ?? ''} och registret i platform/architecture/.`,
          )}
        </p>
      </div>
    </section>
  )
}

/** The quality checks and validity analyses registered for a node, if any. */
function NodeQuality({
  node,
  quality,
}: {
  node: GraphNode
  quality: QualityData
}) {
  const checks = quality.checks.filter((c) => nodesOfCheck(c).includes(node.id))
  const product = node.id.startsWith('app:') ? node.id.slice(4) : null
  const analyses = product
    ? quality.validity.filter((a) => a.product_id === product)
    : []
  if (!checks.length && !analyses.length) return null
  const dims = quality.summary.dimensions.filter((d) =>
    checks.some((c) => c.dimension === d.id),
  )
  const main = analyses[0]
  return (
    <div className="constellation-quality">
      <h4>{l('Quality', 'Kvalitet')}</h4>
      <dl className="constellation-meta">
        {dims.map((d) => {
          const cell = cellOf(checks.filter((c) => c.dimension === d.id))!
          return (
            <div key={d.id}>
              <dt>{l(d.label_en, d.label_sv)}</dt>
              <dd>
                <StatusMark status={cell.status} />{' '}
                <small className="constellation-muted">
                  {cellText(cell, l)}
                </small>
              </dd>
            </div>
          )
        })}
      </dl>
      {main && (
        <>
          <h4>{l('Validity', 'Validitet')}</h4>
          <dl className="constellation-meta">
            <div>
              <dt>{l('Target construct', 'Avsett begrepp')}</dt>
              <dd>{main.target_construct}</dd>
            </div>
            <div>
              <dt>{l('Known limitation', 'Känd begränsning')}</dt>
              <dd>
                <StatusMark status={main.analysis_status} validity />{' '}
                {l(
                  main.conclusion_en,
                  main.conclusion_sv ?? main.conclusion_en,
                )}
              </dd>
            </div>
          </dl>
        </>
      )}
      <p>
        <a
          className="constellation-cta"
          href={`#quality${product ? `?produkt=${product}` : ''}`}
        >
          {l('View quality & validity', 'Visa kvalitet och validitet')}
        </a>
      </p>
    </div>
  )
}
