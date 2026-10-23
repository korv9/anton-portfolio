/** Members of the Riksdag and municipal council seats per party. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { pc, PARTIES, XTicks } from './pol-kit'

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

function Beeswarm() {
  const files = usePartyFiles()
  const [focus, setFocus] = useState<string>('SD')
  const ready = files.filter(([, f]) => f && !(f instanceof Error)) as [
    string,
    PartyFile,
  ][]
  const all = ready.flatMap(([p, f]) =>
    f.members.filter((m) => m.born).map((m) => ({ p, born: m.born })),
  )
  const lo = Math.min(...all.map((m) => m.born))
  const hi = Math.max(...all.map((m) => m.born))
  const x = linearScale([lo, hi], [16, 624])
  const stacks = new Map<number, number>()
  return (
    <Frame data={ready.length ? all : null}>
      {(rows) => (
        <>
          <Slicer
            label="Party"
            options={PARTIES}
            value={focus}
            onChange={setFocus}
          />
          <svg
            viewBox="0 0 640 180"
            role="img"
            aria-label="Members by birth year, beeswarm"
          >
            {rows
              .sort((a, b) => a.born - b.born)
              .map((m, i) => {
                const n = stacks.get(m.born) ?? 0
                stacks.set(m.born, n + 1)
                const cy = 82 + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 6.5
                return (
                  <circle
                    key={i}
                    cx={x(m.born)}
                    cy={cy}
                    r={3}
                    fill={pc(m.p)}
                    opacity={m.p === focus ? 1 : 0.25}
                  >
                    <title>{`${m.p} ${m.born}`}</title>
                  </circle>
                )
              })}
            <XTicks
              y={176}
              ticks={[lo, Math.round((lo + hi) / 2), hi].map((v) => ({
                x: x(v),
                label: v,
              }))}
            />
          </svg>
        </>
      )}
    </Frame>
  )
}

function CouncilHistogram() {
  const files = usePartyFiles()
  const [p, setP] = useState<string>('S')
  const f = files.find(([q]) => q === p)![1]
  return (
    <>
      <Slicer label="Party" options={PARTIES} value={p} onChange={setP} />
      <Frame data={f}>
        {(f) => {
          const bins = Array.from({ length: 20 }, () => 0)
          for (const c of f.councils)
            if (c.total)
              bins[Math.min(19, Math.floor((c.seats / c.total) * 40))]++
          const max = Math.max(...bins, 1)
          return (
            <svg
              viewBox="0 0 300 220"
              role="img"
              aria-label={`Municipalities by ${p} council seat share`}
            >
              {bins.map((b, i) => (
                <rect
                  key={i}
                  x={10 + i * 14}
                  y={196 - (b / max) * 186}
                  width={12}
                  height={(b / max) * 186}
                  rx={2}
                  fill={pc(p)}
                >
                  <title>{`${i * 2.5}–${i * 2.5 + 2.5}%: ${b}`}</title>
                </rect>
              ))}
              <XTicks
                y={214}
                ticks={[0, 25, 50].map((v) => ({
                  x: 10 + (v / 2.5) * 14,
                  label: `${v}%`,
                }))}
              />
            </svg>
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
    size: 'wide',
    render: () => <Beeswarm />,
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
    render: () => <CouncilHistogram />,
  },
]
