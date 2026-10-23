/** AI in Riksdag speeches: the share over time and by party, from ai-act/politics/*.json. */
import { focal, Frame, OTHER, useData, type Post } from '../kit'
import { EndLabels, niceDomain, ticksBetween, YAxis } from '../axes'
import { linearScale, niceStep, yearTicks } from '../../charts/scales'
import { partyName } from '../../parties/identity'
import { Bars, isParty, line, pct } from './pol-kit'
import { XLabels } from './job-kit'

type Month = {
  month: string
  speeches: number
  ai_speeches: number
  ai_share_rolling_3m: number
}
type Summary = { phases: { id: string; from?: string }[] }
type PartyYear = { party: string; speeches: number; ai_speeches: number }[]

const MONTHLY = 'ai-act/politics/monthly.json'
const SUMMARY = 'ai-act/politics/summary.json'
const PARTY_YEAR = 'ai-act/politics/party-year.json'

/** The start of each phase after the first, named for the event that opened it. */
const MILESTONE: Record<string, string> = {
  negotiation: 'Proposed',
  after_publication: 'Published',
}

const monthName = (m: string) =>
  new Date(`${m}-01T12:00`).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

const share = (v: number, digits = 1) => pct(v * 100, digits)

/** The share of speeches naming AI over the first calendar year with all twelve months. */
function firstYear(rows: Month[]) {
  const year = rows.find((r) => r.month.endsWith('-01'))?.month.slice(0, 4)
  const inYear = rows.filter((r) => r.month.startsWith(`${year}-`))
  const speeches = inYear.reduce((a, r) => a + r.speeches, 0)
  return year && speeches
    ? {
        year,
        share: inYear.reduce((a, r) => a + r.ai_speeches, 0) / speeches,
      }
    : null
}

function SpeechLine() {
  const months = useData<Month[]>(MONTHLY)
  const summary = useData<Summary>(SUMMARY)
  return (
    <Frame data={months}>
      {(rows) => (
        <Frame data={summary}>
          {(s) => {
            if (rows.length < 2) return null
            const L = 46,
              R = 540,
              T = 22,
              B = 192
            const max = Math.max(...rows.map((r) => r.ai_share_rolling_3m))
            const step = niceStep(max, 4)
            const [lo, hi] = niceDomain(0, max)
            const x = linearScale([0, rows.length - 1], [L, R])
            const y = linearScale([lo, hi], [B, T])
            const last = rows.at(-1)!
            const marks = s.phases.flatMap((p) => {
              const i = p.from
                ? rows.findIndex((r) => r.month >= p.from!.slice(0, 7))
                : -1
              return i >= 0 && MILESTONE[p.id]
                ? [{ x: x(i), label: MILESTONE[p.id] }]
                : []
            })
            return (
              <svg
                viewBox="0 0 600 220"
                role="img"
                aria-label={`Share of Riksdag speeches that mention AI, three-month average, ${rows[0].month} to ${last.month}`}
              >
                <YAxis
                  y={y}
                  ticks={ticksBetween(lo, hi, 4, step)}
                  x0={L}
                  x1={R}
                  format={(v) => share(v, step < 0.01 ? 1 : 0)}
                />
                {marks.map((m) => (
                  <g key={m.label} className="mean-axis mean-ref">
                    <line
                      x1={m.x}
                      x2={m.x}
                      y1={T - 6}
                      y2={B}
                      strokeDasharray="3 3"
                      style={{ stroke: 'var(--mean-muted)' }}
                    />
                    <text x={m.x + 4} y={T - 8}>
                      {m.label}
                    </text>
                  </g>
                ))}
                <path
                  d={line(rows.map((r, i) => [x(i), y(r.ai_share_rolling_3m)]))}
                  fill="none"
                  stroke={focal(true)}
                  strokeWidth={2}
                />
                <EndLabels
                  x={R + 6}
                  top={T}
                  bottom={B}
                  items={[
                    {
                      y: y(last.ai_share_rolling_3m),
                      label: share(last.ai_share_rolling_3m),
                      color: focal(true),
                    },
                  ]}
                />
                <XLabels
                  y={216}
                  items={yearTicks(rows.map((r) => r.month))
                    .filter((t) => +t.label % 2 === 0)
                    .map((t) => ({ x: x(t.index), label: t.label }))}
                />
              </svg>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

/** Each party's share of speeches naming AI over every year in the file, highest first. */
const byParty = (rows: PartyYear) => {
  const m = new Map<string, { ai: number; all: number }>()
  for (const r of rows) {
    if (!isParty(r.party)) continue
    const t = m.get(r.party) ?? { ai: 0, all: 0 }
    t.ai += r.ai_speeches
    t.all += r.speeches
    m.set(r.party, t)
  }
  return [...m]
    .filter(([, t]) => t.all > 0)
    .map(([party, t]) => ({ party, share: t.ai / t.all }))
    .sort((a, b) => b.share - a.share)
}

function PartyBars() {
  return (
    <Frame data={useData<PartyYear>(PARTY_YEAR)}>
      {(rows) => (
        <Bars
          wrap
          label="Share of each party's Riksdag speeches that mention AI"
          format={(v) => share(v, 2)}
          rows={byParty(rows).map((p, i) => ({
            key: p.party,
            label: partyName(p.party),
            value: p.share,
            color: i ? OTHER : focal(true),
          }))}
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-ai-speech-line',
    domain: 'ai-act',
    sources: ['ai-act/politics/monthly.json', 'ai-act/politics/summary.json'],
    size: 'wide',
    title: (rows: Month[]) => {
      const first = firstYear(rows)
      const last = rows.at(-1)
      return first && last
        ? `The share of Riksdag speeches that mention AI went from ${share(first.share)} in ${first.year} to ${share(last.ai_share_rolling_3m)} by ${monthName(last.month)}`
        : 'Riksdag speeches that mention AI'
    },
    note: 'Share of all speeches per month, three-month average; dashed lines mark the AI Act proposal and its publication. Source: Riksdagen open data',
    render: () => <SpeechLine />,
  },
  {
    id: 'pol-ai-party-dots',
    domain: 'ai-act',
    sources: ['ai-act/politics/party-year.json'],
    title: (rows: PartyYear) => {
      const ranked = byParty(rows)
      const [top, low] = [ranked[0], ranked.at(-1)]
      return top && low && low.share > 0
        ? `The ${partyName(top.party)} mention AI in ${share(top.share, 2)} of their speeches, ${Math.round(top.share / low.share)} times the rate of the ${partyName(low.party)}`
        : 'Riksdag speeches that mention AI, by party'
    },
    note: 'Share of each party’s speeches that mention AI, all years in the data pooled. Source: Riksdagen open data',
    render: () => <PartyBars />,
  },
]
