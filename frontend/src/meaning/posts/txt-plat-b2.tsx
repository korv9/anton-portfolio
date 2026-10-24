/** Swedish statutes: how long their passages are, in characters. */
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { Bars, fmt, heading, sum, uniq, usable } from './txt-kit'

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
            {/* Length bins top to bottom, shortest first, so the rows read as a histogram. */}
            <Bars
              label={`${kindName(kind)} of Swedish statutes by length in characters`}
              format={compact}
              focus={null}
              rows={rows.map((r, i) => ({
                key: String(r.up_to),
                label: `${bin(r, rows[i - 1]?.up_to)} characters`,
                value: r.passages,
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
