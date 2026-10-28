/**
 * The owner's tools: the token for writes, CV upload and the profile draft. The Worker checks
 * every write; the hourly run parses an upload into a draft and checks an approval request
 * against the CV text before it adds a version.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import Wishes, { type WishSet } from './Wishes'
import {
  loadRecords,
  ownerToken,
  recordsNote,
  setOwnerToken,
  write,
  type Records,
} from './data'

/** The draft text as a profile, or null while it is not valid JSON. */
function parsed(text: string): Record<string, unknown> | null {
  try {
    const p = JSON.parse(text)
    return p && typeof p === 'object' && !Array.isArray(p) ? p : null
  } catch {
    return null
  }
}

type Draft = {
  profile: Record<string, unknown>
  approval_requested: boolean
  problems: string[]
  updated_at: string
}
type Props = {
  owner: boolean
  available: boolean
  problem?: Records['problem']
  onOwner: (o: boolean) => void
  onRecords: (r: Records) => void
}

export default function Owner({
  owner,
  available,
  problem,
  onOwner,
  onRecords,
}: Props) {
  const [token, setToken] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  // The HTTP status of the profile route when it could not be read (0: unreachable).
  const [unread, setUnread] = useState<number | null>(null)

  async function refresh() {
    // The draft is owner-only: without the token the route leaves it out.
    const r = await fetch('/api/jobs/profile', {
      headers: { Authorization: `Bearer ${ownerToken()}` },
    }).catch(() => null)
    setUnread(r?.ok ? null : (r?.status ?? 0))
    const state = r?.ok ? await r.json() : null
    setDraft(state?.draft ?? null)
    setText(state?.draft ? JSON.stringify(state.draft.profile, null, 1) : '')
  }
  useEffect(() => {
    if (owner) refresh()
  }, [owner])

  async function run(action: () => Promise<unknown>, done: string) {
    setMessage('')
    try {
      await action()
      setMessage(done)
      await refresh()
      onRecords(await loadRecords())
    } catch (e) {
      setMessage(
        l(
          `Not saved: ${(e as Error).message}`,
          `Inte sparat: ${(e as Error).message}`,
        ),
      )
    }
  }
  function saveDraft(approval: boolean) {
    let profile: unknown
    try {
      profile = JSON.parse(text)
    } catch {
      setMessage(
        l('The draft is not valid JSON.', 'Utkastet är inte giltig JSON.'),
      )
      return
    }
    run(
      () =>
        write(
          'profile/draft',
          'PUT',
          JSON.stringify({ profile, approval_requested: approval }),
        ),
      approval
        ? l(
            'Saved. The next run checks it against the CV and approves it or lists what to fix.',
            'Sparat. Nästa körning kontrollerar det mot cv:t och godkänner det eller listar vad som ska rättas.',
          )
        : l('Draft saved.', 'Utkastet sparat.'),
    )
  }
  function upload(file: File | undefined) {
    if (!file) return
    run(
      () =>
        file.arrayBuffer().then((b) =>
          fetch('/api/jobs/cv', {
            method: 'POST',
            body: b,
            headers: {
              'Content-Type': file.type,
              'X-Filename': file.name,
              Authorization: `Bearer ${ownerToken()}`,
            },
          }).then(async (r) => {
            if (!r.ok) throw new Error((await r.json()).error)
          }),
        ),
      l(
        'Uploaded. The next run reads it into a new draft.',
        'Uppladdat. Nästa körning läser in det till ett nytt utkast.',
      ),
    )
  }

  const profile = parsed(text)
  const w = profile?.wishes as WishSet | undefined
  // Only a draft whose wishes have the v1 shape gets the fields; the JSON stays editable.
  const wishes =
    w && Array.isArray(w.roles) && Array.isArray(w.locations) ? w : undefined

  return (
    <details className="ja-owner">
      <summary>{l('Owner tools', 'Ägarens verktyg')}</summary>
      {owner && !available && problem && (
        <p className="ja-muted" role="status">
          {l(...recordsNote(problem))}
        </p>
      )}
      {!owner ? (
        <form
          className="ja-owner-row"
          onSubmit={(e) => {
            e.preventDefault()
            setOwnerToken(token.trim())
            onOwner(Boolean(token.trim()))
          }}
        >
          <label>
            <span>{l('Owner token', 'Ägartoken')}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <button className="btn-quiet" type="submit">
            {l('Keep on this device', 'Spara på den här enheten')}
          </button>
        </form>
      ) : (
        <>
          <p className="ja-owner-row">
            {l(
              'The token is kept on this device until you forget it. The Worker checks it on every write.',
              'Token sparas på den här enheten tills du glömmer den. Workern kontrollerar den vid varje skrivning.',
            )}
            <button
              className="btn-text"
              type="button"
              onClick={() => {
                setOwnerToken('')
                onOwner(false)
              }}
            >
              {l('Forget the token', 'Glöm token')}
            </button>
          </p>
          <label className="ja-owner-row">
            <span>
              {l(
                'Upload a new CV (PDF or DOCX, up to 1.4 MB)',
                'Ladda upp ett nytt cv (PDF eller DOCX, högst 1,4 MB)',
              )}
            </span>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
          {draft ? (
            <div className="ja-draft">
              <p>
                {l('Profile draft', 'Profilutkast')},{' '}
                {draft.updated_at.slice(0, 16).replace('T', ' ')} UTC
                {draft.approval_requested &&
                  ` · ${l('waiting for the approval check', 'väntar på godkännandekontrollen')}`}
              </p>
              {draft.problems.length > 0 && (
                <ul className="ja-error">
                  {draft.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {wishes && (
                <Wishes
                  wishes={wishes}
                  onChange={(w) =>
                    setText(JSON.stringify({ ...profile, wishes: w }, null, 1))
                  }
                />
              )}
              <textarea
                aria-label={l('Profile draft (JSON)', 'Profilutkast (JSON)')}
                rows={16}
                spellCheck={false}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <p className="ja-owner-row">
                <button
                  className="btn-quiet"
                  type="button"
                  onClick={() => saveDraft(false)}
                >
                  {l('Save draft', 'Spara utkast')}
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => saveDraft(true)}
                >
                  {l(
                    'Save and ask for approval',
                    'Spara och begär godkännande',
                  )}
                </button>
              </p>
            </div>
          ) : unread != null ? (
            <p className="ja-muted" role="status">
              {l(
                ...(unread === 503 || unread === 401
                  ? recordsNote(unread === 503 ? 'storage' : 'token')
                  : recordsNote('offline')),
              )}
            </p>
          ) : (
            <p className="ja-muted">
              {l(
                'No draft yet. Upload the CV; the next run makes one.',
                'Inget utkast än. Ladda upp cv:t; nästa körning skapar ett.',
              )}
            </p>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  )
}
