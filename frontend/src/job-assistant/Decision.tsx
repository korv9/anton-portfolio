/** The owner's decision on one ad: status, note and relevance label, each saved on an explicit action. */
import { useEffect, useState, type MutableRefObject } from 'react'
import { l } from '../i18n'
import {
  LABELS,
  PIPELINE,
  STATUSES,
  write,
  type Label,
  type Row,
  type Status,
} from './data'
import { statusLabel } from './labels'

/** The number key for a pipeline status (1 saved to 5 rejected); the others have none. */
const key = (s: Status) => {
  const i = (PIPELINE as readonly Status[]).indexOf(s)
  return i < 0 ? undefined : String(i + 1)
}

const LABEL_NAMES: Record<Label, [string, string]> = {
  relevant: ['Relevant', 'Relevant'],
  maybe: ['Maybe', 'Kanske'],
  not_relevant: ['Not relevant', 'Inte relevant'],
}

export type Saved = (
  id: string,
  kind: 'review' | 'label',
  value: Record<string, unknown>,
) => void

type Props = {
  row: Row
  onSaved: Saved
  /** Set while this block is shown, so the page's number keys call the status setter directly. */
  statusKey: MutableRefObject<((status: Status) => void) | null>
}

export default function Decision({ row, onSaved, statusKey }: Props) {
  const { ad, match } = row
  const stored = row.review?.note ?? ''
  const [note, setNote] = useState(stored)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')

  async function save(
    kind: 'review' | 'label',
    value: Record<string, unknown>,
  ) {
    setError('')
    setDone('')
    setBusy(true)
    try {
      await write(`${kind}s/${ad.id}`, 'PUT', JSON.stringify(value))
      onSaved(ad.id, kind, value)
      setDone(l('Saved.', 'Sparat.'))
    } catch (e) {
      setError(
        l(
          `Not saved: ${(e as Error).message}`,
          `Inte sparat: ${(e as Error).message}`,
        ),
      )
    } finally {
      setBusy(false)
    }
  }
  // The clicked status, never the shown one: a removed ad shows as closed without being stored so.
  const setStatus = (status: Status) => save('review', { status, note })

  useEffect(() => {
    statusKey.current = busy ? null : setStatus
    return () => {
      statusKey.current = null
    }
  })

  return (
    <section
      className="ja-decide"
      aria-label={l('Decision', 'Beslut')}
      aria-busy={busy}
    >
      <div
        className="ja-segment"
        role="group"
        aria-label={l('Status', 'Status')}
      >
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={row.status === s}
            disabled={busy}
            onClick={() => setStatus(s)}
            aria-keyshortcuts={key(s)}
          >
            {statusLabel(s)}
          </button>
        ))}
      </div>
      <label className="ja-note">
        <span>{l('Note', 'Anteckning')}</span>
        <textarea
          rows={2}
          maxLength={4000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="btn-quiet ja-save-note"
        disabled={busy || note === stored}
        onClick={() =>
          save('review', { status: row.review?.status ?? 'new', note })
        }
      >
        {l('Save note', 'Spara anteckningen')}
      </button>
      <div
        className="ja-segment"
        role="group"
        aria-label={l('Relevance label', 'Relevansmärkning')}
      >
        {LABELS.map((x) => (
          <button
            key={x}
            type="button"
            aria-pressed={row.label?.label === x}
            disabled={busy}
            onClick={() =>
              save('label', {
                label: x,
                note: row.label?.note ?? '',
                shown_class: match.class,
              })
            }
          >
            {l(...LABEL_NAMES[x])}
          </button>
        ))}
      </div>
      {error && (
        <p className="ja-error" role="alert">
          {error}
        </p>
      )}
      <p className="ja-muted" role="status">
        {note !== stored && !busy
          ? l(
              'Note not saved. It is lost if you move to another ad.',
              'Anteckningen är inte sparad. Den försvinner om du byter annons.',
            )
          : done}
      </p>
    </section>
  )
}
