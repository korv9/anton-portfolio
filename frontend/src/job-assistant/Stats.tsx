/**
 * The board's figures for the page head: current ads, employers, new today, strong matches (only with a
 * profile, else the duplicates folded), the owner's applications (only when the records were
 * read) and the last sync. StaleNotes says when the figures can't be trusted.
 */
import { currentLocale, l } from '../i18n'
import type { Kpi } from '../ui/PageHead'
import {
  keptNote,
  PIPELINE,
  type Delivered,
  type Records,
  type Status,
} from './model'
import { statusLabel } from './labels'
import { STALE_HOURS, syncAge } from './query'

type Props = { data: Delivered; records: Records; day: string }

export function statKpis({ data, records, day }: Props): Kpi[] {
  const open = data.ads.ads.filter((a) => !a.removed_at && !a.expired)
  const fresh = open.filter((a) => a.published?.slice(0, 10) === day).length
  const strong = data.matches.matches.filter((m) => m.class === 'strong').length
  const applied = new Map<Status, number>()
  for (const r of Object.values(records.reviews))
    applied.set(r.status, (applied.get(r.status) ?? 0) + 1)
  const pipeline = PIPELINE.filter((s) => applied.get(s))
  const synced = new Date(data.ads.generated_at)
  const time = Number.isNaN(synced.getTime())
    ? '–'
    : synced.toLocaleString(currentLocale() === 'sv' ? 'sv-SE' : 'en-GB', {
        timeZone: 'Europe/Stockholm',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
  return [
    {
      label: l('Current Data/IT ads', 'Aktuella Data/IT-annonser'),
      value: data.ads.counts.current.toLocaleString(),
    },
    {
      label: l('Employers', 'Arbetsgivare'),
      value: new Set(open.map((a) => a.employer)).size.toLocaleString(),
    },
    { label: l('New today', 'Nya i dag'), value: fresh.toLocaleString() },
    data.matches.profile
      ? {
          label: l('Strong matches', 'Starka matchningar'),
          value: strong.toLocaleString(),
        }
      : {
          label: l('Duplicates folded', 'Dubbletter sammanslagna'),
          value: data.ads.counts.duplicates.toLocaleString(),
        },
    ...(records.available
      ? [
          {
            label: l('Applications', 'Ansökningar'),
            value:
              pipeline.length === 0
                ? '0'
                : pipeline.map((s, i) => (
                    <span key={s}>
                      {i > 0 && ' · '}
                      {applied.get(s)}{' '}
                      <small>{statusLabel(s).toLocaleLowerCase()}</small>
                    </span>
                  )),
          },
        ]
      : []),
    {
      label: l('Last sync', 'Senaste synk'),
      value: <time dateTime={data.ads.generated_at}>{time}</time>,
    },
  ]
}

export function StaleNotes({ data, now }: { data: Delivered; now: Date }) {
  const hours = syncAge(data.ads.generated_at, now)
  return (
    <>
      {data.matches.profile && data.matches.status?.kept && (
        <p className="ja-stale" role="status">
          {l(...keptNote(data.matches.status.kept))}
        </p>
      )}
      {hours != null && hours > STALE_HOURS && (
        <p className="ja-stale" role="status">
          {l(
            `The ads were last synced ${Math.floor(hours)} hours ago, so the scheduled run may have stopped. New and removed ads since then are missing.`,
            `Annonserna synkades senast för ${Math.floor(hours)} timmar sedan, så den schemalagda körningen kan ha stannat. Nya och borttagna annonser sedan dess saknas.`,
          )}
        </p>
      )}
    </>
  )
}
