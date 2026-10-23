/** AI Act articles, chapters and dates: bars, treemap, waffle, steps, timeline and counts. */
import { Frame, OTHER, PALETTE, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Kpi, Svg, fmt, sum } from './txt-kit'

type Article = {
  article_number: string
  article_sort: number
  chapter: string
  char_count: number
  change_type: string
  applies_from: string | null
  refers_to: string[]
  actors: string[]
}
type Milestone = { milestone_id: string; date: string; title_en: string }
const ARTICLES = 'ai-act/articles.json'
const year = (d: string) => Date.parse(`${d.slice(0, 4)}-01-01`)
const d = 'ai-act'
/** The few milestones named on the chart; the rest are dots with a tooltip. */
const SHORT: Record<string, string> = {
  'document-52021pc0206': 'Proposed',
  'entry-into-force': 'In force',
  'prohibitions-and-literacy': 'Bans apply',
  'general-application': 'Most rules apply',
  'high-risk-annex-iii': 'High-risk rules',
  'large-scale-it-deadline': 'Last deadline',
}
const day = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
/** The first milestone after today, or none once all have passed. */
const next = (rows: Milestone[], now = new Date().toISOString().slice(0, 10)) =>
  [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .find((m) => m.date > now)

function Timeline() {
  const data = useData<Milestone[]>('ai-act/timeline.json')
  return (
    <Frame data={data}>
      {(rows) => {
        const items = [...rows].sort((a, b) => a.date.localeCompare(b.date))
        const [W, H, base] = [600, 200, 120]
        const y0 = +items[0].date.slice(0, 4)
        const y1 = +items.at(-1)!.date.slice(0, 4) + 1
        const x = linearScale(
          [year(String(y0)), year(String(y1))],
          [16, W - 16],
        )
        const now = new Date().toISOString().slice(0, 10)
        const focus = next(items, now)
        // Labels alternate above and below the line, each on the first level it fits.
        const ends = [-1e9, -1e9, -1e9, -1e9]
        const LEVEL = [-22, 26, -44, 48]
        const named = items.flatMap((m) => {
          const px = x(Date.parse(m.date))
          const text = SHORT[m.milestone_id]
          if (!text) return []
          const k = ends.findIndex((e) => e < px - 4)
          if (k < 0) return []
          const width = text.length * 6.5
          ends[k] = px + width
          // Near the right edge the label ends at its dot instead of starting there.
          return [{ m, px, text, dy: LEVEL[k], end: px + width > W - 8 }]
        })
        const yrs = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i)
        return (
          <Svg
            w={W}
            h={H}
            label="AI Act milestones from proposal to the last deadline"
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
            {now < items.at(-1)!.date && (
              <g className="mean-axis mean-ref">
                <line
                  x1={x(Date.parse(now))}
                  x2={x(Date.parse(now))}
                  y1={base - 60}
                  y2={base + 60}
                  strokeDasharray="3 3"
                />
                <text x={x(Date.parse(now))} y={base - 64} textAnchor="middle">
                  today
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
                <title>{`${day(m.date)}: ${m.title_en}`}</title>
              </circle>
            ))}
          </Svg>
        )
      }}
    </Frame>
  )
}
function References() {
  const data = useData<Article[]>(ARTICLES)
  return (
    <Frame data={data}>
      {(rows) => (
        <Kpi
          value={fmt(sum(rows.map((a) => a.refers_to.length)))}
          unit="cross-references"
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-timeline',
    domain: d,
    sources: ['ai-act/timeline.json'],
    title: (rows: Milestone[]) => {
      const n = next(rows)
      return n
        ? `Next AI Act date: ${day(n.date)}, ${n.title_en.charAt(0).toLowerCase()}${n.title_en.slice(1)}`
        : 'Every AI Act date in the timeline has passed'
    },
    note: 'Milestones from proposal (2021) to the last deadline; the larger dot is the next one',
    size: 'wide',
    render: () => <Timeline />,
  },
  {
    id: 'txt-act-references-kpi',
    domain: d,
    sources: ['ai-act/articles.json'],
    render: () => <References />,
  },
]
