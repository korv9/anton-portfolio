/** The board's status line: ads in the store, new today, strong matches, applications and the last sync. */
import { currentLocale, l } from '../i18n'
import { PIPELINE, type Delivered, type Records, type Status } from './model'
import { statusLabel } from './labels'
import { STALE_HOURS, syncAge } from './query'

type Props = { data: Delivered; records: Records; day: string; now: Date }

export default function Stats({ data, records, day, now }: Props) {
  const open = data.ads.ads.filter((a) => !a.removed_at && !a.expired)
  const fresh = open.filter((a) => a.published?.slice(0, 10) === day).length
  const strong = data.matches.matches.filter((m) => m.class === 'strong').length
  const applied = new Map<Status, number>()
  for (const r of Object.values(records.reviews))
    applied.set(r.status, (applied.get(r.status) ?? 0) + 1)
  const pipeline = PIPELINE.filter((s) => applied.get(s))
  const hours = syncAge(data.ads.generated_at, now)
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
  return (
    <>
      <dl className="ja-stats">
        <div>
          <dt>{l('Ads in the store', 'Annonser i lagret')}</dt>
          <dd>{data.ads.counts.current.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{l('New today', 'Nya i dag')}</dt>
          <dd>{fresh.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{l('Strong matches', 'Starka matchningar')}</dt>
          <dd>{strong.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{l('Applications', 'Ansökningar')}</dt>
          <dd>
            {pipeline.length === 0
              ? records.available
                ? '0'
                : '–'
              : pipeline.map((s, i) => (
                  <span key={s}>
                    {i > 0 && ' · '}
                    {applied.get(s)}{' '}
                    <small>{statusLabel(s).toLocaleLowerCase()}</small>
                  </span>
                ))}
          </dd>
        </div>
        <div>
          <dt>{l('Last sync', 'Senaste synk')}</dt>
          <dd>
            <time dateTime={data.ads.generated_at}>{time}</time>
          </dd>
        </div>
      </dl>
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
