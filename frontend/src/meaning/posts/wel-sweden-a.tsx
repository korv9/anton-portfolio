/** Kinds of municipality: four groups from twelve indicators, their sizes and profiles. */
import { useState, type ReactNode } from 'react'
import RankBars from '../../charts/RankBars'
import { Frame, Slicer, focal, useData, type Post } from '../kit'
import { Ranked, fmt } from './wel-kit'

type Clusters = {
  names: Record<string, [string, string]>
  points: [string, number, number, number, string][]
}

type Groups = {
  splits: {
    k: number
    profiles: {
      group: number
      municipalities: number
      nearest_to_centre: string[]
      standardised_means: Record<string, number>
    }[]
  }[]
}

/** The twelve indicators, short enough for a bar label. */
const INDICATORS: Record<string, string> = {
  open_unemployment_18_65_pct: 'Unemployment',
  employment_rate_20_64_pct: 'Employment',
  ill_health_days: 'Ill-health days',
  median_earned_income_sek: 'Median income',
  social_assistance_pct: 'Social assistance',
  turnout_riksdag_pct: 'Turnout',
  eligible_vocational_programme_pct: 'School eligibility',
  log_population: 'Population size',
  out_commuting_pct: 'Out-commuting',
  in_commuting_pct: 'In-commuting',
  dependency_ratio: 'Dependency ratio',
  post_secondary_25_64_pct: 'Higher education',
}

const useClusters = () =>
  useData<Clusters>('cluster-research/municipalities.json')
const useGroups = () => useData<Groups>('sweden/similarity/groups.json')

/**
 * The four-group split with each group's name. The names belong to the clustering in
 * cluster-research; a group is named only where both files count the same municipalities.
 */
function named(c: Clusters, g: Groups) {
  const split = g.splits.find((s) => s.k === 4) ?? g.splits.at(-1)
  return (split?.profiles ?? []).map((p) => {
    const size = c.points.filter((q) => q[3] === p.group).length
    const name = c.names[String(p.group)]?.[0]
    return {
      ...p,
      name: name && size === p.municipalities ? name : `Group ${p.group + 1}`,
    }
  })
}

function Both({
  children,
}: {
  children: (groups: ReturnType<typeof named>) => ReactNode
}) {
  const c = useClusters()
  const g = useGroups()
  return (
    <Frame data={c}>
      {(cd) => <Frame data={g}>{(gd) => children(named(cd, gd))}</Frame>}
    </Frame>
  )
}

function GroupSizes() {
  return (
    <Both>
      {(groups) => {
        const sorted = [...groups].sort(
          (a, b) => b.municipalities - a.municipalities,
        )
        return (
          <div className="mean-bars mean-wel-rank mean-wel-wrap">
            <RankBars
              label="Municipalities per group, with the towns nearest each group's centre"
              format={(v) => String(v)}
              rows={sorted.map((p, i) => ({
                key: String(p.group),
                label: (
                  <span>
                    {p.name}
                    <small>
                      e.g. {p.nearest_to_centre.slice(0, 3).join(', ')}
                    </small>
                  </span>
                ),
                value: p.municipalities,
                color: focal(i === 0),
              }))}
            />
          </div>
        )
      }}
    </Both>
  )
}

function Profiles() {
  const [g, setG] = useState(0)
  return (
    <Both>
      {(groups) => {
        const p = groups.find((x) => x.group === g) ?? groups.at(0)
        if (!p) return null
        return (
          <>
            <Slicer
              label="Group"
              options={groups.map((q) => q.group)}
              format={(k) => groups.find((q) => q.group === k)?.name ?? ''}
              value={p.group}
              onChange={setG}
            />
            <Ranked
              label={`${p.name}: each indicator's group mean in standard deviations from the average municipality`}
              format={(v) =>
                `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), 1)}`
              }
              rows={Object.entries(p.standardised_means).map(([k, v]) => ({
                key: k,
                label: INDICATORS[k] ?? k.replace(/_/g, ' '),
                value: v,
              }))}
            />
          </>
        )
      }}
    </Both>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-cluster-map',
    domain: 'sweden',
    sources: [
      'cluster-research/municipalities.json',
      'sweden/similarity/groups.json',
    ],
    // The group names need both files, and a title reads only the first, so it names none.
    title: (c: Clusters) => {
      const n = new Set(c.points.map((p) => p[3])).size
      return n
        ? `${c.points.length} municipalities sorted into ${n} groups by twelve indicators`
        : 'Kinds of municipality'
    },
    note: 'Municipalities per group, clustered on twelve indicators; under each name, the towns nearest its centre',
    render: () => <GroupSizes />,
  },
  {
    id: 'wel-similarity-profiles',
    domain: 'sweden',
    sources: [
      'cluster-research/municipalities.json',
      'sweden/similarity/groups.json',
    ],
    title: 'What sets each kind of municipality apart',
    note: 'Group mean in standard deviations above (+) or below (−) the average municipality',
    render: () => <Profiles />,
  },
]
