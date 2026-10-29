/**
 * The ad itself: the lead (first paragraph) and the rest in a native disclosure, "Read the whole
 * ad". The text is texts.json's, else texts-remaining.json's, which is fetched only when the
 * reader opens the ad or the disclosure (useAdText). Line breaks and bullets are kept as written.
 */
import { useState } from 'react'
import { l } from '../i18n'
import { splitLead } from './query'
import { useAdText } from './useJobData'

type Props = {
  id: string
  published?: string
  /** The ad was opened (not just shown first on a wide screen), so a missing text is fetched. */
  opened: boolean
  /** The original ad, an https link or none. */
  source?: string
}

export default function AdText({ id, published, opened, source }: Props) {
  const [asked, setAsked] = useState(false)
  const { text, loading, failed } = useAdText(id, published, opened || asked)
  const [lead, rest] = text ? splitLead(text) : ['', '']
  const fallback = source && (
    <a href={source} target="_blank" rel="noreferrer">
      {l('Read it on Platsbanken', 'Läs den på Platsbanken')}
    </a>
  )

  return (
    <section aria-labelledby="ja-ad">
      <h3 id="ja-ad">{l('The ad', 'Annonsen')}</h3>
      {lead && <p className="ja-lead">{lead}</p>}
      {loading && (
        <p className="ja-muted" role="status">
          {l('Loading the ad…', 'Laddar annonsen…')}
        </p>
      )}
      {failed && (
        <p className="ja-muted">
          {l(
            'The text of this ad could not be loaded. ',
            'Texten i den här annonsen gick inte att läsa. ',
          )}
          {fallback}
        </p>
      )}
      {(rest || (!text && !loading && !failed)) && (
        <details
          className="ja-whole"
          onToggle={(e) => e.currentTarget.open && setAsked(true)}
        >
          <summary className="btn-quiet">
            {l('Read the whole ad', 'Läs hela annonsen')}
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </summary>
          {rest && <p className="ja-rest">{rest}</p>}
        </details>
      )}
    </section>
  )
}
