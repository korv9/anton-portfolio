import { t, l } from '../i18n'
import { fetchData } from '../dataSource'
import { useEffect, useMemo, useState } from 'react'

type Row = Record<string, unknown>
type Dataset = {
  id: string
  label: string
  product: string
  rows: number
  path: string
  csv?: string
  grain?: string
  limitations?: string
}
const facets = ['scheme', 'model']
const labels: Record<string, string> = {
  scheme: 'Evaluation split',
  model: 'Model',
}
const display = (value: unknown): string =>
  value == null
    ? '–'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)

/** DrugComb's published result tables (products/datasets.json), searchable and downloadable. */
export default function DataExplorer({
  initialDataset = 'drugcomb_metrics',
  sectionId = 'raw-data',
}: {
  initialDataset?: string
  sectionId?: string
}) {
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
    fetchData('products/datasets.json')
      .then((response) => {
        if (!response.ok)
          throw Error('The dataset catalog could not be loaded.')
        return response.json() as Promise<Dataset[]>
      })
      .then((products) =>
        setDatasets(products.filter((d) => d.product === 'drugcomb')),
      )
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])
  const dataset = datasets.find((item) => item.id === selected)
  useEffect(() => {
    if (!dataset) return
    const controller = new AbortController()
    setLoading(true)
    setRows([])
    setError('')
    setFilters({})
    setQuery('')
    setPage(0)
    fetchData(dataset.path, { signal: controller.signal })
      .then((r) => {
        if (!r.ok)
          throw Error(
            'This dataset could not be loaded. Try another table or reload.',
          )
        return r.json() as Promise<Row[]>
      })
      .then((data) => {
        setRows(data)
        setLoading(false)
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') {
          setError(e.message)
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [dataset])
  const columns = useMemo(() => [...new Set(rows.flatMap(Object.keys))], [rows])
  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          Object.entries(filters).every(
            ([key, value]) => !value || String(row[key]) === value,
          ) &&
          (!query ||
            Object.values(row).some((value) =>
              display(value)
                .toLocaleLowerCase()
                .includes(query.toLocaleLowerCase()),
            )),
      ),
    [rows, query, filters],
  )
  const pageCount = Math.max(1, Math.ceil(visible.length / 25))
  return (
    <section className="report data-explorer" id={sectionId}>
      <p className="eyebrow">{t('Open data desk')}</p>
      <h2>{t('Inspect the records behind the charts.')}</h2>
      <p className="report-intro">
        {l(
          'Search every row of the DrugComb result tables. A download contains the full selected table.',
          'Sök i varje rad i DrugComb-resultattabellerna. En nedladdning innehåller hela den valda tabellen.',
        )}
      </p>
      <div className="explorer-controls">
        <label>
          {t('Dataset')}
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {datasets.map((d) => (
              <option value={d.id} key={d.id}>
                {d.label}, {d.rows.toLocaleString(l('en-GB', 'sv-SE'))}{' '}
                {t('rows')}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Search all columns')}
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder={l(
              'Try a model or a drug',
              'Prova en modell eller ett läkemedel',
            )}
          />
        </label>
      </div>
      <div className="explorer-facets">
        {facets
          .filter((key) => columns.includes(key))
          .map((key) => (
            <label key={key}>
              {t(labels[key])}
              <select
                value={filters[key] ?? ''}
                onChange={(e) => {
                  setFilters({ ...filters, [key]: e.target.value })
                  setPage(0)
                }}
              >
                <option value="">{t('All')}</option>
                {[...new Set(rows.map((row) => String(row[key])))]
                  .sort((a, b) =>
                    a.localeCompare(b, undefined, { numeric: true }),
                  )
                  .map((value) => (
                    <option key={value}>{value}</option>
                  ))}
              </select>
            </label>
          ))}
      </div>
      {dataset && (
        <div className="dataset-context">
          <p>
            <strong>
              {dataset.grain ?? 'Published upstream analysis table'}
            </strong>
            <br />
            {dataset.limitations ||
              'Reported upstream results; no training run is performed by this website.'}
          </p>
          <div>
            <a href={dataset.path} download>
              {t('Download full JSON')}
            </a>
            {dataset.csv && (
              <a href={dataset.csv} download>
                {t('Original CSV')}
              </a>
            )}
          </div>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">{t('Loading selected records…')}</p>
      ) : (
        <>
          <p aria-live="polite">
            {visible.length.toLocaleString(l('en-GB', 'sv-SE'))}{' '}
            {t('matching rows of ')}
            {rows.length.toLocaleString(l('en-GB', 'sv-SE'))}
            {t('. “–” means missing or not applicable.')}
          </p>
          <div
            className="data-table-scroll"
            tabIndex={0}
            aria-label={t('Dataset table, scroll horizontally')}
          >
            <table>
              <caption>{dataset?.label}</caption>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th scope="col" key={column}>
                      {column.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.slice(page * 25, page * 25 + 25).map((row, index) => (
                  <tr key={page * 25 + index}>
                    {columns.map((column) => (
                      <td key={column}>
                        {typeof row[column] === 'string' &&
                        /^https?:\/\//.test(String(row[column])) ? (
                          <a
                            href={String(row[column])}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('Source')}
                          </a>
                        ) : (
                          display(row[column])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visible.length && <p>{t('No rows match these filters.')}</p>}
          <div className="table-pagination">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>
              {t('Previous')}
            </button>
            <span>
              {t('Page ')}
              {page + 1} {t('of ')}
              {pageCount}
            </span>
            <button
              disabled={page + 1 >= pageCount}
              onClick={() => setPage(page + 1)}
            >
              {t('Next')}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
