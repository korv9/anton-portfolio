/** Swedish statutes: the largest by number of sections. */
import { Frame, useData, type Post } from '../kit'
import { Bars, fmt, heading, usable } from './txt-kit'
import { l } from '../../i18n'

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
          label={l(
            'The largest Swedish statutes by number of sections',
            'De största svenska författningarna efter antal paragrafer',
          )}
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
      return l(
        `${a.title} is the largest statute, with ${fmt(a.sections)} sections`,
        `${a.title} är den största författningen, med ${fmt(a.sections)} paragrafer`,
      )
    }),
    note: [
      'Sections (paragrafer) per statute, the largest in the SFS collection',
      'Paragrafer per författning, de största i SFS-samlingen',
    ],
    render: () => <SfsLargest />,
  },
]
