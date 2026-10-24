/** Swedish statutes: the largest by number of sections. */
import { Frame, useData, type Post } from '../kit'
import { Bars, fmt, heading, usable } from './txt-kit'

type Sfs = { largest: { sfs: string; title: string; sections: number }[] }
const SFS = 'sfs/overview.json'
const d = 'platform'

const bySections = ({ largest }: Sfs) =>
  [...largest].sort((a, b) => b.sections - a.sections)

function SfsLargest() {
  const data = usable(useData<Sfs>(SFS), SFS, (s) => s.largest.length)
  return (
    <Frame data={data}>
      {(s) => (
        <Bars
          label="The largest Swedish statutes by number of sections"
          format={fmt}
          long
          rows={bySections(s).map((l) => ({
            key: l.sfs,
            label: l.title,
            value: l.sections,
          }))}
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-plat-sfs-largest',
    domain: d,
    sources: ['sfs/overview.json'],
    title: heading((s: Sfs) => {
      const [a] = bySections(s)
      return `${a.title} is the largest statute, with ${fmt(a.sections)} sections`
    }),
    note: 'Sections (paragrafer) per statute, the largest in the SFS collection',
    render: () => <SfsLargest />,
  },
]
