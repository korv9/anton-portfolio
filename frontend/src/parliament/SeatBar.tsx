import { useState } from 'react'
import { l } from '../i18n'
import { PartyLogo, identity } from '../parties/identity'
import { PARTY_NAMES, partyLabel, type PartyResult } from './data'
import './parliament.css'

type Props = {
  parties: PartyResult[]
  majority: number
  /** Parties selected when the chart first renders, e.g. the governing side. */
  initial?: string[]
}

const TOTAL = 349

/**
 * The 349 seats as one bar, a segment per party with its seats written on it, and a line at
 * the 175 needed for a majority. Clicking parties adds them up, so any combination can be
 * checked against the line; nothing is pre-judged as a bloc.
 */
export default function SeatBar({ parties, majority, initial = [] }: Props) {
  const seated = parties.filter((party) => party.seats > 0)
  const [chosen, setChosen] = useState<string[]>(
    initial.filter((p) => seated.some((s) => s.party === p)),
  )
  const sum = seated
    .filter((party) => chosen.includes(party.party))
    .reduce((total, party) => total + party.seats, 0)
  const toggle = (party: string) =>
    setChosen((current) =>
      current.includes(party)
        ? current.filter((p) => p !== party)
        : [...current, party],
    )
  // Chosen parties first, so the sum reads as one run against the majority line.
  const order = [
    ...seated.filter((p) => chosen.includes(p.party)),
    ...seated.filter((p) => !chosen.includes(p.party)),
  ]
  let offset = 0

  return (
    <div className="seat-bar">
      <div
        className="seat-track"
        role="img"
        aria-label={l(
          `Seats: ${seated.map((p) => `${p.party} ${p.seats}`).join(', ')}`,
          `Mandat: ${seated.map((p) => `${p.party} ${p.seats}`).join(', ')}`,
        )}
      >
        {order.map((party) => {
          const left = (offset / TOTAL) * 100
          offset += party.seats
          return (
            <div
              key={party.party}
              className={
                chosen.includes(party.party)
                  ? 'seat-segment chosen'
                  : chosen.length > 0
                    ? 'seat-segment faded'
                    : 'seat-segment'
              }
              style={{
                left: `${left}%`,
                width: `${(party.seats / TOTAL) * 100}%`,
                background: identity(party.party).color,
                color: identity(party.party).ink,
              }}
              title={`${PARTY_NAMES[party.party] ?? party.party}: ${party.seats}`}
            >
              {party.seats >= 14 && (
                <span>
                  {partyLabel(party.party)} {party.seats}
                </span>
              )}
            </div>
          )
        })}
        <div
          className="seat-majority"
          style={{ left: `${(majority / TOTAL) * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <p className="seat-majority-label">
        {l(
          `${majority} seats make a majority`,
          `${majority} mandat ger majoritet`,
        )}
      </p>
      <div
        className="party-picker"
        role="group"
        aria-label={l('Add up parties', 'Räkna ihop partier')}
      >
        {seated.map((party) => (
          <button
            key={party.party}
            type="button"
            className={
              chosen.includes(party.party) ? 'party-chip on' : 'party-chip'
            }
            aria-pressed={chosen.includes(party.party)}
            style={
              chosen.includes(party.party)
                ? { borderColor: identity(party.party).line }
                : undefined
            }
            onClick={() => toggle(party.party)}
          >
            <PartyLogo party={party.party} size={18} />
            {partyLabel(party.party)}, {party.seats}
          </button>
        ))}
      </div>
      <p className="seat-sum" role="status" data-testid="seat-sum">
        {chosen.length === 0 ? (
          l(
            'Click parties to add up their seats.',
            'Klicka på partier för att räkna ihop deras mandat.',
          )
        ) : (
          <>
            <strong>{sum}</strong> {l('seats', 'mandat')},{' '}
            {sum >= majority
              ? l('✓ a majority', '✓ majoritet')
              : l(
                  `✕ ${majority - sum} short of a majority`,
                  `✕ ${majority - sum} mandat från majoritet`,
                )}
          </>
        )}
      </p>
    </div>
  )
}
