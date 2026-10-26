/** AI Act milestones on one time line, from the proposal to the last deadline. */
import { Frame, OTHER, PALETTE, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Svg, day, heading, usable } from './txt-kit'
import { l } from '../../i18n'

type Milestone = {
  milestone_id: string
  date: string
  title_en: string
  title_sv?: string | null
}
const titleOf = (m: Milestone) => l(m.title_en, m.title_sv || m.title_en)
const TIMELINE = 'ai-act/timeline.json'
const year = (d: string) => Date.parse(`${d.slice(0, 4)}-01-01`)
const d = 'ai-act'
/** The few milestones named on the chart; the rest are dots with a tooltip. */
const SHORT: Record<string, readonly [string, string]> = {
  'document-52021pc0206': ['Proposed', 'Förslag'],
  'entry-into-force': ['In force', 'Ikraft'],
  'prohibitions-and-literacy': ['Bans apply', 'Förbud gäller'],
  'general-application': ['Most rules apply', 'Det mesta gäller'],
  'high-risk-annex-iii': ['High-risk rules', 'Regler för hög risk'],
  'large-scale-it-deadline': ['Last deadline', 'Sista fristen'],
}
const today = () => new Date().toISOString().slice(0, 10)
const sorted = (rows: Milestone[]) =>
  [...rows]
    .filter((m) => !Number.isNaN(Date.parse(m.date)))
    .sort((a, b) => a.date.localeCompare(b.date))
/** The first milestone after today, or none once all have passed. */
const next = (rows: Milestone[], now = today()) =>
  sorted(rows).find((m) => m.date > now)

function Timeline() {
  const data = usable(
    useData<Milestone[]>(TIMELINE),
    TIMELINE,
    (r) => sorted(r).length,
  )
  return (
    <Frame data={data}>
      {(rows) => {
        const items = sorted(rows)
        const [W, H, base] = [600, 200, 120]
        const y0 = +items[0].date.slice(0, 4)
        const y1 = +items.at(-1)!.date.slice(0, 4) + 1
        const x = linearScale(
          [year(String(y0)), year(String(y1))],
          [16, W - 16],
        )
        const now = today()
        const focus = next(items, now)
        // Labels alternate above and below the line, each on the first level it fits.
        const ends = [-1e9, -1e9, -1e9, -1e9]
        const LEVEL = [-22, 26, -44, 48]
        const named = items.flatMap((m) => {
          const px = x(Date.parse(m.date))
          const short = SHORT[m.milestone_id]
          if (!short) return []
          const text = l(...short)
          // Room for the monospace text at the size a phone draws it (about 19 units a
          // line, 12 a character), in drawing units.
          const width = text.length * 12
          // Near the right edge the label ends at its dot instead of starting there.
          const end = px + width > W - 8
          const k = ends.findIndex((e) => e < (end ? px - width : px) - 4)
          if (k < 0) return []
          ends[k] = end ? px : px + width
          return [{ m, px, text, dy: LEVEL[k], end }]
        })
        const yrs = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i)
        return (
          <Svg
            w={W}
            h={H}
            label={l(
              'AI Act milestones from proposal to the last deadline',
              'AI-förordningens milstolpar från förslag till sista fristen',
            )}
          >
            <line
              className="mean-txt-grid"
              x1={16}
              x2={W - 16}
              y1={base}
              y2={base}
            />
            {yrs.map((yr) => (
              <text
                key={yr}
                className="mean-txt-t"
                x={x(year(String(yr)))}
                y={H - 4}
                textAnchor="middle"
              >
                {yr % 2 ? '' : yr}
              </text>
            ))}
            {now > items[0].date && now < items.at(-1)!.date && (
              <g className="mean-axis mean-ref">
                <line
                  x1={x(Date.parse(now))}
                  x2={x(Date.parse(now))}
                  y1={base - 60}
                  y2={base + 60}
                  strokeDasharray="3 3"
                />
                <text x={x(Date.parse(now))} y={base - 64} textAnchor="middle">
                  {l('today', 'idag')}
                </text>
              </g>
            )}
            {named.map(({ m, px, text, dy, end }) => (
              <g key={m.milestone_id}>
                <line
                  x1={px}
                  x2={px}
                  y1={base}
                  y2={base + dy + (dy < 0 ? 4 : -10)}
                  stroke={OTHER}
                  strokeWidth={0.6}
                />
                <text
                  className="mean-txt-v"
                  x={end ? px - 3 : px + 3}
                  y={base + dy}
                  textAnchor={end ? 'end' : 'start'}
                >
                  {text}
                </text>
              </g>
            ))}
            {items.map((m) => (
              <circle
                key={m.milestone_id}
                cx={x(Date.parse(m.date))}
                cy={base}
                r={m === focus ? 5 : 3.5}
                fill={m === focus ? PALETTE[0] : OTHER}
                stroke="var(--paper)"
              >
                <title>{`${day(m.date)}: ${titleOf(m)}`}</title>
              </circle>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-timeline',
    domain: d,
    sources: ['ai-act/timeline.json'],
    size: 'wide',
    title: heading((rows: Milestone[]) => {
      const n = next(rows)
      if (!sorted(rows).length) return ''
      if (!n)
        return l(
          'Every AI Act date in the timeline has passed',
          'Alla datum i AI-förordningens tidslinje har passerats',
        )
      const t = titleOf(n)
      const lower = `${t.charAt(0).toLowerCase()}${t.slice(1)}`
      return l(
        `Next AI Act date: ${day(n.date)}, ${lower}`,
        `Nästa datum i AI-förordningen: ${day(n.date)}, ${lower}`,
      )
    }),
    note: [
      'Milestones from the proposal to the last deadline; the larger dot is the next one',
      'Milstolpar från förslaget till sista fristen; den större punkten är nästa',
    ],
    render: () => <Timeline />,
  },
]
