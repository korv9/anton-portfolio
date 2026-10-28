/**
 * #jobs, the desk: every open Data/IT ad from JobTech with its fit against the approved CV
 * profile (docs/job-assistant.md). A top bar (title, search, last update), list tabs with counts
 * and compact filters, the list on the left and the open ad on the right; under 760 px the ad
 * replaces the list with a back button. The search, filters, list, tab and open ad live in the
 * address, so a link shares the view and the back button closes an ad. Marks (saved, applied,
 * closed) are kept on this device, and in the owner store with the owner token.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { l } from '../i18n'
import { setHashParams, type Route } from '../router'
import AdDetail from './AdDetail'
import Bar, { Notes } from './Bar'
import Filters from './Filters'
import JobList from './JobList'
import Sections from './Sections'
import { useJobData } from './useJobData'
import { https, ownerToken, recordsNote, rows as joinRows } from './data'
import {
  facetCounts,
  listCounts,
  parseQuery,
  queryParams,
  search as searchRows,
  today,
  type List,
  type Query,
} from './query'
import './job-assistant.css'
import './job-assistant-desk.css'
import './job-assistant-motion.css'
import './job-assistant-sections.css'

const PAGE = 50
const narrow = () => matchMedia('(max-width: 760px)').matches
const EMPTY: Record<List, [string, string]> = {
  good: [
    'No good fit matches this view.',
    'Inget som passar bra i den här vyn.',
  ],
  saved: ['Nothing saved yet.', 'Inget sparat än.'],
  applied: ['Nothing marked as applied yet.', 'Inget markerat som sökt än.'],
  closed: ['Nothing closed yet.', 'Inget stängt än.'],
  all: ['No ad matches this view.', 'Ingen annons passar den här vyn.'],
}

export default function JobAssistantPage({ route }: { route: Route }) {
  const [owner, setOwner] = useState(() => Boolean(ownerToken()))
  const { data, records, setRecords, mine, mark, unsynced, failed, retry } =
    useJobData(owner)
  const [more, setMore] = useState({ key: '', n: PAGE })
  // Motion runs only after the reader acts, never on first paint (job-assistant-motion.css).
  const [moved, setMoved] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)
  // Set when this page opened the ad, so closing it can step back instead of adding history.
  const openedHere = useRef<{ id: string; y: number } | null>(null)
  const now = useMemo(() => new Date(), [data])
  const day = today(now)

  const all = useMemo(() => (data ? joinRows(data, mine) : []), [data, mine])
  const defaultList: List = data?.matches.profile ? 'good' : 'all'
  const query = useMemo(
    () => parseQuery(route.params, all, defaultList),
    [route.params, all, defaultList],
  )
  const about = route.params.get('tab') === 'about'
  const adId = route.params.get('ad')
  const shown = useMemo(() => searchRows(all, query), [all, query])
  const lists = useMemo(() => listCounts(all, query), [all, query])
  const counts = useMemo(() => facetCounts(all, query), [all, query])
  const qKey = queryParams(new URLSearchParams(), query).toString()
  const limit = more.key === qKey ? more.n : PAGE
  const opened = adId ? all.find((r) => r.ad.id === adId) : undefined
  const selected = opened ?? (adId ? undefined : shown[0])

  const go = (params: URLSearchParams, push = false) =>
    setHashParams(route.path, params, push)
  const setQuery = (q: Query, push = false) => {
    setMoved(true)
    const p = queryParams(route.params, q, defaultList)
    p.delete('tab')
    if (q.list !== query.list) p.delete('ad')
    go(p, push)
  }
  const withAd = (id: string) => {
    const p = new URLSearchParams(route.params)
    p.set('ad', id)
    p.delete('tab')
    return p
  }
  const href = (id: string) => `${route.path}?${withAd(id)}`
  const open = (id: string) => {
    setMoved(true)
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
  const showAbout = () => {
    const p = new URLSearchParams(route.params)
    p.set('tab', 'about')
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

  // Back on the list (mobile), the reader returns to where they were and to the ad they opened.
  useEffect(() => {
    const last = openedHere.current
    if (adId || !last) return
    if (narrow()) window.scrollTo({ top: last.y })
    listRef.current
      ?.querySelector<HTMLElement>(`a[href$="ad=${CSS.escape(last.id)}"]`)
      ?.focus({ preventScroll: true })
    openedHere.current = null
  }, [adId])

  const kept = records.available
    ? unsynced
      ? l(
          'Saved on this device; the owner store did not answer.',
          'Sparat på den här enheten; ägarlagringen svarade inte.',
        )
      : l(
          'Saved on this device and in the owner store',
          'Sparat på den här enheten och i ägarlagringen',
        )
    : l('Saved on this device', 'Sparat på den här enheten')

  return (
    <div className="ja ds-container" data-moved={moved || undefined}>
      <Bar
        data={data}
        q={query.q}
        onSearch={(q) => setQuery({ ...query, q })}
        day={day}
      />
      {data && <Notes data={data} now={now} />}
      {owner && records.problem && (
        <p className="ja-notes" role="status">
          {l(...recordsNote(records.problem))}
        </p>
      )}

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
        <p className="ja-empty" role="status">
          {l('Loading the ads…', 'Laddar annonserna…')}
        </p>
      ) : (
        <>
          <Filters
            query={query}
            onQuery={setQuery}
            lists={lists}
            counts={counts}
            about={about}
            onAbout={showAbout}
          />
          {about ? (
            <Sections
              data={data}
              owner={owner}
              ownerTools={owner || route.params.has('owner')}
              onOwner={setOwner}
              available={records.available}
              problem={records.problem}
              onRecords={setRecords}
            />
          ) : (
            <div className="ja-desk" data-open={adId ? 'true' : 'false'}>
              <JobList
                rows={shown.slice(0, limit)}
                total={shown.length}
                selectedId={selected?.ad.id}
                href={href}
                onOpen={open}
                onMore={() => setMore({ key: qKey, n: limit + PAGE })}
                empty={l(...EMPTY[query.list])}
                day={day}
                listRef={listRef}
                listKey={`${query.list}|${qKey}`}
              />
              {selected ? (
                <AdDetail
                  key={selected.ad.id}
                  row={selected}
                  published={data.texts.texts[selected.ad.id]?.description}
                  opened={selected === opened}
                  onMark={(id, m) => {
                    setMoved(true)
                    mark(id, m)
                  }}
                  kept={kept}
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
          )}
        </>
      )}
    </div>
  )
}

/** An opened ad that is not on the board: removed, expired, or older than the file. */
function Gone({
  id,
  ad,
  onBack,
}: {
  id: string
  ad?: { headline: string; source_url: string }
  onBack: () => void
}) {
  const source = https(ad?.source_url)
  return (
    <article className="ja-detail" aria-labelledby="ja-detail-title">
      <button type="button" className="btn-text ja-back" onClick={onBack}>
        {l('Back to the list', 'Tillbaka till listan')}
      </button>
      <div className="ja-detail-main">
        <h2 id="ja-detail-title">
          {ad?.headline ?? l(`Ad ${id}`, `Annons ${id}`)}
        </h2>
        <p className="ja-muted">
          {l(
            'This ad is closed or removed, so it is no longer on the board.',
            'Annonsen är stängd eller borttagen, så den finns inte längre på tavlan.',
          )}
        </p>
        {source && (
          <p>
            <a href={source} target="_blank" rel="noreferrer">
              {l('Original ad', 'Originalannonsen')}
            </a>
          </p>
        )}
      </div>
    </article>
  )
}
