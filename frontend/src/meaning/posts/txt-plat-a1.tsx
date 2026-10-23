/** The platform itself: how the architecture graph's nodes split across domains. */
import { Frame, useData, type Post } from '../kit'
import { Bars, count, heading, usable } from './txt-kit'

type Graph = {
  nodes: { id: string; domain: string }[]
  domains: { id: string; label: string }[]
}
const GRAPH = 'architecture/graph.json'
const d = 'platform'

/** Nodes per domain, counted from the node list, most first. */
const byDomain = ({ nodes }: Graph) =>
  [...count(nodes, (n) => n.domain ?? 'none')].sort((a, b) => b[1] - a[1])

function ArchStack() {
  const data = usable(useData<Graph>(GRAPH), GRAPH, (g) => g.nodes.length)
  return (
    <Frame data={data}>
      {(g) => {
        const label = new Map(g.domains.map((x) => [x.id, x.label]))
        return (
          <Bars
            label="Pipeline nodes per domain, most first"
            format={String}
            long
            rows={byDomain(g).map(([id, n]) => ({
              key: id,
              label: label.get(id) ?? id.replace(/_/g, ' '),
              value: n,
            }))}
          />
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-plat-arch-stack',
    domain: d,
    sources: ['architecture/graph.json'],
    title: heading((g: Graph) => {
      const [[id, n]] = byDomain(g)
      const name = g.domains.find((x) => x.id === id)?.label ?? id
      return `${name} is the largest domain, with ${n} of the ${g.nodes.length} nodes in the architecture graph`
    }),
    note: 'Nodes per domain in the architecture graph: sources, ingestion, dbt models, outputs and apps',
    render: () => <ArchStack />,
  },
]
