/**
 * #jobs: a job board over current Data/IT ads from JobTech, each matched with the approved CV
 * profile (docs/job-assistant.md). Search, filters, sort, the open ad and the tab live in the
 * address, so a link shares the view and the back button closes an ad. Results on the left,
 * the open ad on the right; under 760 px the ad replaces the list with a back button.
 */
import { useMemo, useRef, useState, useEffect } from 'react'
import { l } from '../i18n'
import { setHashParams, type Route } from '../router'
import AdDetail from './AdDetail'
import AdList from './AdList'
import Filters from './Filters'
import Pipeline from './Pipeline'
import Sections from './Sections'
import Stats from './Stats'
import Unmatched from './Unmatched'
import { useListKeys } from './useListKeys'
import { useJobData } from './useJobData'
import { ownerToken, rows as joinRows, type Status } from './data'
import {
  DEFAULT_QUERY,
  facetCounts,
  isFiltered,
  parseQuery,
  queryParams,
  search as searchRows,
  today,
  type Query,
} from './query'
import './job-assistant.css'
import './job-assistant-board.css'
import './job-assistant-cards.css'
import './job-assistant-detail.css'
import './job-assistant-sections.css'

const PAGE = 20
const TABS = [
  { id: 'jobs', en: 'Jobs', sv: 'Jobb' },
  { id: 'applications', en: 'Applications', sv: 'Ansökningar' },
  { id: 'about', en: 'How it works', sv: 'Så fungerar det' },
] as const
const narrow = () => matchMedia('(max-width: 760px)').matches

export default function JobAssistantPage({ route }: { route: Route }) {
  const [owner, setOwner] = useState(() => Boolean(ownerToken()))
  const { data, records, setRecords, failed, retry, saved } = useJobData(owner)
  const [more, setMore] = useState({ key: '', n: PAGE })
  const search = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const statusKey = useRef<((status: Status) => void) | null>(null)
  // Set when this page opened the ad, so closing it can step back instead of adding history.
  const openedHere = useRef<{ id: string; y: number } | null>(null)
  const now = useMemo(() => new Date(), [data])
  const day = today(now)

  const all = useMemo(
    () => (data ? joinRows(data, records) : []),
    [data, records],
  )
  const query = useMemo(
    () => parseQuery(route.params, all),
    [route.params, all],
  )
  const tab = TABS.find((t) => t.id === route.params.get('tab'))?.id ?? 'jobs'
  const adId = route.params.get('ad')
  const shown = useMemo(() => searchRows(all, query, day), [all, query, day])
  const counts = useMemo(() => facetCounts(all, query, day), [all, query, day])
  const qKey = queryParams(new URLSearchParams(), query).toString()
  const limit = more.key === qKey ? more.n : PAGE
  const opened = adId ? all.find((r) => r.ad.id === adId) : undefined
  const selected = opened ?? (adId ? undefined : shown[0])

  const go = (params: URLSearchParams, push = false) =>
    setHashParams(route.path, params, push)
  const setQuery = (q: Query, push = false) =>
    go(queryParams(route.params, q), push)
  const withAd = (id: string) => {
    const p = new URLSearchParams(route.params)
    p.set('ad', id)
    p.delete('tab')
    return p
  }
  const href = (id: string) => `${route.path}?${withAd(id)}`
  const open = (id: string) => {
    openedHere.current = { id, y: window.scrollY }
    go(withAd(id), true)
  }
  const close = () => {
    if (openedHere.current?.id === adId) history.back()
    else {
      const p = new URLSearchParams(route.params)
      p.delete('ad')
      go(p)
    }
  }
  const setTab = (id: string) => {
    const p = new URLSearchParams(route.params)
    if (id === 'jobs') p.delete('tab')
    else p.set('tab', id)
    p.delete('ad')
    go(p, true)
  }

  // An opened ad on a phone: its back button is where the reader lands, below the site header.
  useEffect(() => {
    if (!adId || !narrow()) return
    document.querySelector('.ja-detail')?.scrollIntoView({ block: 'start' })
    document
      .querySelector<HTMLElement>('.ja-back')
      ?.focus({ preventScroll: true })
  }, [adId])

  // Back on the list (mobile), the reader returns to where they were and to the card they opened.
  useEffect(() => {
    const last = openedHere.current
    if (adId || !last) return
    if (narrow()) window.scrollTo({ top: last.y })
    listRef.current
      ?.querySelector<HTMLElement>(`a[href$="ad=${CSS.escape(last.id)}"]`)
      ?.focus({ preventScroll: true })
    openedHere.current = null
  }, [adId])

  useListKeys({
    search,
    list: listRef,
    clearSearch: () => {
      if (!query.q) return false
      setQuery({ ...query, q: '' })
      return true
    },
    close: adId ? close : undefined,
    statusKey,
  })

  const profile = data?.matches.profile
  return (
    <div className="ja ds-container">
      <header className="ja-head">
        <h1>Arbetsförmedla</h1>
        <p className="ja-lede">
          {l(
            'My CV matched on an hourly schedule with current Data/IT ads from JobTech. Each class says why, with the ad sentence and the CV line behind it. It supports my decision; it does not estimate a chance of being hired.',
            'Mitt cv matchat enligt ett timschema mot aktuella Data/IT-annonser från JobTech. Varje klass säger varför, med annonsens mening och cv-raden bakom. Det stöder mitt beslut; det uppskattar inte chansen att bli anställd.',
          )}
        </p>
        {data ? (
          <Stats data={data} records={records} day={day} now={now} />
        ) : (
          !failed && <div className="ja-stats ja-skel" aria-hidden="true" />
        )}
      </header>

      <nav className="ja-tabs" aria-label={l('Job board', 'Jobbtavlan')}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {l(t.en, t.sv)}
          </button>
        ))}
      </nav>

      {failed ? (
        <div className="ja-empty" role="alert">
          <p>
            {l(
              'The ads could not be loaded: ',
              'Annonserna kunde inte läsas: ',
            )}
            {failed}
          </p>
          <button type="button" className="btn-quiet" onClick={retry}>
            {l('Try again', 'Försök igen')}
          </button>
        </div>
      ) : !data ? (
        <Skeleton />
      ) : tab === 'applications' ? (
        <Pipeline
          ads={data.ads.ads}
          records={records}
          href={href}
          onOpen={open}
        />
      ) : tab === 'about' ? (
        <Sections
          data={data}
          records={records}
          owner={owner}
          onOwner={setOwner}
          onRecords={setRecords}
        />
      ) : !profile ? (
        <Unmatched
          ads={data.ads.ads}
          day={day}
          skipped={data.matches.status?.kept ?? data.matches.status?.skipped}
        />
      ) : (
        <>
          <Filters
            query={query}
            onQuery={setQuery}
            counts={counts}
            search={search}
          />
          <div className="ja-work" data-open={adId ? 'true' : 'false'}>
            <AdList
              rows={shown.slice(0, limit)}
              total={shown.length}
              query={query}
              onQuery={setQuery}
              selectedId={selected?.ad.id}
              href={href}
              onOpen={open}
              onMore={() => setMore({ key: qKey, n: limit + PAGE })}
              onClear={() =>
                setQuery({ ...DEFAULT_QUERY, sort: query.sort }, true)
              }
              filtered={isFiltered(query)}
              profile={Boolean(profile)}
              day={day}
              listRef={listRef}
            />
            {selected ? (
              <AdDetail
                key={selected.ad.id}
                row={selected}
                text={data.texts.texts[selected.ad.id]?.description}
                owner={owner}
                storage={records.available}
                onSaved={saved}
                statusKey={statusKey}
                today={day}
                onBack={close}
              />
            ) : (
              adId && (
                <Gone
                  id={adId}
                  ad={data.ads.ads.find((a) => a.id === adId)}
                  onBack={close}
                />
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** An opened ad that is no longer matched: removed, expired, or older than the file. */
function Gone({
  id,
  ad,
  onBack,
}: {
  id: string
  ad?: { headline: string; employer: string; source_url: string }
  onBack: () => void
}) {
  return (
    <article className="ja-detail" aria-labelledby="ja-detail-title">
      <button type="button" className="btn-text ja-back" onClick={onBack}>
        {l('Back to the jobs', 'Tillbaka till jobben')}
      </button>
      <h2 id="ja-detail-title">
        {ad?.headline ?? l(`Ad ${id}`, `Annons ${id}`)}
      </h2>
      <p className="ja-muted">
        {l(
          'This ad is closed or removed, so it is no longer matched.',
          'Annonsen är stängd eller borttagen, så den matchas inte längre.',
        )}
      </p>
      {ad && (
        <p className="ja-links">
          <a href={ad.source_url} target="_blank" rel="noreferrer">
            {l('Original ad', 'Originalannonsen')}
          </a>
        </p>
      )}
    </article>
  )
}

function Skeleton() {
  return (
    <div className="ja-work" data-open="false" role="status">
      <span className="visually-hidden">
        {l('Loading the ads…', 'Laddar annonserna…')}
      </span>
      <ol className="ja-cards" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="ja-card ja-skel" />
        ))}
      </ol>
    </div>
  )
}
