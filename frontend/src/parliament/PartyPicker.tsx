import { useState } from 'react'
import { l } from '../i18n'
import { PartyLogo, partyLine, partyName } from '../parties/identity'
import { partyLabel } from './data'

/**
 * The parties picked for a chart. Each is drawn in its own colour, so any number can be shown
 * and removing one never repaints the others.
 */
export function usePartySlots(initial: string[]) {
  const [picked, setPicked] = useState<string[]>(initial)
  const toggle = (party: string) =>
    setPicked((current) =>
      current.includes(party)
        ? current.filter((p) => p !== party)
        : [...current, party],
    )
  return { picked, toggle, colorOf: partyLine }
}

export default function PartyPicker({
  parties,
  picked,
  toggle,
}: {
  parties: string[]
  picked: string[]
  toggle: (party: string) => void
  colorOf?: (party: string) => string
}) {
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
            title={partyName(party)}
            onClick={() => toggle(party)}
          >
            <PartyLogo party={party} size={18} />
            {partyLabel(party)}
          </button>
        )
      })}
    </div>
  )
}
