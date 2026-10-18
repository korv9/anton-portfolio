import type { TourNode } from './PipelineTour'
import { REPO } from './techData'

type GraphNode = TourNode & {
  domain: string
  url?: string
  description?: string
}
export type Graph = {
  nodes: GraphNode[]
  edges: { source: string; target: string; type: string }[]
  domains: { id: string; label: string; counts: Record<string, number> }[]
  generated_at: string
  dbt_version: string
}

export function Scripts({ graph }: { graph: Graph }) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const scripts = graph.nodes.filter((n) => n.type === 'ingestion')
  const joined = (id: string, side: 'source' | 'target', type: string) =>
    graph.edges
      .filter((e) => e[side === 'source' ? 'target' : 'source'] === id)
      .map((e) => byId.get(e[side]))
      .filter((n): n is GraphNode => n?.type === type)
  return (
    <div className="tech-scroll" tabIndex={0}>
      <table className="tech-table">
        <thead>
          <tr>
            <th scope="col">Script</th>
            <th scope="col">Subject</th>
            <th scope="col">Reads from</th>
            <th scope="col">Writes raw</th>
            <th scope="col">What it fetches</th>
          </tr>
        </thead>
        <tbody>
          {scripts.map((s) => (
            <tr key={s.id}>
              <th scope="row">
                <a href={`https://github.com/${REPO}/tree/main/${s.path}`}>
                  {s.path}
                </a>
              </th>
              <td>{s.domain}</td>
              <td>
                {joined(s.id, 'source', 'source')
                  .map((n) => n.label)
                  .join(', ') || '–'}
              </td>
              <td>
                {joined(s.id, 'target', 'raw')
                  .map((n) => n.label)
                  .join(', ') || '–'}
              </td>
              <td>{s.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const STAGES: [string, string][] = [
  ['sources', 'Sources'],
  ['ingestion', 'Ingestion'],
  ['raw', 'Raw'],
  ['seeds', 'Seeds'],
  ['models', 'dbt models'],
  ['gold', 'Gold'],
  ['ml', 'ML'],
  ['delivery', 'Delivery'],
  ['products', 'Pages'],
]

export function Stages({ graph }: { graph: Graph }) {
  const top = Object.fromEntries(
    STAGES.map(([key]) => [
      key,
      Math.max(1, ...graph.domains.map((d) => d.counts[key] ?? 0)),
    ]),
  )
  return (
    <div className="tech-scroll" tabIndex={0}>
      <table className="tech-table stages">
        <caption className="visually-hidden">
          What each subject holds at each stage, from source to page
        </caption>
        <thead>
          <tr>
            <th scope="col">Subject</th>
            {STAGES.map(([key, label]) => (
              <th scope="col" key={key} className="num">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {graph.domains.map((d) => (
            <tr key={d.id}>
              <th scope="row">{d.label}</th>
              {STAGES.map(([key]) => {
                const v = d.counts[key] ?? 0
                return (
                  <td
                    key={key}
                    className="num"
                    style={{ ['--share' as string]: v / top[key] }}
                  >
                    {v || '·'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
