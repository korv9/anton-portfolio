/** Jobs: active Data/IT ads and their employers, from company-intelligence.json and workspace.json. */
import { useState } from 'react'
import { color, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale, niceTicks } from '../../charts/scales'
import { COMPANIES, D, squarify, Svg, tally, XLabels, YTicks } from './job-kit'

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

function SkillColumns() {
  const data = useData<Intel>(COMPANIES)
  const [n, setN] = useState(20)
  return (
    <Frame data={data}>
      {(d) => {
        const rows = tally(d.jobs.flatMap((j) => j.normalized_skills)).slice(
          0,
          n,
        )
        const ticks = niceTicks(rows[0]?.[1] ?? 1)
        const W = 800,
          B = 280
        const y = linearScale([0, ticks.at(-1)!], [B, 10])
        const bw = (W - 40) / rows.length
        return (
          <>
            <Slicer
              label="Top"
              cycles={false}
              options={[10, 20, 40]}
              value={n}
              onChange={setN}
            />
            <Svg w={W} h={360} label="Skills named in active Data/IT ads">
              <YTicks ticks={ticks} y={y} x0={36} x1={W} />
              {rows.map(([k, v], i) => (
                <g key={k}>
                  <title>{`${k}: ${v} ads`}</title>
                  <rect
                    x={40 + i * bw + 2}
                    y={y(v)}
                    width={bw - 4}
                    height={B - y(v)}
                    rx={3}
                    fill={color(i)}
                  />
                  <text
                    transform={`translate(${40 + i * bw + bw / 2},${B + 8}) rotate(50)`}
                    fontSize={n > 20 ? 8 : 10}
                  >
                    {k}
                  </text>
                </g>
              ))}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

function Locations() {
  const data = useData<Intel>(COMPANIES)
  return (
    <Frame data={data}>
      {(d) => {
        const cells = squarify(
          tally(d.jobs.map((j) => j.location ?? '–')),
          (r) => r[1],
          { x: 0, y: 0, w: 400, h: 400 },
        )
        return (
          <Svg w={400} h={400} label="Treemap of active ads by location">
            {cells.map((c, i) => (
              <g key={c.item[0]}>
                <title>{`${c.item[0]}: ${c.item[1]} ads`}</title>
                <rect
                  x={c.x}
                  y={c.y}
                  width={c.w}
                  height={c.h}
                  fill={color(i)}
                  stroke="var(--paper)"
                  strokeWidth={2}
                  className="mean-job-hover"
                />
              </g>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}

function SizeUnits() {
  const data = useData<Intel>(COMPANIES)
  return (
    <Frame data={data}>
      {(d) => {
        const rows = tally(
          d.companies.map((c) => c.employee_size_class ?? '–'),
        ).sort((a, b) => Number(a[0]) - Number(b[0]))
        const cw = 380 / rows.length
        return (
          <Svg
            w={400}
            h={400}
            label="One dot per employer, grouped by employee size class"
          >
            {rows.map(([k, v], i) =>
              Array.from({ length: v }, (_, n) => (
                <circle
                  key={`${k}-${n}`}
                  cx={14 + i * cw + (n % 2) * (cw / 2) + cw / 4 - 4}
                  cy={370 - Math.floor(n / 2) * 22}
                  r={Math.min(cw / 4 - 1, 9)}
                  fill={color(i)}
                >
                  <title>{`size class ${k}: ${v} employers`}</title>
                </circle>
              )),
            )}
            <XLabels
              y={396}
              items={rows.map(([k], i) => ({
                x: 10 + i * cw + cw / 2,
                label: k,
              }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

function PubDays() {
  const data = useData<Intel>(COMPANIES)
  return (
    <Frame data={data}>
      {(d) => {
        const rows = tally(
          d.jobs.map((j) => j.publication_date.slice(0, 10)),
        ).sort((a, b) => a[0].localeCompare(b[0]))
        const max = Math.max(1, ...rows.map((r) => r[1]))
        const bw = 360 / Math.max(1, rows.length)
        return (
          <Svg w={400} h={400} label="Active ads per publication day">
            {rows.map(([k, v], i) => (
              <g key={k}>
                <title>{`${k}: ${v} ads`}</title>
                {Array.from({ length: Math.ceil(v / 5) }, (_, n) => (
                  <rect
                    key={n}
                    x={20 + i * bw + 4}
                    y={360 - (n + 1) * (330 / Math.ceil(max / 5))}
                    width={bw - 8}
                    height={330 / Math.ceil(max / 5) - 2}
                    rx={3}
                    fill={color(i)}
                  />
                ))}
                <text
                  x={20 + i * bw + bw / 2}
                  y={380}
                  textAnchor="middle"
                  fontSize={10}
                >
                  {k.slice(5)}
                </text>
              </g>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-co-skills',
    domain: D,
    sources: ['jobs/company-intelligence.json'],
    size: 'wide',
    render: () => <SkillColumns />,
  },
  {
    id: 'job-co-locations',
    domain: D,
    sources: ['jobs/company-intelligence.json'],
    render: () => <Locations />,
  },
  {
    id: 'job-co-size',
    domain: D,
    sources: ['jobs/company-intelligence.json'],
    render: () => <SizeUnits />,
  },
  {
    id: 'job-co-days',
    domain: D,
    sources: ['jobs/company-intelligence.json'],
    render: () => <PubDays />,
  },
]
