import { currentLocale, l } from '../i18n'

export type BudgetBar = {
  area: number
  label: string
  value: number
  reference: number | null
}
const amount = (value: number) =>
  (value / 1000).toLocaleString(currentLocale() === 'sv' ? 'sv-SE' : 'en-GB', {
    maximumFractionDigits: 2,
  })

export default function BudgetBars({
  rows,
  mode,
  selected,
  onSelect,
  label,
  valueLabel,
  referenceLabel,
}: {
  rows: BudgetBar[]
  mode: 'difference' | 'amount'
  selected: number
  onSelect: (area: number) => void
  label: string
  valueLabel: string
  referenceLabel: string
}) {
  const max = Math.max(
    1,
    ...rows.map((row) =>
      mode === 'difference'
        ? Math.abs(row.value - (row.reference ?? row.value))
        : Math.max(row.value, row.reference ?? 0),
    ),
  )
  const unit = l('SEK bn', 'mdkr')
  return (
    <div className="comparison-bars" role="group" aria-label={label}>
      <div className="comparison-scale">
        <span>{mode === 'difference' ? `−${amount(max)}` : '0'}</span>
        <span>
          {mode === 'difference' ? '0' : `${valueLabel} / ${referenceLabel}`}
        </span>
        <span>
          {amount(max)} {unit}
        </span>
      </div>
      {rows.length === 0 && (
        <p>
          {l(
            'No comparable figures for this selection.',
            'Inga jämförbara belopp för detta urval.',
          )}
        </p>
      )}
      {rows.map((row) => {
        const delta = row.reference == null ? null : row.value - row.reference
        return (
          <button
            type="button"
            key={row.area}
            className="comparison-bar-row"
            aria-pressed={selected === row.area}
            onClick={() => onSelect(row.area)}
          >
            <span className="comparison-bar-label">
              <span>{row.label}</span>
              <strong>
                {mode === 'difference'
                  ? delta == null
                    ? '—'
                    : `${delta > 0 ? '+' : ''}${amount(delta)}`
                  : amount(row.value)}{' '}
                {unit}
              </strong>
            </span>
            <span className={`comparison-track ${mode}`} aria-hidden="true">
              {mode === 'difference' ? (
                delta != null && (
                  <i
                    className={delta < 0 ? 'negative' : ''}
                    style={{
                      left: `${delta < 0 ? 50 - (Math.abs(delta) / max) * 50 : 50}%`,
                      width: `${(Math.abs(delta) / max) * 50}%`,
                    }}
                  />
                )
              ) : (
                <>
                  {row.reference != null && (
                    <i
                      className="reference"
                      style={{ width: `${(row.reference / max) * 100}%` }}
                    />
                  )}
                  <i style={{ width: `${(row.value / max) * 100}%` }} />
                </>
              )}
            </span>
            <span className="comparison-values">
              {valueLabel}: {amount(row.value)} · {referenceLabel}:{' '}
              {row.reference == null ? '—' : amount(row.reference)} {unit}
            </span>
          </button>
        )
      })}
    </div>
  )
}
