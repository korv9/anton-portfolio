import { useState } from 'react'
import { l } from '../i18n'
import { MAX_SERIES, SERIES_COLORS } from '../charts/MultiLineChart'
import { PARTY_NAMES, partyLabel } from './data'

/**
 * Up to five parties at a time, each keeping its colour slot for as long as it is picked:
 * colour follows the party, not its position in the list, so removing one never repaints
 * the others.
 */
export function usePartySlots(initial: string[]) {
  const [slots, setSlots] = useState<Record<string, number>>(() =>
    Object.fromEntries(initial.slice(0, MAX_SERIES).map((p, i) => [p, i])),
  )
  const picked = Object.keys(slots)
  const toggle = (party: string) =>
    setSlots((current) => {
      if (party in current) {
        const next = { ...current }
        delete next[party]
        return next
      }
      const used = new Set(Object.values(current))
      const free = [...Array(MAX_SERIES).keys()].find((i) => !used.has(i))
      return free === undefined ? current : { ...current, [party]: free }
    })
  return { picked, toggle, colorOf: (party: string) => slots[party] ?? 0 }
}

export default function PartyPicker({
  parties,
  picked,
  toggle,
  colorOf,
}: {
  parties: string[]
  picked: string[]
  toggle: (party: string) => void
  colorOf: (party: string) => number
}) {
  const full = picked.length >= MAX_SERIES
  return (
    <div
      className="party-picker"
      role="group"
      aria-label={l('Parties', 'Partier')}
    >
      {parties.map((party) => {
        const on = picked.includes(party)
        return (
          <button
            key={party}
            type="button"
            className={on ? 'party-chip on' : 'party-chip'}
            aria-pressed={on}
            disabled={!on && full}
            title={PARTY_NAMES[party] ?? party}
            onClick={() => toggle(party)}
          >
            {on && (
              <span
                className="legend-swatch"
                style={{ background: SERIES_COLORS[colorOf(party)] }}
              />
            )}
            {partyLabel(party)}
          </button>
        )
      })}
      <small>{l('Up to five at a time.', 'Högst fem åt gången.')}</small>
    </div>
  )
}
