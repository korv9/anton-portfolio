/** The parties as logos under a chart they filter: chosen ones in full, the rest faded. */
import { l } from '../i18n'
import { PartyLogo, RIKSDAG_PARTIES, partyName } from '../parties/identity'
import type { Route } from '../router'
import { useParties } from './partySelection'

export default function PartyPicker({
  route,
  small,
}: {
  route: Route
  /** A quiet row at a chapter's head instead of the row across the screen. */
  small?: boolean
}) {
  const { selected, toggle } = useParties(route)
  return (
    <div
      className={small ? 'party-picker small' : 'party-picker'}
      role="group"
      aria-label={l('Parties', 'Partier')}
      data-chosen={selected.length > 0}
    >
      {RIKSDAG_PARTIES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={selected.includes(code)}
          aria-label={partyName(code)}
          title={partyName(code)}
          onClick={() => toggle(code)}
        >
          <PartyLogo party={code} size={small ? 24 : 88} />
        </button>
      ))}
    </div>
  )
}
