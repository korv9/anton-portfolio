/** Kinds of municipality: four groups from twelve indicators, their sizes and profiles. */
import { useState, type ReactNode } from 'react'
import RankBars from '../../charts/RankBars'
import { Frame, Slicer, focal, useData, type Post } from '../kit'
import { Ranked, fmt } from './wel-kit'
import { l } from '../../i18n'
import { fixed } from '../../format'

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
const INDICATORS: Record<string, [string, string]> = {
  open_unemployment_18_65_pct: ['Unemployment', 'Arbetslöshet'],
  employment_rate_20_64_pct: ['Employment', 'Sysselsättning'],
  ill_health_days: ['Ill-health days', 'Ohälsodagar'],
  median_earned_income_sek: ['Median income', 'Medianinkomst'],
  social_assistance_pct: ['Social assistance', 'Ekonomiskt bistånd'],
  turnout_riksdag_pct: ['Turnout', 'Valdeltagande'],
  eligible_vocational_programme_pct: [
    'School eligibility',
    'Gymnasiebehörighet',
  ],
  log_population: ['Population size', 'Folkmängd'],
  out_commuting_pct: ['Out-commuting', 'Utpendling'],
  in_commuting_pct: ['In-commuting', 'Inpendling'],
  dependency_ratio: ['Dependency ratio', 'Försörjningskvot'],
  post_secondary_25_64_pct: ['Higher education', 'Eftergymnasial utbildning'],
}

/** The stability check of the four-group split, pre-registered in
 * docs/sweden-three-spaces-preregistration.md. */
type Swedens = {
  grouping: {
    n: number
    candidates: Record<
      string,
      { qualifies: boolean; bootstrap_ari: { mean: number; p05: number } }
    >
  }
}
/** The pre-registered bar for the 5th percentile of the bootstrap ARI. */
const ARI_P05_BAR = 0.6

const useSwedens = () => useData<Swedens>('clusters/three-swedens.json')
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
    const both = c.names[String(p.group)]
    const name = both && l(both[0], both[1] ?? both[0])
    return {
      ...p,
      name:
        name && size === p.municipalities
          ? name
          : l(`Group ${p.group + 1}`, `Grupp ${p.group + 1}`),
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
  // The heading's note reads this file; the chart waits for it so the two arrive together.
  const swedens = useSwedens()
  return (
    <Frame data={swedens}>
      {() => (
        <Both>
          {(groups) => {
            const sorted = [...groups].sort(
              (a, b) => b.municipalities - a.municipalities,
            )
            return (
              <div className="mean-bars mean-wel-rank mean-wel-wrap">
                <RankBars
                  label={l(
                    "Municipalities per group, with the towns nearest each group's centre",
                    'Kommuner per grupp, med orterna närmast varje grupps mitt',
                  )}
                  format={(v) => String(v)}
                  rows={sorted.map((p, i) => ({
                    key: String(p.group),
                    label: (
                      <span>
                        {p.name}
                        <small>
                          {l('e.g.', 't.ex.')}{' '}
                          {p.nearest_to_centre.slice(0, 3).join(', ')}
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
      )}
    </Frame>
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
              label={l('Group', 'Grupp')}
              options={groups.map((q) => q.group)}
              format={(k) => groups.find((q) => q.group === k)?.name ?? ''}
              value={p.group}
              onChange={setG}
            />
            <Ranked
              label={l(
                `${p.name}: each indicator's group mean in standard deviations from the average municipality`,
                `${p.name}: gruppens medelvärde per indikator i standardavvikelser från genomsnittskommunen`,
              )}
              format={(v) =>
                `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), 1)}`
              }
              rows={Object.entries(p.standardised_means).map(([k, v]) => ({
                key: k,
                label: INDICATORS[k]
                  ? l(...INDICATORS[k])
                  : k.replace(/_/g, ' '),
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
      'clusters/three-swedens.json',
      'cluster-research/municipalities.json',
      'sweden/similarity/groups.json',
    ],
    // The title and note read the stability check; the group names need the other two files.
    title: (s: Swedens) =>
      l(
        `${s.grouping.n} municipalities in four descriptive groups by twelve indicators`,
        `${s.grouping.n} kommuner i fyra beskrivande grupper efter tolv indikatorer`,
      ),
    note: (s: Swedens) => {
      const k4 = s.grouping.candidates['4']
      const p05 = fixed(k4.bootstrap_ari.p05, 2)
      const bar = fixed(ARI_P05_BAR, 1)
      return k4.qualifies
        ? l(
            `Municipalities per group; under each name, the towns nearest its centre. The groups pass their pre-registered stability check (bootstrap ARI 5th percentile ${p05}, bar ${bar})`,
            `Kommuner per grupp; under varje namn orterna närmast gruppens mitt. Grupperna klarar sin förregistrerade stabilitetskontroll (bootstrap-ARI, 5:e percentilen ${p05}, gräns ${bar})`,
          )
        : l(
            `Municipalities per group; under each name, the towns nearest its centre. The groups failed their pre-registered stability check (bootstrap ARI 5th percentile ${p05} < ${bar}), so they describe, not find`,
            `Kommuner per grupp; under varje namn orterna närmast gruppens mitt. Grupperna klarade inte sin förregistrerade stabilitetskontroll (bootstrap-ARI, 5:e percentilen ${p05} < ${bar}) och är en beskrivning, inget fynd`,
          )
    },
    render: () => <GroupSizes />,
  },
  {
    id: 'wel-similarity-profiles',
    domain: 'sweden',
    sources: [
      'cluster-research/municipalities.json',
      'sweden/similarity/groups.json',
    ],
    title: [
      'What sets each kind of municipality apart',
      'Vad som skiljer varje typ av kommun från de andra',
    ],
    note: [
      'Group mean in standard deviations above (+) or below (−) the average municipality',
      'Gruppens medelvärde i standardavvikelser över (+) eller under (−) genomsnittskommunen',
    ],
    render: () => <Profiles />,
  },
]
