import { useEffect, useMemo, useState } from 'react'

type Row = Record<string, unknown>
type Dataset = { id: string; label: string; product: string; rows: number; path: string; csv?: string; grain?: string; limitations?: string }
type Gold = { tables: Record<string, { path: string; rows: number; grain: string; limitations: string }> }
const facets = ['session', 'party', 'actor', 'budget_year', 'expenditure_area', 'scheme', 'model']
const labels: Record<string, string> = { session: 'Session', party: 'Party', actor: 'Budget proposer', budget_year: 'Budget year', expenditure_area: 'Expenditure area', scheme: 'Evaluation split', model: 'Model' }
const display = (value: unknown): string => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)

export default function DataExplorer({ initialDataset = 'fact_budget_frame', sectionId = 'raw-data' }: { initialDataset?: string; sectionId?: string }) {
  useEffect(() => {
    const openTables = () => {
      if (window.location.hash !== '#' + sectionId) return
      const section = document.getElementById(sectionId)
      const disclosure = section?.closest('details')
      if (disclosure) disclosure.open = true
      section?.scrollIntoView({ block: 'start' })
    }
    openTables()
    window.addEventListener('hashchange', openTables)
    return () => window.removeEventListener('hashchange', openTables)
  }, [sectionId])
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selected, setSelected] = useState(initialDataset)
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [page, setPage] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all(['/data/gold/semantic-model.json', '/data/products/datasets.json'].map(async (path) => {
      const response = await fetch(path)
      if (!response.ok) throw Error('The dataset catalog could not be loaded.')
      return response.json()
    })).then(([gold, products]) => setDatasets([
      ...Object.entries((gold as Gold).tables).map(([id, table]) => ({ ...table, id, label: id.replace(/_/g, ' '), product: id.includes('job_') || id === 'dim_role' ? 'jobs' : id.includes('rfc') ? 'allegoria' : 'politics', path: '/data/gold/' + table.path })),
      ...(products as Dataset[]),
    ])).catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [])
  const dataset = datasets.find((item) => item.id === selected)
  useEffect(() => {
    if (!dataset) return
    const controller = new AbortController()
    setLoading(true); setRows([]); setError(''); setFilters({}); setQuery(''); setPage(0)
    fetch(dataset.path, { signal: controller.signal }).then((r) => {
      if (!r.ok) throw Error('This dataset could not be loaded. Try another table or reload.')
      return r.json() as Promise<Row[]>
    }).then((data) => { setRows(data); setLoading(false) }).catch((e: Error) => {
      if (e.name !== 'AbortError') { setError(e.message); setLoading(false) }
    })
    return () => controller.abort()
  }, [dataset])
  const columns = useMemo(() => [...new Set(rows.flatMap(Object.keys))], [rows])
  const visible = useMemo(() => rows.filter((row) =>
    Object.entries(filters).every(([key, value]) => !value || String(row[key]) === value) &&
    (!query || Object.values(row).some((value) => display(value).toLocaleLowerCase().includes(query.toLocaleLowerCase())))
  ), [rows, query, filters])
  const pageCount = Math.max(1, Math.ceil(visible.length / 25))
  return <section className="report data-explorer" id={sectionId}>
    <p className="eyebrow">Open data desk</p><h2>Inspect the records behind the charts.</h2>
    <p className="report-intro">Search every row in the imported datasets, including budget proposals and decisions without a recorded roll call. Downloads contain the full selected table. Coverage is limited to the imported snapshots.</p>
    <div className="dataset-presets" aria-label="Popular datasets">{[
      ['fact_budget_frame', 'All budget proposals'], ['fact_decision_point', 'All decision points'],
      ['fact_budget_outturn', 'Annual spending outcomes'], ['fact_party_vote', 'Party votes'],
      ['drugcomb_metrics', 'DrugComb evaluations'],
    ].map(([id, title]) => <button key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>{title}</button>)}</div>
    <div className="explorer-controls"><label>Dataset<select value={selected} onChange={(e) => setSelected(e.target.value)}>
      {['politics', 'jobs', 'allegoria', 'drugcomb'].map((product) => <optgroup label={product} key={product}>{datasets.filter((d) => d.product === product).map((d) => <option value={d.id} key={d.id}>{d.label} · {d.rows.toLocaleString('en-GB')} rows</option>)}</optgroup>)}
    </select></label><label>Search all columns<input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} placeholder="Try a decision title, party or document ID" /></label></div>
    <div className="explorer-facets">{facets.filter((key) => columns.includes(key)).map((key) => <label key={key}>{labels[key]}<select value={filters[key] ?? ''} onChange={(e) => { setFilters({ ...filters, [key]: e.target.value }); setPage(0) }}><option value="">All</option>{[...new Set(rows.map((row) => String(row[key])))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((value) => <option key={value}>{value}</option>)}</select></label>)}</div>
    {dataset && <div className="dataset-context"><p><strong>{dataset.grain ?? 'Published upstream analysis table'}</strong><br />{dataset.limitations || (dataset.product === 'drugcomb' ? 'Reported upstream results; no training run is performed by this website.' : 'Source rows retain their original definitions and coverage.')}</p><div><a href={dataset.path} download>Download full JSON</a>{dataset.csv && <a href={dataset.csv} download>Original CSV</a>}<a href="/data/gold/semantic-model.json" download>Definitions & relationships</a></div></div>}
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Loading selected records…</p> : <>
      <p aria-live="polite">{visible.length.toLocaleString('en-GB')} matching rows of {rows.length.toLocaleString('en-GB')}. “—” means missing or not applicable.</p>
      <div className="data-table-scroll" tabIndex={0} aria-label="Dataset table, scroll horizontally"><table><caption>{dataset?.label}</caption><thead><tr>{columns.map((column) => <th scope="col" key={column}>{column.replace(/_/g, ' ')}</th>)}</tr></thead><tbody>{visible.slice(page * 25, page * 25 + 25).map((row, index) => <tr key={page * 25 + index}>{columns.map((column) => <td key={column}>{typeof row[column] === 'string' && /^https?:\/\//.test(String(row[column])) ? <a href={String(row[column])} target="_blank" rel="noreferrer">Source ↗</a> : display(row[column])}</td>)}</tr>)}</tbody></table></div>
      {!visible.length && <p>No rows match these filters.</p>}
      <div className="table-pagination"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {pageCount}</span><button disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Next</button></div>
    </>}
  </section>
}
