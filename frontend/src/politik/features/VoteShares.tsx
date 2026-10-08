/**
 * How the parties' members voted over a whole riksmöte: pick a kind of vote (yes, no, abstain,
 * absent) and every party's share of it, ranked. The table has all four for every party.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import { fetchJson } from '../../welfare/data'
import { PartyLogo, RIKSDAG_PARTIES, partyName } from '../../parties/identity'
import { Feature, Pick } from '../../charts/feature/Feature'
import RankBars from '../../charts/RankBars'
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
const KINDS: { kind: Kind; en: string; sv: string }[] = [
  { kind: 'yes', en: 'Yes', sv: 'Ja' },
  { kind: 'no', en: 'No', sv: 'Nej' },
  { kind: 'abstain', en: 'Abstained', sv: 'Avstod' },
  { kind: 'absent', en: 'Absent', sv: 'Frånvarande' },
]
const count = (r: Row, k: Kind) => r[`member_${k}`]
const total = (r: Row) => KINDS.reduce((s, k) => s + count(r, k.kind), 0)

export default function VoteShares() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [session, setSession] = useState('')
  const [focus, setFocus] = useState<Kind>('yes')
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
        `Each bar is the share of a party's member votes in ${chosen}, across ${num(top.decision_points)} decision points. Pick a kind of vote to rank the parties by it.`,
        `Varje stapel är andelen av partiets ledamotsröster under ${chosen}, över ${num(top.decision_points)} beslutspunkter. Välj en sorts röst för att rangordna partierna efter den.`,
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
      <RankBars
        label={l(
          `Share of each party's member votes that were ${kind(focus).en.toLowerCase()}, ${chosen}`,
          `Andel av varje partis ledamotsröster som var ${kind(focus).sv.toLowerCase()}, ${chosen}`,
        )}
        max={100}
        format={(v) => pct(v, 0)}
        rows={shown.map((r) => ({
          key: r.party,
          party: r.party,
          label: (
            <>
              <PartyLogo party={r.party} size={18} />
              {partyName(r.party)}
            </>
          ),
          value: share(r, focus),
        }))}
      />
    </Feature>
  )
}
