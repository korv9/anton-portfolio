/** Controls shared by the politics themes: a select and number formats. */
import { l } from '../i18n'

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
  new Intl.NumberFormat(l('en-GB', 'sv-SE'), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
export const num = (value: number, digits = 0) => nf(digits).format(value)
export const pct = (value: number, digits = 1) => `${num(value, digits)} %`
export const signed = (value: number, digits = 0) =>
  `${value > 0 ? '+' : value < 0 ? '−' : '±'}${num(Math.abs(value), digits)}`
export const monthName = (iso: string) =>
  new Date(iso).toLocaleDateString(l('en-GB', 'sv-SE'), {
    month: 'long',
    year: 'numeric',
  })
export const dayName = (iso: string) =>
  new Date(iso.slice(0, 10)).toLocaleDateString(l('en-GB', 'sv-SE'), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
