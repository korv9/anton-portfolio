/**
 * How the parties' members voted over a whole riksmöte: pick a kind of vote (yes, no, abstain,
 * absent) and every party's share of it, ranked. The table has all four for every party.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import { fetchJson } from '../../welfare/data'
import { PartyLogo, RIKSDAG_PARTIES, partyName } from '../../parties/identity'
import { Feature, Pick } from '../../charts/feature/Feature'
import { Stacked } from '../../charts/Compare'
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

export default function VoteShares({ parties = [] }: { parties?: string[] }) {
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
    .filter(
      (r) =>
        r.session === chosen &&
        RIKSDAG_PARTIES.includes(r.party) &&
        (!parties.length || parties.includes(r.party)) &&
        total(r) > 0,
    )
    .sort((a, b) => share(b, focus) - share(a, focus))
  const top = shown[0]
  if (!top)
    return (
      <p role="status">
        {l(
          'No votes recorded for these parties in this session. Show all parties to see the available records.',
          'Inga röster finns för dessa partier under riksmötet. Visa alla partier för att se de tillgängliga uppgifterna.',
        )}
      </p>
    )

  return (
    <Feature
      id="rostrutor"
      title={l(
        `How each party voted, ${chosen}`,
        `Hur varje parti röstade, ${chosen}`,
      )}
      lead={l(
        `Each bar totals 100% of a party's recorded member votes, including absence. ${num(top.decision_points)} decision points in ${chosen}. Ranked by ${KINDS.find((k) => k.kind === focus)!.en.toLowerCase()} share; the figure at right shows that share.`,
        `Varje stapel visar 100 % av partiets registrerade ledamotsröster, inklusive frånvaro. ${num(top.decision_points)} beslutspunkter under ${chosen}. Sorterat efter ${KINDS.find((k) => k.kind === focus)!.sv.toLowerCase()}; siffran till höger visar den andelen.`,
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
      <Stacked
        label={l(
          `Each party's member votes by kind, ${chosen}`,
          `Varje partis ledamotsröster per sort, ${chosen}`,
        )}
        parts={KINDS.map((k, i) => ({
          label: l(k.en, k.sv),
          colour: [
            'var(--color-chart-neutral)',
            'var(--color-chart-muted)',
            'var(--color-panel)',
            'var(--color-surface)',
          ][i],
        }))}
        format={(v) => pct(v, 0)}
        rows={shown.map((r) => ({
          key: r.party,
          label: (
            <>
              <PartyLogo party={r.party} size={18} />
              {partyName(r.party)}
            </>
          ),
          values: KINDS.map((k) => share(r, k.kind)),
          text: pct(share(r, focus), 0),
        }))}
      />
    </Feature>
  )
}
