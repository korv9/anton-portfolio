/** AI in Riksdag speeches: the share over time and by party, from ai-act/politics/*.json. */
import { l } from '../../i18n'
import { fixed } from '../../format'
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
type PartyYear = {
  party: string
  year: number
  speeches: number
  ai_speeches: number
}[]

const MONTHLY = 'ai-act/politics/monthly.json'
const SUMMARY = 'ai-act/politics/summary.json'
const PARTY_YEAR = 'ai-act/politics/party-year.json'

/** The start of each phase after the first, named for the event that opened it. */
const MILESTONE: Record<string, () => string> = {
  negotiation: () => l('Proposed', 'Föreslagen'),
  after_publication: () => l('Published', 'Publicerad'),
}

const monthName = (m: string) =>
  new Date(`${m}-01T12:00`).toLocaleString(l('en-GB', 'sv-SE'), {
    month: 'long',
    year: 'numeric',
  })

const share = (v: number, digits = 1) => pct(v * 100, digits)

/** The share of speeches naming AI over the first calendar year the data covers from January.
 * Months without sittings, usually July, have no row, so a year can have eleven. */
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

/** Every month but the latest: the file runs to its last speech, so its final month is partial. */
const complete = (rows: Month[]) => rows.slice(0, -1)

function SpeechLine() {
  const months = useData<Month[]>(MONTHLY)
  const summary = useData<Summary>(SUMMARY)
  return (
    <Frame data={months}>
      {(all) => (
        <Frame data={summary}>
          {(s) => {
            const rows = complete(all)
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
                ? [{ x: x(i), label: MILESTONE[p.id]() }]
                : []
            })
            return (
              <svg
                viewBox="0 0 600 220"
                role="img"
                aria-label={l(
                  `Share of Riksdag speeches that mention AI, three-month average, ${rows[0].month} to ${last.month}`,
                  `Andel av anförandena i riksdagen som nämner AI, glidande tremånadersmedel, ${rows[0].month} till ${last.month}`,
                )}
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

/** The party comparison counts from 2023, the window the other AI posts compare over, so a
 * party's early years with few AI speeches do not dilute its rate. */
const FROM = 2023
const span = (rows: PartyYear) =>
  `${FROM}–${Math.max(FROM, ...rows.map((r) => r.year))}`

/** Each party's share of speeches naming AI from FROM on, highest first. */
const byParty = (rows: PartyYear) => {
  const m = new Map<string, { ai: number; all: number }>()
  for (const r of rows) {
    if (!isParty(r.party) || r.year < FROM) continue
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
          label={l(
            "Share of each party's Riksdag speeches that mention AI",
            'Andel av varje partis anföranden i riksdagen som nämner AI',
          )}
          format={(v) => share(v, 2)}
          max={Math.max(1e-9, ...byParty(rows).map((p) => p.share))}
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
      const last = complete(rows).at(-1)
      return first && last
        ? l(
            `The share of Riksdag speeches that mention AI went from ${share(first.share)} in ${first.year} to ${share(last.ai_share_rolling_3m)} by ${monthName(last.month)}`,
            `Andelen anföranden i riksdagen som nämner AI gick från ${share(first.share)} år ${first.year} till ${share(last.ai_share_rolling_3m)} i ${monthName(last.month)}`,
          )
        : l(
            'Riksdag speeches that mention AI',
            'Anföranden i riksdagen som nämner AI',
          )
    },
    note: [
      'Share of speeches per month, three-month average. Dashed: the AI Act proposal and publication. Source: Riksdagen',
      'Andel anföranden per månad, tremånadersmedel. Streckat: förslaget till AI-förordningen och publiceringen. Källa: Riksdagen',
    ],
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
        ? l(
            `The ${partyName(top.party)} mentions AI in ${share(top.share, 2)} of its speeches, ${fixed(top.share / low.share, 1)} times the rate of the ${partyName(low.party)}`,
            `${partyName(top.party)} nämner AI i ${share(top.share, 2)} av sina anföranden, ${fixed(top.share / low.share, 1)} gånger så ofta som ${partyName(low.party)}`,
          )
        : l(
            'Riksdag speeches that mention AI, by party',
            'Anföranden i riksdagen som nämner AI, per parti',
          )
    },
    note: (rows: PartyYear) =>
      l(
        `Share of each party’s speeches that mention AI, ${span(rows)} pooled. Source: Riksdagen open data`,
        `Andel av varje partis anföranden som nämner AI, ${span(rows)} sammanslagna. Källa: Riksdagens öppna data`,
      ),
    render: () => <PartyBars />,
  },
]
