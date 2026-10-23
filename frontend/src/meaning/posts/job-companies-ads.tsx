/** Jobs: active Data/IT ads and their employers, from company-intelligence.json and workspace.json. */
import { color, Frame, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import {
  arc,
  Big,
  COMPANIES,
  D,
  fmt,
  KpiGrid,
  Legend,
  pct,
  Svg,
  tally,
  WORKSPACE,
} from './job-kit'

type Job = {
  job_id: string
  location: string | null
  normalized_skills: string[]
  seniority: string[]
  remote_evidence: string[]
  publication_date: string
}
type Intel = {
  companies: { company_id: string; employee_size_class: string | null }[]
  jobs: Job[]
  metrics: {
    match_coverage_percentage: number
    total_active_it_ads: number
    verified_company_links: number
    unresolved_matches: number
    ambiguous_matches: number
  }
}
type Workspace = {
  jobs: {
    job_id: string
    analysis: { requirements: { category: string; strength: string }[] }
  }[]
}

function Metrics() {
  const data = useData<Intel>(COMPANIES)
  return (
    <Frame data={data}>
      {(d) => {
        const m = d.metrics
        return (
          <KpiGrid
            items={[
              [fmt(m.total_active_it_ads), 'active ads'],
              [`${m.match_coverage_percentage} %`, 'matched'],
              [fmt(m.verified_company_links), 'verified links'],
              [fmt(d.companies.length), 'employers'],
              [fmt(m.unresolved_matches), 'unresolved'],
              [fmt(m.ambiguous_matches), 'ambiguous'],
            ]}
          />
        )
      }}
    </Frame>
  )
}

function SeniorityDonut() {
  const data = useData<Intel>(COMPANIES)
  return (
    <Frame data={data}>
      {(d) => {
        const rows = tally(d.jobs.map((j) => j.seniority[0] ?? 'unstated'))
        const total = d.jobs.length || 1
        let a = 0
        return (
          <>
            <Svg
              w={400}
              h={400}
              label="Donut of stated seniority in active ads"
            >
              {rows.map(([k, v], i) => {
                const a0 = a
                a += (v / total) * 2 * Math.PI
                return (
                  <path
                    key={k}
                    d={arc(200, 200, 110, 190, a0, a - 0.015)}
                    fill={color(i)}
                  >
                    <title>{`${k}: ${pct(v / total, 1)}`}</title>
                  </path>
                )
              })}
              <text
                x={200}
                y={212}
                textAnchor="middle"
                fontSize={34}
                fontWeight={700}
              >
                {fmt(d.jobs.length)}
              </text>
            </Svg>
            <Legend items={rows.map(([k, v], i) => [`${k} ${v}`, color(i)])} />
          </>
        )
      }}
    </Frame>
  )
}

function SkillChord() {
  const data = useData<Intel>(COMPANIES)
  return (
    <Frame data={data}>
      {(d) => {
        const top = tally(d.jobs.flatMap((j) => j.normalized_skills))
          .slice(0, 14)
          .map((r) => r[0])
        const ang = (i: number) => (i / top.length) * 2 * Math.PI
        const pt = (i: number, r: number) => [
          200 + r * Math.sin(ang(i)),
          200 - r * Math.cos(ang(i)),
        ]
        const pairs = new Map<string, number>()
        for (const j of d.jobs) {
          const s = top.filter((k) => j.normalized_skills.includes(k))
          for (let a = 0; a < s.length; a++)
            for (let b = a + 1; b < s.length; b++)
              pairs.set(
                `${s[a]}|${s[b]}`,
                (pairs.get(`${s[a]}|${s[b]}`) ?? 0) + 1,
              )
        }
        const max = Math.max(1, ...pairs.values())
        return (
          <>
            <Svg
              w={400}
              h={400}
              label="Chord diagram of skills named together in the same ad"
            >
              {[...pairs].map(([k, v]) => {
                const [a, b] = k.split('|').map((s) => top.indexOf(s))
                const [x1, y1] = pt(a, 160),
                  [x2, y2] = pt(b, 160)
                return (
                  <path
                    key={k}
                    d={`M${x1},${y1}Q200,200 ${x2},${y2}`}
                    fill="none"
                    stroke={color(a)}
                    strokeWidth={1 + (v / max) * 9}
                    opacity={0.35}
                  >
                    <title>{`${k.replace('|', ' + ')}: ${v} ads`}</title>
                  </path>
                )
              })}
              {top.map((k, i) => (
                <path
                  key={k}
                  d={arc(200, 200, 166, 182, ang(i) + 0.03, ang(i + 1) - 0.03)}
                  fill={color(i)}
                >
                  <title>{k}</title>
                </path>
              ))}
            </Svg>
            <Legend items={top.map((k, i) => [k, color(i)])} />
          </>
        )
      }}
    </Frame>
  )
}

function Requirements() {
  const data = useData<Workspace>(WORKSPACE)
  return (
    <Frame data={data}>
      {(w) => {
        const reqs = w.jobs.flatMap((j) => j.analysis.requirements)
        const cats = tally(reqs.map((r) => r.category))
        const strengths = tally(reqs.map((r) => r.strength)).map((r) => r[0])
        const x = linearScale([0, cats[0]?.[1] ?? 1], [110, 390])
        const rowH = 360 / Math.max(1, cats.length)
        return (
          <>
            <Svg
              w={400}
              h={370}
              label="Stacked bars of requirement types and how firmly they are stated"
            >
              {cats.map(([c], j) => {
                let x0 = 110
                return (
                  <g key={c}>
                    <text
                      x={104}
                      y={j * rowH + rowH / 2 + 4}
                      textAnchor="end"
                      fontSize={10}
                    >
                      {c.replace('_', ' ')}
                    </text>
                    {strengths.map((s, k) => {
                      const n = reqs.filter(
                        (r) => r.category === c && r.strength === s,
                      ).length
                      const w0 = x(n) - 110
                      x0 += w0
                      return (
                        <rect
                          key={s}
                          x={x0 - w0}
                          y={j * rowH + 3}
                          width={w0}
                          height={rowH - 6}
                          fill={color(k)}
                        >
                          <title>{`${c}, ${s}: ${n}`}</title>
                        </rect>
                      )
                    })}
                  </g>
                )
              })}
            </Svg>
            <Legend items={strengths.map((s, k) => [s, color(k)])} />
          </>
        )
      }}
    </Frame>
  )
}

function Remote() {
  const data = useData<Intel>(COMPANIES)
  return (
    <Frame data={data}>
      {(d) => (
        <Big
          value={pct(
            d.jobs.filter((j) => j.remote_evidence.length).length /
              (d.jobs.length || 1),
          )}
          unit="of ads mention remote work"
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-co-remote',
    domain: D,
    sources: ['jobs/company-intelligence.json'],
    render: () => <Remote />,
  },
  {
    id: 'job-co-chord',
    domain: D,
    sources: ['jobs/company-intelligence.json'],
    render: () => <SkillChord />,
  },
  {
    id: 'job-co-metrics',
    domain: D,
    sources: ['jobs/company-intelligence.json'],
    render: () => <Metrics />,
  },
  {
    id: 'job-co-seniority',
    domain: D,
    sources: ['jobs/company-intelligence.json'],
    render: () => <SeniorityDonut />,
  },
  {
    id: 'job-ws-requirements',
    domain: D,
    sources: ['jobs/workspace.json'],
    render: () => <Requirements />,
  },
]
