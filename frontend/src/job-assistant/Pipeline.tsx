/**
 * The application pipeline, read-only: the owner's reviews grouped from Saved to the answer.
 * The owner moves an ad from its detail view with the token (Decision.tsx); this board only reads.
 */
import { l } from '../i18n'
import type { Ad, Records } from './model'
import { pipelineColumns } from './query'
import { day, statusLabel } from './labels'

type Props = {
  ads: Ad[]
  records: Records
  href: (id: string) => string
  onOpen: (id: string) => void
}

export default function Pipeline({ ads, records, href, onOpen }: Props) {
  if (!records.available)
    return (
      <p className="ja-empty">
        {l(
          'The application records could not be read right now.',
          'Ansökningarna kunde inte läsas just nu.',
        )}
      </p>
    )
  const columns = pipelineColumns(ads, records)
  return (
    <div className="ja-board">
      {columns.map((c) => (
        <section key={c.status} aria-labelledby={`ja-col-${c.status}`}>
          <h2 id={`ja-col-${c.status}`}>
            {statusLabel(c.status)}{' '}
            <span className="ja-count">{c.items.length}</span>
          </h2>
          {c.items.length === 0 ? (
            <p className="ja-muted">{l('None yet', 'Inga än')}</p>
          ) : (
            <ul>
              {c.items.map((i) => (
                <li key={i.id}>
                  {i.ad ? (
                    <a
                      href={href(i.id)}
                      onClick={(e) => {
                        if (
                          e.metaKey ||
                          e.ctrlKey ||
                          e.shiftKey ||
                          e.button !== 0
                        )
                          return
                        e.preventDefault()
                        onOpen(i.id)
                      }}
                    >
                      <span className="ja-card-title">{i.ad.headline}</span>
                      <span className="ja-card-employer">{i.ad.employer}</span>
                      {i.updated && (
                        <small>
                          {l('Updated', 'Ändrad')} {day(i.updated)}
                        </small>
                      )}
                    </a>
                  ) : (
                    <span className="ja-muted">
                      {l(
                        `Ad ${i.id}, no longer in the published file`,
                        `Annons ${i.id}, finns inte längre i den publicerade filen`,
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
