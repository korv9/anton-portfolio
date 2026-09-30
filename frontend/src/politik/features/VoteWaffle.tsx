/**
 * How the parties' members voted over a whole riksmöte, as one waffle per party: a hundred
 * squares, each one per cent of the party's member votes, coloured yes, no, abstain or absent.
 * Pick a kind of vote and the parties re-order by it and the other colours fade, so one
 * behaviour can be followed across all parties at once.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import { fetchJson } from '../../welfare/data'
import { PartyLogo, RIKSDAG_PARTIES, partyName } from '../../parties/identity'
import { Feature, Pick, useTip } from '../../charts/feature/Feature'
import { num, pct } from '../controls'
import './features.css'

type Row = {
  session: string
  party: string
  decision_points: number
  member_yes: number
  member_no: number
  member_abstain: number
  member_absent: number
}
type Kind = 'yes' | 'no' | 'abstain' | 'absent'
const KINDS: { kind: Kind; en: string; sv: string; color: string }[] = [
  { kind: 'yes', en: 'Yes', sv: 'Ja', color: '#1f78b4' },
  { kind: 'no', en: 'No', sv: 'Nej', color: '#c8413b' },
  { kind: 'abstain', en: 'Abstained', sv: 'Avstod', color: '#b8860b' },
  { kind: 'absent', en: 'Absent', sv: 'Frånvarande', color: '#d9d9d4' },
]
const count = (r: Row, k: Kind) => r[`member_${k}`]
const total = (r: Row) => KINDS.reduce((s, k) => s + count(r, k.kind), 0)

/** Whole squares that add up to exactly 100 (largest remainder). */
function squares(r: Row) {
  const t = total(r)
  const raw = KINDS.map((k) => (count(r, k.kind) / t) * 100)
  const out = raw.map(Math.floor)
  const order = raw
    .map((v, i) => [v - Math.floor(v), i] as const)
    .sort((a, b) => b[0] - a[0])
  for (let i = 0; i < 100 - out.reduce((s, v) => s + v, 0); i++)
    out[order[i][1]]++
  return KINDS.flatMap((k, i) => Array(out[i]).fill(k.kind) as Kind[])
}

export default function VoteWaffle() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [session, setSession] = useState('')
  const [focus, setFocus] = useState<Kind>('yes')
  const { box, show, hide, tip } = useTip()
  useEffect(() => {
    fetchJson<{ data: Row[] }>('politics/parliament/votes/summary.json')
      .then((d) => setRows(d.data))
      .catch(() => setRows([]))
  }, [])
  const sessions = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.session))].sort(),
    [rows],
  )
  if (!rows?.length) return null
  const chosen = sessions.includes(session) ? session : sessions.at(-1)!
  const share = (r: Row, k: Kind) => (count(r, k) / total(r)) * 100
  const shown = rows
    .filter((r) => r.session === chosen && RIKSDAG_PARTIES.includes(r.party))
    .sort((a, b) => share(b, focus) - share(a, focus))
  const top = shown[0]
  const abstain = [...shown].sort(
    (a, b) => share(b, 'abstain') - share(a, 'abstain'),
  )[0]
  const kind = (k: Kind) => KINDS.find((x) => x.kind === k)!

  return (
    <Feature
      id="rostrutor"
      title={l(
        `${partyName(top.party)}: ${pct(share(top, focus), 0)} ${kind(focus).en.toLowerCase()}. ${partyName(abstain.party)} abstained most, ${pct(share(abstain, 'abstain'), 0)} of its votes.`,
        `${partyName(top.party)}: ${pct(share(top, focus), 0)} ${kind(focus).sv.toLowerCase()}. ${partyName(abstain.party)} avstod mest, ${pct(share(abstain, 'abstain'), 0)} av sina röster.`,
      )}
      lead={l(
        `Every square is one per cent of a party's member votes in ${chosen}, across ${num(top.decision_points)} decision points. Pick a kind of vote: the parties re-order by it.`,
        `Varje ruta är en procent av partiets ledamotsröster under ${chosen}, över ${num(top.decision_points)} beslutspunkter. Välj en sorts röst: partierna sorteras om efter den.`,
      )}
      controls={
        <>
          <Pick
            label={l('Kind of vote', 'Sorts röst')}
            value={focus}
            options={KINDS.map((k) => ({
              value: k.kind,
              label: l(k.en, k.sv),
            }))}
            onChange={setFocus}
          />
          {sessions.length > 1 && (
            <Pick
              label={l('Session', 'Riksmöte')}
              value={chosen}
              options={sessions.map((s) => ({ value: s, label: s }))}
              onChange={setSession}
            />
          )}
        </>
      }
      table={
        <table>
          <thead>
            <tr>
              <th>{l('Party', 'Parti')}</th>
              {KINDS.map((k) => (
                <th key={k.kind} className="num">
                  {l(k.en, k.sv)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.party}>
                <td>{partyName(r.party)}</td>
                {KINDS.map((k) => (
                  <td key={k.kind} className="num">
                    {num(count(r, k.kind))} ({pct(share(r, k.kind), 1)})
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
      source={l(
        'Riksdagen, roll-call votes per member',
        'Riksdagen, voteringar per ledamot',
      )}
    >
      <ul className="feature-legend">
        {KINDS.map((k) => (
          <li key={k.kind} style={{ ['--c' as string]: k.color }}>
            {l(k.en, k.sv)}
          </li>
        ))}
      </ul>
      <div className="waffles" ref={box} onMouseLeave={hide}>
        {shown.map((r, i) => (
          <figure
            key={r.party}
            className="waffle"
            style={{ ['--i' as string]: i }}
          >
            <figcaption>
              <PartyLogo party={r.party} size={22} />
              <span>{partyName(r.party)}</span>
              <b>{pct(share(r, focus), 0)}</b>
            </figcaption>
            <div
              className="waffle-grid"
              role="img"
              aria-label={KINDS.map(
                (k) => `${l(k.en, k.sv)} ${pct(share(r, k.kind), 0)}`,
              ).join(', ')}
            >
              {squares(r).map((k, j) => (
                <span
                  key={j}
                  className={k === focus ? 'on' : ''}
                  style={{ background: kind(k).color }}
                  onPointerMove={(e) =>
                    show(
                      e,
                      <>
                        <b>
                          {partyName(r.party)} · {l(kind(k).en, kind(k).sv)}
                        </b>
                        {num(count(r, k))} {l('member votes', 'ledamotsröster')}{' '}
                        · {pct(share(r, k), 1)}
                      </>,
                    )
                  }
                  onPointerDown={(e) =>
                    show(
                      e,
                      <>
                        <b>
                          {partyName(r.party)} · {l(kind(k).en, kind(k).sv)}
                        </b>
                        {num(count(r, k))} {l('member votes', 'ledamotsröster')}{' '}
                        · {pct(share(r, k), 1)}
                      </>,
                    )
                  }
                />
              ))}
            </div>
          </figure>
        ))}
        {tip}
      </div>
    </Feature>
  )
}
