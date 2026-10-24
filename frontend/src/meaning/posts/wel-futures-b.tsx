/** Future themes by party in the Riksdag, and what Sweden's statistics measure. */
import { useState } from 'react'
import { Frame, OTHER, Slicer, focal, useData, type Post } from '../kit'
import { XAxis } from '../axes'
import { Ranked, Svg, axis, fmt, maxOf, pct } from './wel-kit'

/** party, theme, year, future-oriented speeches, of which use the theme. */
type Parties = { rows: [string, string, number, number, number][] }

type Themes = { themes: { id: string; label_en: string }[] }

type Summary = {
  domains: {
    id: string
    label_en: string
    scb_tables: number
    kolada_kpis: number
  }[]
}

const PARTY: Record<string, string> = {
  S: 'Social Democrats',
  M: 'Moderates',
  SD: 'Sweden Democrats',
  C: 'Centre',
  V: 'Left',
  KD: 'Christian Democrats',
  L: 'Liberals',
  MP: 'Greens',
  NYD: 'New Democracy',
}

/** Years pooled per party, so a share rests on enough speeches. */
const SPAN = 4

/** Fewest future-oriented speeches in the span for a party's share to be shown. */
const MIN_SPEECHES = 100

/** Per party with at least MIN_SPEECHES, the theme's share of its future-oriented speeches
 * over the last SPAN years. */
function shares(d: Parties, theme: string) {
  const last = maxOf(d.rows.map((r) => r[2])) ?? 0
  const from = last - SPAN + 1
  const sum = new Map<string, [number, number]>()
  for (const [p, t, y, all, used] of d.rows)
    if (t === theme && y >= from) {
      const s = sum.get(p) ?? [0, 0]
      sum.set(p, [s[0] + all, s[1] + used])
    }
  return {
    period: `${from}–${last}`,
    rows: [...sum]
      .filter(([, [all]]) => all >= MIN_SPEECHES)
      .map(([p, [all, used]]) => ({
        party: p,
        share: (used / all) * 100,
        n: all,
      }))
      .sort((a, b) => b.share - a.share),
  }
}

function PartyDots() {
  const data = useData<Parties>('sweden/futures/parties.json')
  // The theme names come from trends.json, which the feed's other futures posts load anyway.
  const trends = useData<Themes>('sweden/futures/trends.json')
  const [theme, setTheme] = useState('environment')
  return (
    <Frame data={trends}>
      {(t) => (
        <Frame data={data}>
          {(d) => {
            const names = new Map(t.themes.map((th) => [th.id, th.label_en]))
            const { rows } = shares(d, theme)
            const ax = axis(
              rows.map((r) => r.share),
              [130, 560],
            )
            const h = 190 / Math.max(1, rows.length)
            return (
              <>
                <Slicer
                  label="Theme"
                  options={t.themes.map((th) => th.id)}
                  value={theme}
                  onChange={setTheme}
                  format={(k) => names.get(k) ?? k}
                />
                <Svg
                  w={600}
                  h={220}
                  label={`Share of each party's future-oriented speeches that use the theme ${names.get(theme) ?? theme}, %`}
                >
                  {ax.ticks.map((v) => (
                    <line
                      key={v}
                      className="mean-wel-base"
                      x1={ax.y(v)}
                      x2={ax.y(v)}
                      y1={4}
                      y2={196}
                    />
                  ))}
                  {rows.map((r, i) => {
                    const cy = 4 + i * h + h / 2
                    return (
                      <g key={r.party}>
                        <text
                          x={124}
                          y={cy + 4}
                          textAnchor="end"
                          className="mean-wel-name"
                        >
                          {PARTY[r.party] ?? r.party}
                        </text>
                        <line
                          className="mean-wel-base"
                          x1={130}
                          x2={ax.y(r.share)}
                          y1={cy}
                          y2={cy}
                        />
                        <circle
                          cx={ax.y(r.share)}
                          cy={cy}
                          r={5}
                          fill={i === 0 ? focal(true) : OTHER}
                        />
                        <text x={ax.y(r.share) + 9} y={cy + 4}>
                          {pct(r.share, 0)}
                        </text>
                      </g>
                    )
                  })}
                  <XAxis
                    x={ax.y}
                    y={214}
                    ticks={ax.ticks.map((v) => ({ value: v, label: `${v}%` }))}
                  />
                </Svg>
              </>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

/** The life domains, without the bucket for items outside them. */
const domains = (d: Summary) => d.domains.filter((r) => r.id !== 'other')
const count = (r: Summary['domains'][number]) => r.scb_tables + r.kolada_kpis

function MeasuredBars() {
  return (
    <Frame data={useData<Summary>('sweden/measurement/summary.json')}>
      {(d) => (
        <Ranked
          label="SCB statistics tables plus Kolada municipal indicators, counted together, per life domain"
          format={(v) => fmt(v, 0)}
          rows={domains(d).map((r) => ({
            key: r.id,
            label: r.label_en,
            value: count(r),
          }))}
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-future-parties',
    domain: 'sweden',
    sources: ['sweden/futures/parties.json', 'sweden/futures/trends.json'],
    size: 'wide',
    title: (d: Parties) => {
      const { period, rows } = shares(d, 'environment')
      return rows[0]
        ? `Environmental themes took the largest share of future speeches for the ${PARTY[rows[0].party] ?? rows[0].party}, ${period}`
        : 'Future themes by party'
    },
    note: "Share of each party's future-oriented speeches that use the theme; parties with 100 or more such speeches. Source: Riksdagen",
    render: () => <PartyDots />,
  },
  {
    id: 'wel-measured-bars',
    domain: 'sweden',
    sources: ['sweden/measurement/summary.json'],
    title: (d: Summary) => {
      const ds = domains(d)
      const top = [...ds].sort((a, b) => count(b) - count(a))[0]
      return top
        ? `${top.label_en} has the most statistics tables and indicators of the ${ds.length} life domains`
        : 'What Sweden measures'
    },
    note: 'SCB statistics tables plus Kolada municipal indicators, counted together; items outside the domains left out. Sources: SCB, Kolada',
    render: () => <MeasuredBars />,
  },
]
