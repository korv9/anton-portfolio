/**
 * A compact, screenshot-sized summary of where the AI Act stands this month: what applies, the
 * next milestone, what is new and where the official text is. "Copy as text" puts the same
 * content on the clipboard for a post.
 */
import { useState } from 'react'
import { l } from '../i18n'
import { changesInMonth, nowAndNext } from './logic'
import { fmtDate, monthName, pick, shortTitle, Source } from './shared'
import type { AiActData } from './types'

export function Snapshot({ data, today }: { data: AiActData; today: string }) {
  const [copied, setCopied] = useState(false)
  const month = today.slice(0, 7)
  const { past, next } = nowAndNext(data.timeline, today)
  const applying = past.filter((m) => m.kind === 'application').slice(0, 3)
  const fresh = changesInMonth(data.changes, month).filter(
    (c) => c.change_kind !== 'provision',
  )
  const latest = data.changes.find((c) => c.change_kind !== 'provision')
  const lines = [
    `AI ACT: ${monthName(month).toUpperCase()}`,
    '',
    l('Applies now', 'Gäller nu'),
    ...applying.map(
      (m) =>
        `• ${pick({ en: m.title_en, sv: m.title_sv })} (${fmtDate(m.date)})`,
    ),
    '',
    l('Next milestone', 'Nästa milstolpe'),
    next
      ? `• ${fmtDate(next.date)}: ${pick({ en: next.title_en, sv: next.title_sv })}`
      : '• –',
    '',
    l('New this month', 'Nytt den här månaden'),
    ...(fresh.length
      ? fresh.map(
          (c) =>
            `• ${shortTitle(c.change_kind, c.document_id, c.document_title)}`,
        )
      : [
          `• ${l('Nothing new in the official sources yet. Latest:', 'Inget nytt i de officiella källorna ännu. Senast:')} ${latest ? `${shortTitle(latest.change_kind, latest.document_id, latest.document_title)} (${fmtDate(latest.change_date)})` : '–'}`,
        ]),
    '',
    `${l('Official text', 'Officiell text')}: ${data.summary.current_version.source_url}`,
    l(
      'Navigation aid, not legal advice.',
      'Navigeringsstöd, inte juridisk rådgivning.',
    ),
  ]

  return (
    <article className="aa-snapshot" aria-labelledby="aa-snapshot-title">
      <header>
        <p className="aa-kicker">{l('Snapshot', 'Läget')}</p>
        <h2 id="aa-snapshot-title">AI Act: {monthName(month)}</h2>
      </header>
      <div className="aa-snapshot-grid">
        <section>
          <h3>{l('Applies now', 'Gäller nu')}</h3>
          <ul>
            {applying.map((m) => (
              <li key={m.milestone_id}>
                {pick({ en: m.title_en, sv: m.title_sv })}
                <small>{fmtDate(m.date)}</small>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>{l('Next milestone', 'Nästa milstolpe')}</h3>
          {next && (
            <p>
              <strong>{fmtDate(next.date)}</strong>
              {pick({ en: next.title_en, sv: next.title_sv })}
            </p>
          )}
        </section>
        <section>
          <h3>{l('New this month', 'Nytt den här månaden')}</h3>
          {fresh.length ? (
            <ul>
              {fresh.map((c) => (
                <li key={c.change_id}>
                  {shortTitle(c.change_kind, c.document_id, c.document_title)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="aa-muted">
              {l(
                'Nothing new in the official sources yet this month. Latest: ',
                'Inget nytt i de officiella källorna ännu den här månaden. Senast: ',
              )}
              {latest
                ? `${shortTitle(latest.change_kind, latest.document_id, latest.document_title)} (${fmtDate(latest.change_date)})`
                : '–'}
            </p>
          )}
        </section>
      </div>
      <footer>
        <Source href={data.summary.current_version.source_url}>
          {l('Consolidated text on EUR-Lex', 'Konsoliderad text på EUR-Lex')}
        </Source>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard
              ?.writeText(lines.join('\n'))
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }}
        >
          {copied
            ? l('Copied', 'Kopierat')
            : l('Copy as text', 'Kopiera som text')}
        </button>
      </footer>
    </article>
  )
}
