/**
 * Seats per party in every Riksdag since 1973, one line per party with its name at the end.
 * A chosen party stays in colour and the rest step back, so one party can be followed through
 * every election. It shows seats, not how voters moved between parties.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { load, type Elections } from '../../parliament/data'
import { RIKSDAG_PARTIES, partyLine, partyName } from '../../parties/identity'
import { Feature, Pick } from '../../charts/feature/Feature'
import MultiLineChart from '../../charts/MultiLineChart'
import './features.css'

const FROM = ['1973', '1998', '2010'] as const
type From = (typeof FROM)[number]

export default function SeatHistory({ party }: { party?: string | null }) {
  const [data, setData] = useState<Elections | null>(null)
  const [from, setFrom] = useState<From>('1973')
  useEffect(() => {
    load<Elections>('parliament/elections.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])
  const years = (data?.years ?? []).filter((y) => y >= Number(from))
  if (!data || years.length < 2) return null

  const seatsAt = (p: string, y: number) =>
    data.results.find((r) => r.election_year === y && r.party === p)?.seats ?? 0
  const first = years[0]
  const last = years.at(-1)!
  const change = (p: string) => seatsAt(p, last) - seatsAt(p, first)
  const ranked = [...RIKSDAG_PARTIES].sort((a, b) => change(b) - change(a))
  const gainer = ranked[0]
  const loser = ranked.at(-1)!
  const largestEvery = RIKSDAG_PARTIES.find((p) =>
    years.every((y) =>
      RIKSDAG_PARTIES.every((q) => seatsAt(p, y) >= seatsAt(q, y)),
    ),
  )
  const shown = party ? [party] : RIKSDAG_PARTIES

  return (
    <Feature
      id="mandat"
      title={l(
        `${largestEvery ? `${partyName(largestEvery)} has been largest in every election since ${first}. ` : ''}${partyName(gainer)} gained most seats (${seatsAt(gainer, first)} → ${seatsAt(gainer, last)}), ${partyName(loser)} lost most (${seatsAt(loser, first)} → ${seatsAt(loser, last)}).`,
        `${largestEvery ? `${partyName(largestEvery)} har varit störst i varje val sedan ${first}. ` : ''}${partyName(gainer)} har vunnit flest mandat (${seatsAt(gainer, first)} → ${seatsAt(gainer, last)}), ${partyName(loser)} tappat flest (${seatsAt(loser, first)} → ${seatsAt(loser, last)}).`,
      )}
      lead={l(
        'Seats per party after each election; the name sits at the end of its line. Choose a party in the party bar to follow only that one.',
        'Mandat per parti efter varje val; namnet står vid slutet av dess linje. Välj ett parti i partiraden för att bara följa det.',
      )}
      controls={
        <Pick
          label={l('From', 'Från')}
          value={from}
          options={FROM.map((f) => ({
            value: f,
            label: l(`From ${f}`, `Från ${f}`),
          }))}
          onChange={setFrom}
        />
      }
      table={
        <table>
          <thead>
            <tr>
              <th>{l('Party', 'Parti')}</th>
              {years.map((y) => (
                <th key={y} className="num">
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RIKSDAG_PARTIES.map((p) => (
              <tr key={p}>
                <td>{partyName(p)}</td>
                {years.map((y) => (
                  <td key={y} className="num">
                    {seatsAt(p, y) || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
      source={l(
        'SCB (1973–2022) and Valmyndigheten (2026), seats per party',
        'SCB (1973–2022) och Valmyndigheten (2026), mandat per parti',
      )}
    >
      <MultiLineChart
        label={l(
          'Seats per party after each election',
          'Mandat per parti efter varje val',
        )}
        format={(v) => String(Math.round(v))}
        colorOf={partyLine}
        series={shown.map((p) => ({
          key: p,
          name: partyName(p),
          party: p,
          points: years.map((y) => ({
            date: `${y}-09-01`,
            label: String(y),
            value: seatsAt(p, y),
          })),
        }))}
      />
    </Feature>
  )
}
