/**
 * The parties in the issue debates as a leaderboard: several measures side by side, each
 * column ranked on its own. Pick a party and it lights up in every column, with a line
 * through its ranks, so one party can be read across all measures at once.
 */
import { useState } from 'react'
import { l } from '../../i18n'
import {
  PartyLogo,
  RIKSDAG_PARTIES,
  partyFill,
  partyName,
} from '../../parties/identity'
import { Feature } from '../../charts/feature/Feature'
import type { IssueDebate } from '../debatter/data'
import { num } from '../controls'
import './features.css'

type Measure = {
  key: string
  en: string
  sv: string
  value: (p: string) => number
  format: (v: number) => string
}

export default function DebateLeaderboard({
  debates,
  session,
  preferred,
}: {
  debates: IssueDebate[]
  session: string
  preferred?: string
}) {
  const [locked, setLocked] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const parties = RIKSDAG_PARTIES.filter((p) =>
    debates.some((d) => d.parties[p]),
  )
  if (!parties.length) return null
  const sum = (p: string, i: 0 | 1) =>
    debates.reduce((s, d) => s + (d.parties[p]?.[i] ?? 0), 0)
  const measures: Measure[] = [
    {
      key: 'debatter',
      en: 'Debates taken part in',
      sv: 'Debatter deltagit i',
      value: (p) => debates.filter((d) => d.parties[p]).length,
      format: (v) => num(v),
    },
    {
      key: 'anforanden',
      en: 'Speeches',
      sv: 'Anföranden',
      value: (p) => sum(p, 0),
      format: (v) => num(v),
    },
    {
      key: 'repliker',
      en: 'Replies',
      sv: 'Repliker',
      value: (p) => sum(p, 1),
      format: (v) => num(v),
    },
    {
      key: 'per',
      en: 'Replies per speech',
      sv: 'Repliker per anförande',
      value: (p) => (sum(p, 0) ? sum(p, 1) / sum(p, 0) : 0),
      format: (v) => num(v, 2),
    },
    {
      key: 'perdebatt',
      en: 'Speeches per debate',
      sv: 'Anföranden per debatt',
      value: (p) => {
        const n = debates.filter((d) => d.parties[p]).length
        return n ? sum(p, 0) / n : 0
      },
      format: (v) => num(v, 2),
    },
  ]
  const ranked = measures.map((m) =>
    [...parties].sort((a, b) => m.value(b) - m.value(a)),
  )
  const focus =
    hover ??
    locked ??
    (preferred && parties.includes(preferred) ? preferred : null)
  const leader = ranked[1][0]
  const fighter = ranked[3][0]
  const rowH = 38

  return (
    <Feature
      id="topplista"
      title={
        leader === fighter
          ? l(
              `${partyName(leader)} spoke most in the issue debates of ${session}, and replied most per speech.`,
              `${partyName(leader)} talade mest i sakdebatterna ${session}, och replikerade mest per anförande.`,
            )
          : l(
              `${partyName(leader)} spoke most in the issue debates of ${session}; ${partyName(fighter)} replied most per speech.`,
              `${partyName(leader)} talade mest i sakdebatterna ${session}; ${partyName(fighter)} replikerade mest per anförande.`,
            )
      }
      lead={l(
        'Each column is one measure, ranked on its own. Hover or click a party to light it up in every column and follow its ranks.',
        'Varje kolumn är ett mått, rangordnat för sig. Håll över eller klicka på ett parti för att tända det i alla kolumner och följa dess placeringar.',
      )}
      table={
        <table>
          <thead>
            <tr>
              <th>{l('Party', 'Parti')}</th>
              {measures.map((m) => (
                <th key={m.key} className="num">
                  {l(m.en, m.sv)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parties.map((p) => (
              <tr key={p}>
                <td>{partyName(p)}</td>
                {measures.map((m) => (
                  <td key={m.key} className="num">
                    {m.format(m.value(p))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
      source={l(
        'Riksdagen, protocols of the chamber debates',
        'Riksdagen, kammarens protokoll',
      )}
    >
      <div
        className="leaderboard-scroll"
        tabIndex={0}
        role="group"
        aria-label={l('Leaderboard', 'Topplista')}
      >
        <div
          className="leaderboard"
          style={{
            ['--cols' as string]: measures.length,
            ['--row' as string]: `${rowH}px`,
          }}
          onMouseLeave={() => setHover(null)}
        >
          {measures.map((m, mi) => (
            <div key={m.key} className="leaderboard-col">
              <h3>{l(m.en, m.sv)}</h3>
              <ol>
                {ranked[mi].map((p, i) => (
                  <li
                    key={p}
                    className={focus ? (p === focus ? 'on' : 'off') : ''}
                    style={{ ['--c' as string]: partyFill(p) }}
                  >
                    <button
                      type="button"
                      aria-pressed={locked === p}
                      onMouseEnter={() => setHover(p)}
                      onFocus={() => setHover(p)}
                      onBlur={() => setHover(null)}
                      onClick={() => setLocked(locked === p ? null : p)}
                      aria-label={`${partyName(p)}, ${l(m.en, m.sv)}: ${m.format(m.value(p))}, ${l('rank', 'plats')} ${i + 1}`}
                    >
                      <span className="leaderboard-rank">{i + 1}</span>
                      <PartyLogo party={p} size={20} />
                      <span className="leaderboard-code">{p}</span>
                      <span className="leaderboard-value">
                        {m.format(m.value(p))}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {focus && (
            <svg className="leaderboard-path" aria-hidden="true">
              {measures.slice(1).map((m, mi) => {
                const a = ranked[mi].indexOf(focus)
                const b = ranked[mi + 1].indexOf(focus)
                return (
                  <line
                    key={m.key}
                    x1={`${((mi + 1) / measures.length) * 100 - 1.2}%`}
                    x2={`${((mi + 1) / measures.length) * 100 + 1.2}%`}
                    y1={a * rowH + rowH / 2}
                    y2={b * rowH + rowH / 2}
                    style={{ stroke: partyFill(focus) }}
                  />
                )
              })}
            </svg>
          )}
        </div>
      </div>
    </Feature>
  )
}
