/** The platform itself: how the architecture graph's nodes split across domains. */
import { Frame, useData, type Post } from '../kit'
import { Bars, count, heading, usable } from './txt-kit'
import { l } from '../../i18n'

type Graph = {
  nodes: { id: string; domain: string }[]
  domains: { id: string; label: string }[]
}
const GRAPH = 'architecture/graph.json'
const d = 'platform'
/** Swedish names for the graph's domain labels; a new label shows as it is. */
const SV: Record<string, string> = {
  Politics: 'Politik',
  'Job market': 'Arbetsmarknad',
  'Shared platform': 'Gemensam plattform',
  Sweden: 'Sverige',
  'EU AI Act': 'EU:s AI-förordning',
  'Concept layer': 'Begreppslager',
}
const domainName = (label: string) => l(label, SV[label] ?? label)

/** Nodes per domain, counted from the node list, most first. */
const byDomain = ({ nodes }: Graph) =>
  [...count(nodes, (n) => n.domain ?? 'none')].sort((a, b) => b[1] - a[1])

function ArchStack() {
  const data = usable(useData<Graph>(GRAPH), GRAPH, (g) => g.nodes.length)
  return (
    <Frame data={data}>
      {(g) => {
        const label = new Map(g.domains.map((x) => [x.id, domainName(x.label)]))
        return (
          <Bars
            label={l(
              'Pipeline nodes per domain, most first',
              'Noder i flödet per domän, flest först',
            )}
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
      const found = g.domains.find((x) => x.id === id)?.label
      const name = found ? domainName(found) : id
      return l(
        `${name} is the largest domain, with ${n} of the ${g.nodes.length} nodes in the architecture graph`,
        `${name} är den största domänen, med ${n} av arkitekturgrafens ${g.nodes.length} noder`,
      )
    }),
    note: [
      'Nodes per domain in the architecture graph: sources, ingestion, dbt models, outputs and apps',
      'Noder per domän i arkitekturgrafen: källor, inläsning, dbt-modeller, utdata och appar',
    ],
    render: () => <ArchStack />,
  },
]
