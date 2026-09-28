/**
 * "Bygg egen vy": a panel from the right with the choices a theme's data supports. The
 * choices themselves are ordinary controls handed in by the theme, which only offers valid
 * combinations; everything chosen is already in the address, so the view can be shared.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { l } from '../i18n'

export default function BuilderPanel({
  open,
  onClose,
  onReset,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  onReset: () => void
  title: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {})
  }

  return (
    <dialog
      ref={dialog}
      className="builder"
      aria-labelledby="builder-title"
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop (the dialog element itself) closes the panel.
        if (event.target === dialog.current) onClose()
      }}
    >
      <div className="builder-inner">
        <header className="builder-head">
          <h2 id="builder-title">{title}</h2>
          <button type="button" className="builder-close" onClick={onClose}>
            {l('Close', 'Stäng')}
          </button>
        </header>
        <p className="ds-small">
          {l(
            'Only combinations the data can answer correctly are offered. Your choices are saved in the address, so the view can be shared.',
            'Här finns bara kombinationer som datan kan svara korrekt på. Valen sparas i adressen, så att vyn kan delas.',
          )}
        </p>
        <div className="builder-fields">{children}</div>
        <footer className="builder-foot">
          <button type="button" className="ds-button" onClick={onClose}>
            {l('Show the view', 'Visa vyn')}
          </button>
          <button
            type="button"
            className="ds-button secondary"
            onClick={copyLink}
          >
            {l('Copy link', 'Kopiera länk')}
          </button>
          <button
            type="button"
            className="ds-link builder-reset"
            onClick={onReset}
          >
            {l('Reset', 'Återställ')}
          </button>
        </footer>
      </div>
    </dialog>
  )
}

/** A labelled group in the builder. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <fieldset className="builder-field">
      <legend>{label}</legend>
      {hint && <p className="ds-small">{hint}</p>}
      {children}
    </fieldset>
  )
}

/** Mutually exclusive options as radio buttons. */
export function Choice<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="builder-choice">
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}
