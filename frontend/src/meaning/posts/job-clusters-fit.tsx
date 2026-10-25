/** Jobs: the size of the tech-ad clustering run, from cluster-summary.json. */
import { Frame, useData, type Post } from '../kit'
import { CLUSTERS, D, fmt, KpiGrid, pct } from './job-kit'

type Summary = {
  source_size: number
  candidate_count: number
  unique_text_count: number
  diagnostics: { cluster_count: number; noise_share: number }
  clusters: { cluster_id: number; job_count: number }[]
}

function Kpis() {
  const data = useData<Summary>(CLUSTERS)
  return (
    <Frame data={data}>
      {(s) => {
        const sizes = s.clusters
          .filter((c) => c.cluster_id >= 0)
          .map((c) => c.job_count)
        const items: [string, string][] = [
          // The clusters and ads clustered are in the title; four tiles fit a square card.
          [fmt(s.candidate_count), 'candidate ads'],
          [fmt(s.unique_text_count), 'unique texts'],
          [pct(s.diagnostics.noise_share, 1), 'noise'],
        ]
        if (sizes.length)
          items.push([fmt(Math.max(...sizes)), 'largest cluster'])
        return <KpiGrid items={items} />
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-cluster-kpis',
    domain: D,
    sources: ['jobs/cluster-summary.json'],
    title: (s: Summary) =>
      `${s.diagnostics.cluster_count} clusters in ${fmt(s.source_size)} tech job ads`,
    note: 'One clustering run over the text of tech job ads; noise is the share no cluster takes',
    render: () => <Kpis />,
  },
]
