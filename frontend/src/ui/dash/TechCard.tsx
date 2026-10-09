/**
 * "Så är datan byggd": how a page's numbers are made, in three tabs. Schema shows the fact,
 * its dimensions and the marts with their keys; Rows shows the fact's SQL and five rows from
 * the warehouse; Pipeline lists the steps and how they run. Schema and rows are read from
 * schema/models.json and schema/samples, which dbt writes, so they follow the models.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { fetchJson } from '../../welfare/data'
import { ChartCard } from './Dash'

type Column = { name: string; type: string | null; tests: string[] }
type Model = {
  id: string
  name: string
  tests: string[]
  columns: Column[]
  rows: number | null
  sql: string | null
  has_sample: boolean
}
type Schema = {
  nodes: Model[]
  links: { from: string; column: string; to: string; field: string }[]
}
type Sample = {
  columns: string[]
  rows: (string | number | boolean | null)[][]
}

let schemaPromise: Promise<Schema> | null = null
const loadSchema = () =>
  (schemaPromise ??= fetchJson<Schema>('schema/models.json').catch((e) => {
    schemaPromise = null
    throw e
  }))

export type Step = { title: string; detail: string }

const number = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))

/**
 * The primary key: the columns a model-level unique test names, e.g.
 * "unique (session, roll_call_id)", or the one column tested unique.
 */
function keyOf(model: Model) {
  const test = model.tests.find((t) => t.startsWith('unique'))
  const match = test?.match(/\(([^)]*)\)/)
  if (match) return match[1].split(',').map((s) => s.trim())
  return model.columns
    .filter((c) => c.tests.includes('unique'))
    .map((c) => c.name)
}

function ModelBox({
  model,
  tag,
  foreign,
}: {
  model: Model
  tag: string
  foreign: Set<string>
}) {
  const keys = keyOf(model)
  const columns = [
    ...model.columns.filter((c) => keys.includes(c.name)),
    ...model.columns.filter(
      (c) => !keys.includes(c.name) && foreign.has(c.name),
    ),
    ...model.columns.filter(
      (c) => !keys.includes(c.name) && !foreign.has(c.name),
    ),
  ].slice(0, 6)
  return (
    <div className="dk-model">
      <p>
        <b>{model.name}</b> <span>{tag}</span>
      </p>
      <ul>
        {columns.map((c) => (
          <li key={c.name}>
            <i>
              {keys.includes(c.name) ? 'PK' : foreign.has(c.name) ? 'FK' : ''}
            </i>
            <span>{c.name}</span>
            <small>{c.type?.toLowerCase()}</small>
          </li>
        ))}
        {model.columns.length > columns.length && (
          <li className="dk-more">
            {l(
              `+ ${model.columns.length - columns.length} more columns`,
              `+ ${model.columns.length - columns.length} kolumner till`,
            )}
          </li>
        )}
      </ul>
    </div>
  )
}

export default function TechCard({
  sub,
  fact,
  dims,
  marts,
  steps,
  runs,
  span = 8,
}: {
  sub: string
  fact: string
  dims: string[]
  marts: string[]
  steps: Step[]
  /** How the pipeline runs: the workflow and its schedule. */
  runs: string
  span?: number
}) {
  const [tab, setTab] = useState<'schema' | 'rows' | 'pipeline'>('schema')
  const [schema, setSchema] = useState<Schema | null>(null)
  const [sample, setSample] = useState<Sample | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    loadSchema().then(setSchema, () => setError(true))
  }, [])
  const byName = new Map(schema?.nodes.map((n) => [n.name, n]))
  const factModel = byName.get(fact)
  useEffect(() => {
    if (tab !== 'rows' || !factModel?.has_sample || sample) return
    fetchJson<Sample>(
      `schema/samples/${factModel.id.split('.').slice(1).join('.')}.json`,
    )
      .then(setSample)
      .catch(() => setSample({ columns: [], rows: [] }))
  }, [tab, factModel, sample])
  // A fact column is a foreign key where a dimension shown beside it has it as its key, or
  // where dbt's relationship tests link it.
  const foreign = new Set([
    ...(schema?.links ?? [])
      .filter((link) => link.from === factModel?.id)
      .map((link) => link.column),
    ...dims.flatMap((name) => {
      const dim = byName.get(name)
      const key = dim ? keyOf(dim) : []
      return key.length === 1 &&
        factModel?.columns.some((c) => c.name === key[0])
        ? key
        : []
    }),
  ])
  const tabs = [
    ['schema', l('Schema', 'Schema')],
    ['rows', l('Rows', 'Datarader')],
    ['pipeline', l('Pipeline', 'Pipeline')],
  ] as const
  const shownColumns = sample?.columns.slice(0, 7) ?? []
  return (
    <ChartCard
      title={l('How the data is built', 'Så är datan byggd')}
      sub={sub}
      span={span}
      className="dk-tech"
    >
      <div className="dk-tabs" role="tablist" aria-label={l('View', 'Vy')}>
        {tabs.map(([key, name]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {name}
          </button>
        ))}
      </div>
      {error && (
        <p className="dk-empty">
          {l('The model list did not load.', 'Modellistan kunde inte läsas.')}
        </p>
      )}
      {tab === 'schema' && schema && (
        <div className="dk-schema" role="tabpanel">
          {factModel && (
            <ModelBox
              model={factModel}
              tag={l('fact', 'fakta')}
              foreign={foreign}
            />
          )}
          {dims.map((name) => {
            const m = byName.get(name)
            return m ? (
              <ModelBox key={name} model={m} tag="dim" foreign={new Set()} />
            ) : null
          })}
          <div className="dk-marts">
            <p className="dk-sub">{l('Marts', 'Marts')}</p>
            <ul>
              {marts.map((name) => {
                const m = byName.get(name)
                return m ? (
                  <li key={name}>
                    <b>{name}</b>
                    <small>
                      {keyOf(m).length
                        ? `${l('unique', 'unik')}: ${keyOf(m).join(', ')}`
                        : m.rows != null
                          ? `${number(m.rows)} ${l('rows', 'rader')}`
                          : ''}
                    </small>
                  </li>
                ) : null
              })}
            </ul>
          </div>
        </div>
      )}
      {tab === 'rows' && factModel && (
        <div role="tabpanel" className="dk-rows">
          {factModel.sql && (
            <pre className="dk-sql">
              <code>
                {factModel.sql.trim().split('\n').slice(0, 12).join('\n')}
              </code>
            </pre>
          )}
          {sample && sample.rows.length > 0 && (
            <div className="dk-table-wrap" tabIndex={0}>
              <table className="dk-table">
                <caption>
                  {l(
                    `Five of ${number(factModel.rows ?? 0)} rows in ${fact}, first ${shownColumns.length} columns`,
                    `Fem av ${number(factModel.rows ?? 0)} rader i ${fact}, första ${shownColumns.length} kolumnerna`,
                  )}
                </caption>
                <thead>
                  <tr>
                    {shownColumns.map((c) => (
                      <th key={c} scope="col">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sample.rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {row.slice(0, shownColumns.length).map((cell, j) => (
                        <td key={j}>{cell == null ? '–' : String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {tab === 'pipeline' && (
        <div role="tabpanel">
          <ol className="dk-steps">
            {steps.map((s) => (
              <li key={s.title}>
                <b>{s.title}</b>
                <span>{s.detail}</span>
              </li>
            ))}
          </ol>
          <p className="dk-foot">{runs}</p>
        </div>
      )}
    </ChartCard>
  )
}
