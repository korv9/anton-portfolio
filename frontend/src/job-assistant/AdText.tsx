/**
 * The ad itself, the whole text as soon as it is there: the lead (first paragraph) and the rest.
 * The text is texts.json's, else texts-remaining.json's, which is fetched only when the reader
 * opens the ad, or asks for it with "Read the whole ad" on the ad shown first (useAdText).
 * Line breaks and bullets are kept as written.
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
      {rest && <p className="ja-rest">{rest}</p>}
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
      {!text && !loading && !failed && (
        <button
          type="button"
          className="btn-quiet"
          onClick={() => setAsked(true)}
        >
          {l('Read the whole ad', 'Läs hela annonsen')}
        </button>
      )}
    </section>
  )
}
