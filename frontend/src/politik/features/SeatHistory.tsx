/**
 * Seats per party in every Riksdag since 1973, one stroke per party from edge to edge. Only
 * the chosen parties are drawn, so one or a few can be followed through every election.
 * It shows seats, not how voters moved between parties.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { l } from '../../i18n'
import { load, type Elections } from '../../parliament/data'
import { RIKSDAG_PARTIES, partyName } from '../../parties/identity'
import { Feature, Pick } from '../../charts/feature/Feature'
import SeatLines from './SeatLines'
import './features.css'

const FROM = ['1973', '1998', '2010'] as const
type From = (typeof FROM)[number]

export default function SeatHistory({
  parties,
  filter,
}: {
  /** The parties to draw; none means all. */
  parties: string[]
  /** The control that chooses them, shown under the chart. */
  filter?: ReactNode
}) {
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
  const shown = parties.length ? parties : RIKSDAG_PARTIES

  return (
    <Feature
      id="mandat"
      title={l(
        'Seats per party after each election.',
        'Mandat per parti efter varje val.',
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
      <SeatLines
        label={l(
          'Seats per party after each election',
          'Mandat per parti efter varje val',
        )}
        years={years}
        lines={shown.map((p) => ({
          key: p,
          seats: years.map((y) => seatsAt(p, y)),
        }))}
      />
      {filter}
    </Feature>
  )
}
