/** Swedish statutes: how long their passages are, in characters. */
import { useState } from 'react'
import { Frame, OTHER, Slicer, useData, type Post } from '../kit'
import { YAxis } from '../axes'
import { linearScale, niceTicks } from '../../charts/scales'
import { Svg, fmt, heading, sum, uniq, usable } from './txt-kit'

type Bin = { kind: string; up_to: number | null; passages: number }
type Sfs = { lengths: Bin[] }
const SFS = 'sfs/overview.json'
const d = 'platform'

/** The two ways the statutes are cut into passages. */
const KIND_NAME: Record<string, string> = {
  paragraph: 'Paragraph passages',
  whole_text: 'Whole-text passages',
}
const kindName = (k: string) => KIND_NAME[k] ?? k.replace(/_/g, ' ')
/** 67000 → '67k'. */
const compact = (n: number) => (n >= 1000 ? `${fmt(n / 1000)}k` : fmt(n))
const bin = (r: Bin, prev?: number | null) =>
  r.up_to === null ? `>${fmt(prev ?? 0)}` : `≤${fmt(r.up_to)}`

function SfsLengths() {
  const data = usable(useData<Sfs>(SFS), SFS, (s) => s.lengths.length)
  const [pick, setKind] = useState('paragraph')
  return (
    <Frame data={data}>
      {({ lengths }) => {
        const kinds = uniq(lengths.map((l) => l.kind))
        const kind = kinds.includes(pick) ? pick : kinds[0]
        const rows = lengths.filter((l) => l.kind === kind)
        const [W, H, m, top, bottom] = [300, 220, 40, 14, 30]
        const yt = niceTicks(Math.max(...rows.map((r) => r.passages), 1))
        const y = linearScale([0, yt.at(-1)!], [H - bottom, top])
        const bw = (W - m) / rows.length
        return (
          <>
            <Slicer
              label="Passage kind"
              options={kinds}
              format={kindName}
              value={kind}
              onChange={setKind}
            />
            <p className="mean-cap">{kindName(kind)}</p>
            <Svg
              w={W}
              h={H}
              label={`${kindName(kind)} of Swedish statutes by length in characters`}
            >
              <YAxis y={y} ticks={yt} x0={m} x1={W} format={compact} />
              {rows.map((r, i) => (
                <g key={i}>
                  <rect
                    x={m + i * bw + 3}
                    width={bw - 6}
                    y={y(r.passages)}
                    height={H - bottom - y(r.passages)}
                    fill={OTHER}
                  >
                    <title>{`${bin(r, rows[i - 1]?.up_to)} characters: ${fmt(r.passages)} passages`}</title>
                  </rect>
                  <text
                    className="mean-txt-t"
                    x={m + (i + 0.5) * bw}
                    y={H - bottom + 12}
                    textAnchor="middle"
                  >
                    {bin(r, rows[i - 1]?.up_to)}
                  </text>
                </g>
              ))}
              <text className="mean-txt-t" x={W} y={H - 2} textAnchor="end">
                characters per passage
              </text>
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-plat-sfs-lengths',
    domain: d,
    sources: ['sfs/overview.json'],
    // Names the paragraph passages, so it stays true when the slicer shows whole texts.
    title: heading(({ lengths }: Sfs) => {
      const rows = lengths.filter((l) => l.kind === 'paragraph')
      const n = sum(rows.map((r) => r.passages))
      const short = sum(
        rows
          .filter((r) => r.up_to !== null && r.up_to <= 500)
          .map((r) => r.passages),
      )
      return n
        ? `${Math.round((short / n) * 100)}% of the statutes' paragraph passages are 500 characters or shorter`
        : ''
    }),
    note: 'Passages of Swedish statutes by length in characters; the y axis counts passages',
    render: () => <SfsLengths />,
  },
]
