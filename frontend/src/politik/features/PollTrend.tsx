/**
 * Party support over time with the names at the ends of the lines, not in a legend: SCB's
 * Partisympatiundersökning for every Riksdag party, the election results as rings for scale,
 * and a crosshair that reads every party at one survey. Hover a name to follow one line.
 */
import { useEffect, useMemo, useState, type PointerEvent } from 'react'
import { l } from '../../i18n'
import { load, type Elections } from '../../parliament/data'
import {
  RIKSDAG_PARTIES,
  identity,
  partyLine,
  partyName,
} from '../../parties/identity'
import { Feature, Pick, useWidth } from '../../charts/feature/Feature'
import { monthName, num, pct } from '../controls'
import './features.css'

type PollRow = { survey_month: string; party: string; share_pct: number }
const FROM = ['2014', '2006', '1994', '1973'] as const
type From = (typeof FROM)[number]

const time = (iso: string) => new Date(iso).getTime()

export default function PollTrend({ selected }: { selected: string[] }) {
  const [polls, setPolls] = useState<PollRow[] | null>(null)
  const [elections, setElections] = useState<Elections | null>(null)
  const [from, setFrom] = useState<From>('2014')
  const [focus, setFocus] = useState<string | null>(null)
  const [at, setAt] = useState<string | null>(null)
  const [ref, width] = useWidth<HTMLDivElement>()
  useEffect(() => {
    Promise.all([
      load<{ polls: PollRow[] }>('parliament/polls.json'),
      load<Elections>('parliament/elections.json'),
    ])
      .then(([p, e]) => {
        setPolls(p.polls)
        setElections(e)
      })
      .catch(() => setPolls([]))
  }, [])

  const rows = useMemo(
    () =>
      (polls ?? []).filter(
        (p) =>
          RIKSDAG_PARTIES.includes(p.party) &&
          p.survey_month >= `${from}-01-01`,
      ),
    [polls, from],
  )
  if (!polls?.length || !elections || !rows.length) return null

  const months = [...new Set(rows.map((r) => r.survey_month))].sort()
  const last = months.at(-1)!
  const value = (party: string, month: string) =>
    rows.find((r) => r.party === party && r.survey_month === month)?.share_pct
  const results = elections.results.filter(
    (r) =>
      RIKSDAG_PARTIES.includes(r.party) &&
      r.share_pct != null &&
      r.election_year >= Number(from),
  )
  const narrow = width < 560
  const H = narrow ? 300 : 360
  const pad = { l: 34, r: narrow ? 58 : 170, t: 12, b: 26 }
  const t0 = time(months[0])
  const t1 = Math.max(
    time(last),
    ...results.map((r) => time(`${r.election_year}-09-15`)),
  )
  const x = (iso: string) =>
    pad.l + ((time(iso) - t0) / (t1 - t0 || 1)) * (width - pad.l - pad.r)
  const top =
    Math.ceil(
      (Math.max(
        ...rows.map((r) => r.share_pct),
        ...results.map((r) => r.share_pct!),
      ) +
        2) /
        10,
    ) * 10
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b)
  const ticks = Array.from({ length: top / 10 + 1 }, (_, i) => i * 10)
  const years = [...new Set(months.map((m) => Number(m.slice(0, 4))))]
  const step = Math.ceil(years.length / (narrow ? 4 : 8))
  const yearTicks = years.filter((yr, i) => i % step === 0 && yr > years[0])

  // The names at the ends of the lines, pushed apart so they never overlap.
  const ends = RIKSDAG_PARTIES.map((p) => ({ party: p, v: value(p, last) }))
    .filter((e): e is { party: string; v: number } => e.v != null)
    .map((e) => ({ ...e, y: y(e.v) }))
    .sort((a, b) => a.y - b.y)
  for (let pass = 0; pass < 30; pass++)
    for (let i = 1; i < ends.length; i++)
      if (ends[i].y - ends[i - 1].y < 15) {
        const push = (15 - (ends[i].y - ends[i - 1].y)) / 2
        ends[i].y += push
        ends[i - 1].y -= push
      }

  const chosen = selected.filter((p) => RIKSDAG_PARTIES.includes(p))
  const lit = (p: string) =>
    focus ? p === focus : chosen.length ? chosen.includes(p) : true
  const leader = [...ends].sort((a, b) => b.v - a.v)[0]
  const firstLeader = RIKSDAG_PARTIES.map((p) => ({
    p,
    v: value(p, months[0]),
  }))
    .filter((e): e is { p: string; v: number } => e.v != null)
    .sort((a, b) => b.v - a.v)[0]

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    let best = months[0]
    for (const m of months)
      if (Math.abs(x(m) - px) < Math.abs(x(best) - px)) best = m
    setAt(best)
  }
  const atRows = at
    ? RIKSDAG_PARTIES.map((p) => ({ p, v: value(p, at) }))
        .filter((e): e is { p: string; v: number } => e.v != null)
        .sort((a, b) => b.v - a.v)
    : []

  return (
    <Feature
      id="opinionen"
      title={l(
        `${partyName(leader.party)} is largest in ${monthName(last)}, at ${pct(leader.v, 1)}${firstLeader && firstLeader.p !== leader.party ? `; in ${monthName(months[0])} it was ${partyName(firstLeader.p)}` : ''}.`,
        `${partyName(leader.party)} är störst i ${monthName(last)}, med ${pct(leader.v, 1)}${firstLeader && firstLeader.p !== leader.party ? `; i ${monthName(months[0])} var det ${partyName(firstLeader.p)}` : ''}.`,
      )}
      lead={l(
        'Each line is a party in SCB’s party preference survey; the name sits at the end of its line. Rings are election results. Hover the chart to read every party at one survey, or a name to follow one line.',
        'Varje linje är ett parti i SCB:s partisympatiundersökning; namnet står vid linjens slut. Ringarna är valresultat. Håll över diagrammet för att läsa alla partier vid en mätning, eller över ett namn för att följa en linje.',
      )}
      controls={
        <Pick
          label={l('Period', 'Period')}
          value={from}
          options={FROM.map((f) => ({
            value: f,
            label: l(`Since ${f}`, `Sedan ${f}`),
          }))}
          onChange={setFrom}
        />
      }
      table={
        <table>
          <thead>
            <tr>
              <th>{l('Survey', 'Mätning')}</th>
              {RIKSDAG_PARTIES.map((p) => (
                <th key={p} className="num">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...months].reverse().map((m) => (
              <tr key={m}>
                <td>{monthName(m)}</td>
                {RIKSDAG_PARTIES.map((p) => {
                  const v = value(p, m)
                  return (
                    <td key={p} className="num">
                      {v != null ? num(v, 1) : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      }
      source={l(
        'SCB, Partisympatiundersökningen; SCB and Valmyndigheten, election results',
        'SCB, Partisympatiundersökningen; SCB och Valmyndigheten, valresultat',
      )}
    >
      <div className="trend" ref={ref}>
        <svg
          width={width}
          height={H}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setAt(null)}
          role="img"
          aria-label={ends
            .map((e) => `${partyName(e.party)} ${pct(e.v, 1)}`)
            .join(', ')}
        >
          {ticks.map((t) => (
            <g key={t} className="trend-grid">
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {yearTicks.map((yr) => (
            <text
              key={yr}
              className="trend-year"
              x={x(`${yr}-01-01`)}
              y={H - 6}
              textAnchor="middle"
            >
              {yr}
            </text>
          ))}
          {RIKSDAG_PARTIES.map((p) => {
            const pts = months
              .map((m) => [m, value(p, m)] as const)
              .filter((e): e is readonly [string, number] => e[1] != null)
            if (!pts.length) return null
            return (
              <g
                key={p}
                className={`trend-party${lit(p) ? '' : ' faded'}`}
                style={{ ['--c' as string]: partyLine(p) }}
              >
                <path
                  d={pts
                    .map(
                      ([m, v], i) =>
                        `${i ? 'L' : 'M'}${x(m).toFixed(1)} ${y(v).toFixed(1)}`,
                    )
                    .join(' ')}
                />
                {results
                  .filter((r) => r.party === p)
                  .map((r) => (
                    <circle
                      key={r.election_year}
                      className="trend-election"
                      cx={x(`${r.election_year}-09-15`)}
                      cy={y(r.share_pct!)}
                      r={3.5}
                    />
                  ))}
              </g>
            )
          })}
          {ends.map((e) => (
            <g
              key={e.party}
              className={`trend-end${lit(e.party) ? '' : ' faded'}`}
              style={{ ['--c' as string]: partyLine(e.party) }}
              onPointerEnter={() => setFocus(e.party)}
              onPointerLeave={() => setFocus(null)}
            >
              <line
                x1={width - pad.r + 2}
                x2={width - pad.r + 8}
                y1={y(e.v)}
                y2={e.y}
              />
              <text x={width - pad.r + 11} y={e.y} dy="0.32em">
                <tspan className="trend-name">
                  {narrow ? e.party : identity(e.party).name}
                </tspan>{' '}
                <tspan className="trend-value">{num(e.v, 1)}</tspan>
              </text>
            </g>
          ))}
          {at && (
            <line
              className="trend-cross"
              x1={x(at)}
              x2={x(at)}
              y1={pad.t}
              y2={H - pad.b}
            />
          )}
        </svg>
        {at && (
          <div
            className="feature-tip trend-tip"
            style={{
              left: Math.min(Math.max(x(at), 90), width - 90),
              top: pad.t + 8,
            }}
          >
            <b>{monthName(at)}</b>
            {atRows.map((r) => (
              <span key={r.p} style={{ ['--c' as string]: partyLine(r.p) }}>
                {r.p} {num(r.v, 1)}
              </span>
            ))}
          </div>
        )}
      </div>
    </Feature>
  )
}
