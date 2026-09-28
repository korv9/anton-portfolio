/** Controls shared by the politics themes: one party, a select, and number formats. */
import { l } from '../i18n'
import { PartyLogo, partyName } from '../parties/identity'

/** One party at a time, as a row of logo chips (radio buttons). */
export function PartyChoice({
  parties,
  value,
  onChange,
  label = l('Party', 'Parti'),
}: {
  parties: string[]
  value: string
  onChange: (party: string) => void
  label?: string
}) {
  return (
    <div className="party-picker" role="radiogroup" aria-label={label}>
      {parties.map((party) => (
        <button
          key={party}
          type="button"
          role="radio"
          aria-checked={value === party}
          className={value === party ? 'party-chip on' : 'party-chip'}
          title={partyName(party)}
          onClick={() => onChange(party)}
        >
          <PartyLogo party={party} size={18} />
          {party}
          <span className="visually-hidden"> ({partyName(party)})</span>
        </button>
      ))}
    </div>
  )
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="theme-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

const nf = (digits: number) =>
  new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
export const num = (value: number, digits = 0) => nf(digits).format(value)
export const pct = (value: number, digits = 1) => `${num(value, digits)} %`
export const signed = (value: number, digits = 0) =>
  `${value > 0 ? '+' : value < 0 ? '−' : '±'}${num(Math.abs(value), digits)}`
export const monthName = (iso: string) =>
  new Date(iso).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
export const dayName = (iso: string) =>
  new Date(iso.slice(0, 10)).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
