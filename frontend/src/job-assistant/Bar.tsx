/**
 * The desk's top bar: the page title, the search and when the ads were updated, with the notes
 * that say when the figures can't be trusted: stale (over eight hours), a file that did not
 * load, kept matches, or no matching at all.
 */
import { l } from '../i18n'
import { keptNote, unmatchedNote, type Delivered } from './model'
import { clock } from './labels'
import { STALE_HOURS, syncAge } from './query'

const MISSING: Record<Delivered['missing'][number], [string, string]> = {
  matches: ['the matches', 'matchningarna'],
  texts: ['the ad texts', 'annonstexterna'],
  demand: ['the skill demand', 'kompetensefterfrågan'],
}

type Props = {
  data: Delivered | null
  q: string
  onSearch: (q: string) => void
  day: string
}

export default function Bar({ data, q, onSearch, day }: Props) {
  return (
    <header className="ja-bar">
      <h1 className="ja-title">Arbetsförmedla</h1>
      <div role="search" className="ja-search-wrap">
        <label className="ja-search">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <circle
              cx="11"
              cy="11"
              r="7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="visually-hidden">
            {l('Search jobs', 'Sök jobb')}
          </span>
          <input
            type="search"
            value={q}
            placeholder={l(
              'Search title, employer or skill',
              'Sök titel, arbetsgivare eller kompetens',
            )}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
      </div>
      {data && (
        <p className="ja-label ja-updated">
          {l('Updated', 'Uppdaterad')}{' '}
          <time dateTime={data.ads.generated_at}>
            {clock(data.ads.generated_at, day)}
          </time>
        </p>
      )}
    </header>
  )
}

/** The notes under the bar; none when the data is current and complete. */
export function Notes({ data, now }: { data: Delivered; now: Date }) {
  const hours = syncAge(data.ads.generated_at, now)
  const missing = data.missing.map((m) => l(...MISSING[m]))
  const kept = data.matches.profile && data.matches.status?.kept
  const notes = [
    hours != null &&
      hours > STALE_HOURS &&
      l(
        `The ads were last synced ${Math.floor(hours)} hours ago, so the scheduled run may have stopped. New and removed ads since then are missing.`,
        `Annonserna synkades senast för ${Math.floor(hours)} timmar sedan, så den schemalagda körningen kan ha stannat. Nya och borttagna annonser sedan dess saknas.`,
      ),
    missing.length > 0 &&
      l(
        `Could not load ${missing.join(' and ')} just now. The ad list still works; reload later to try again.`,
        `Kunde inte läsa ${missing.join(' och ')} just nu. Annonslistan fungerar ändå; ladda om senare för att försöka igen.`,
      ),
    kept && l(...keptNote(kept)),
    !data.matches.profile &&
      !data.missing.includes('matches') &&
      l(
        ...unmatchedNote(
          data.matches.status?.kept ?? data.matches.status?.skipped,
        ),
      ),
  ].filter(Boolean)
  if (notes.length === 0) return null
  return (
    <div className="ja-notes" role="status">
      {notes.map((n) => (
        <p key={n as string}>{n}</p>
      ))}
    </div>
  )
}
