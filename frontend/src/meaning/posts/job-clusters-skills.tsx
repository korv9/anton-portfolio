/** Jobs: the tech-ad clustering run, from cluster-summary.json and cluster-preview.json. */
import { useState } from 'react'
import { focal, Frame, Slicer, useData, type Post } from '../kit'
import { Bars, clusterLabel, CLUSTERS, D, fmt } from './job-kit'
import { l } from '../../i18n'
import { fixed } from '../../format'

type Cluster = {
  cluster_id: number
  cluster_label: string
  top_skills: { skill: string; count: number; lift: number }[]
}
type Summary = { clusters: Cluster[] }

const name = (c: Cluster) => `#${c.cluster_id} ${clusterLabel(c.cluster_label)}`
const topLift = (c: Cluster) => Math.max(0, ...c.top_skills.map((k) => k.lift))
/** Real clusters, the one with the most distinctive skill first: it opens the post. */
const ranked = (s: Summary) =>
  s.clusters
    .filter((c) => c.cluster_id >= 0)
    .sort((a, b) => topLift(b) - topLift(a))

function Skills() {
  const data = useData<Summary>(CLUSTERS)
  const [pick, setPick] = useState<number | null>(null)
  return (
    <Frame data={data}>
      {(s) => {
        const cs = ranked(s)
        const c = cs.find((k) => k.cluster_id === pick) ?? cs[0]
        if (!c) return null
        return (
          <>
            <Slicer
              label={l('Cluster', 'Kluster')}
              options={cs.map((k) => k.cluster_id)}
              format={(id) => {
                const k = cs.find((x) => x.cluster_id === id)
                return k ? name(k) : `#${id}`
              }}
              value={c.cluster_id}
              onChange={setPick}
            />
            <p className="mean-cap">{name(c)}</p>
            <Bars
              label={l(
                `Most distinctive skills in cluster ${name(c)}, by lift`,
                `Mest utmärkande kompetenser i kluster ${name(c)}, efter lyft`,
              )}
              format={(v) => `${fixed(v, 1)}×`}
              rows={[...c.top_skills]
                .sort((a, b) => b.lift - a.lift)
                .map((r, j) => ({
                  key: r.skill,
                  label: r.skill,
                  value: r.lift,
                  color: focal(j === 0),
                  ref: 1,
                  note: `${fmt(r.count)} ${l('ads', 'annonser')}`,
                }))}
            />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-cluster-skills',
    domain: D,
    sources: ['jobs/cluster-summary.json'],
    title: (s: Summary) => {
      const c = ranked(s)[0]
      const k = c && [...c.top_skills].sort((a, b) => b.lift - a.lift)[0]
      return c && k
        ? l(
            `${k.skill} is ${k.lift.toFixed(0)} times as common in ${c.cluster_label} ads as in all tech ads`,
            `${k.skill} är ${k.lift.toFixed(0)} gånger så vanligt i annonser inom ${clusterLabel(c.cluster_label)} som i alla techannonser`,
          )
        : l(
            'Skills that set each cluster apart',
            'Kompetenser som skiljer ut varje kluster',
          )
    },
    note: [
      'Lift: how much more often a skill appears in the cluster than in all tech ads; the tick marks 1×',
      'Lyft: hur mycket oftare en kompetens förekommer i klustret än i alla techannonser; strecket markerar 1×',
    ],
    render: () => <Skills />,
  },
]
