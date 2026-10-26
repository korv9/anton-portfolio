/** Members of the Riksdag and municipal council seats per party. */
import { l } from '../../i18n'
import { count } from '../../format'
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { niceDomain, ticksBetween, XAxis, YAxis } from '../axes'
import { pc, PARTIES, Sub } from './pol-kit'

type Member = { born: number; gender: string }
type Council = { seats: number; total: number }
type PartyFile = { members: Member[]; councils: Council[] }

/** Every party file, in PARTIES order. */
function usePartyFiles() {
  const files = [
    useData<PartyFile>('politics/parties/v.json'),
    useData<PartyFile>('politics/parties/s.json'),
    useData<PartyFile>('politics/parties/mp.json'),
    useData<PartyFile>('politics/parties/c.json'),
    useData<PartyFile>('politics/parties/l.json'),
    useData<PartyFile>('politics/parties/kd.json'),
    useData<PartyFile>('politics/parties/m.json'),
    useData<PartyFile>('politics/parties/sd.json'),
  ]
  return PARTIES.map((p, i) => [p, files[i]] as const)
}

/** The q-quantile of sorted numbers, interpolated. */
const quantile = (xs: number[], q: number) => {
  const at = (xs.length - 1) * q
  const lo = Math.floor(at)
  return xs[lo] + (xs[Math.ceil(at)] - xs[lo]) * (at - lo)
}

/** Median birth year and the middle half (quartiles) per party, youngest first. */
function BirthYears() {
  const files = usePartyFiles()
  const ready = files.filter(([, f]) => f && !(f instanceof Error)) as [
    string,
    PartyFile,
  ][]
  const rows = ready
    .map(([p, f]) => {
      const b = f.members
        .map((m) => m.born)
        .filter(Boolean)
        .sort((x, y) => x - y)
      return {
        p,
        q1: quantile(b, 0.25),
        mid: quantile(b, 0.5),
        q3: quantile(b, 0.75),
      }
    })
    .filter((r) => !Number.isNaN(r.mid))
    .sort((a, b) => b.mid - a.mid)
  const failed = files
    .map(([, f]) => f)
    .find((f): f is Error => f instanceof Error)
  return (
    <Frame data={failed ?? (ready.length === files.length ? rows : null)}>
      {(rows) => {
        const [lo, hi] = niceDomain(
          Math.min(...rows.map((r) => r.q1)),
          Math.max(...rows.map((r) => r.q3)),
        )
        const x = linearScale([lo, hi], [30, 250])
        const row = (i: number) => 14 + i * 27
        const bottom = row(rows.length - 1) + 12
        return (
          <svg
            viewBox="0 0 300 250"
            role="img"
            aria-label={l(
              'Birth year of members per party: median and middle half',
              'Ledamöternas födelseår per parti: median och mittersta hälften',
            )}
          >
            <g className="mean-axis">
              {ticksBetween(lo, hi).map((t) => (
                <g key={t}>
                  <line x1={x(t)} x2={x(t)} y1={4} y2={bottom} />
                  <text x={x(t)} y={bottom + 14} textAnchor="middle">
                    {t}
                  </text>
                </g>
              ))}
            </g>
            {rows.map((r, i) => (
              <g key={r.p}>
                <line
                  x1={x(r.q1)}
                  x2={x(r.q3)}
                  y1={row(i)}
                  y2={row(i)}
                  stroke={pc(r.p)}
                  strokeWidth={6}
                  strokeLinecap="round"
                  opacity={0.45}
                />
                <circle cx={x(r.mid)} cy={row(i)} r={5.5} fill={pc(r.p)}>
                  <title>
                    {l(
                      `${r.p}: median ${Math.round(r.mid)}, middle half ${Math.round(r.q1)}–${Math.round(r.q3)}`,
                      `${r.p}: median ${Math.round(r.mid)}, mittersta hälften ${Math.round(r.q1)}–${Math.round(r.q3)}`,
                    )}
                  </title>
                </circle>
                <g className="mean-end">
                  <text x={0} y={row(i) + 4}>
                    {r.p}
                  </text>
                  <text x={298} y={row(i) + 4} textAnchor="end">
                    {Math.round(r.mid)}
                  </text>
                </g>
              </g>
            ))}
          </svg>
        )
      }}
    </Frame>
  )
}

function CouncilHistogram() {
  const files = usePartyFiles()
  const [p, setP] = useState<string>('S')
  const f = files.find(([q]) => q === p)![1]
  return (
    <>
      <Slicer
        label={l('Party', 'Parti')}
        options={PARTIES}
        value={p}
        onChange={setP}
      />
      <Frame data={f}>
        {(f) => {
          // 2.5-point bands over the whole 0–100 % range; a full council lands in the last band.
          const bins = Array.from({ length: 40 }, () => 0)
          for (const c of f.councils)
            if (c.total)
              bins[Math.min(39, Math.floor((c.seats / c.total) * 40))]++
          const bx = (v: number) => 32 + (v / 100) * 260
          const [, max] = niceDomain(0, Math.max(...bins, 1))
          const y = linearScale([0, max], [196, 10])
          return (
            <>
              <Sub>{p}</Sub>
              <svg
                viewBox="0 0 300 220"
                role="img"
                aria-label={l(
                  `Municipalities by ${p} share of council seats`,
                  `Kommuner efter ${p}:s andel av fullmäktigemandaten`,
                )}
              >
                <YAxis y={y} ticks={ticksBetween(0, max)} x0={30} x1={296} />
                {bins.map((b, i) => (
                  <rect
                    key={i}
                    x={bx(i * 2.5) + 0.5}
                    y={y(b)}
                    width={5.5}
                    height={y(0) - y(b)}
                    fill={pc(p)}
                  >
                    <title>
                      {l(
                        `${count(i * 2.5)}–${count(i * 2.5 + 2.5)} %: ${b} municipalities`,
                        `${count(i * 2.5)}–${count(i * 2.5 + 2.5)} %: ${b} kommuner`,
                      )}
                    </title>
                  </rect>
                ))}
                <XAxis
                  y={212}
                  x={bx}
                  ticks={[0, 25, 50, 75, 100].map((v) => ({
                    value: v,
                    label: `${v} %`,
                  }))}
                />
              </svg>
            </>
          )
        }}
      </Frame>
    </>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-birth-swarm',
    domain: 'politics',
    sources: [
      'politics/parties/c.json',
      'politics/parties/kd.json',
      'politics/parties/l.json',
      'politics/parties/m.json',
      'politics/parties/mp.json',
      'politics/parties/s.json',
      'politics/parties/sd.json',
      'politics/parties/v.json',
    ],
    title: [
      'Birth year of Riksdag members by party, youngest first',
      'Riksdagsledamöternas födelseår per parti, yngst först',
    ],
    note: [
      'Dot: median; bar: the middle half of members. Source: Riksdagen.',
      'Punkt: median; stapel: den mittersta hälften av ledamöterna. Källa: Riksdagen.',
    ],
    render: () => <BirthYears />,
  },
  {
    id: 'pol-council-hist',
    domain: 'politics',
    sources: [
      'politics/parties/c.json',
      'politics/parties/kd.json',
      'politics/parties/l.json',
      'politics/parties/m.json',
      'politics/parties/mp.json',
      'politics/parties/s.json',
      'politics/parties/sd.json',
      'politics/parties/v.json',
    ],
    title: [
      "Municipalities by a party's share of council seats",
      'Kommuner efter ett partis andel av fullmäktigemandaten',
    ],
    note: [
      'Number of municipalities per 2.5-point band of seat share. Source: Valmyndigheten.',
      'Antal kommuner per intervall om 2,5 procentenheter av mandatandelen. Källa: Valmyndigheten.',
    ],
    render: () => <CouncilHistogram />,
  },
]
