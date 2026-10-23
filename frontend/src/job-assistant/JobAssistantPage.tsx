/**
 * #jobs: the owner's review list of current Data/IT ads matched with the approved CV profile
 * (docs/job-assistant.md). A work tool: dense rows, the selected ad beside them, keyboard first.
 * j/k or the arrow keys move, 1-6 set a status for the owner, / searches, Escape clears it.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { l } from '../i18n'
import { setHashParams, type Route } from '../router'
import AdDetail from './AdDetail'
import Sections from './Sections'
import { classLabel, day, statusLabel } from './labels'
import {
  DEFAULT_VIEW,
  ROLE_NAMES,
  STATUSES,
  filter,
  loadDelivered,
  loadRecords,
  ownerToken,
  rows as joinRows,
  type Delivered,
  type MatchClass,
  type LabelRow,
  type Records,
  type Review,
  type View,
} from './data'
import './job-assistant.css'

const VIEWS: {
  id: string
  classes: View['classes']
  en: string
  sv: string
}[] = [
  {
    id: 'list',
    classes: ['strong', 'possible'],
    en: 'Review list',
    sv: 'Granskningslistan',
  },
  { id: 'stretch', classes: ['stretch'], en: 'Stretch', sv: 'Utmaning' },
  { id: 'outside', classes: ['outside'], en: 'Outside', sv: 'Utanför' },
  {
    id: 'sample',
    classes: 'sample',
    en: 'Evaluation sample',
    sv: 'Utvärderingsurval',
  },
]

export default function JobAssistantPage({ route }: { route: Route }) {
  const [data, setData] = useState<Delivered | null>(null)
  const [records, setRecords] = useState<Records>({
    reviews: {},
    labels: {},
    available: false,
  })
  const [failed, setFailed] = useState('')
  const [owner, setOwner] = useState(() => Boolean(ownerToken()))
  const viewId = route.params.get('view') ?? 'list'
  const [view, setView] = useState<View>(DEFAULT_VIEW)
  // The view's classes follow the address, so the pressed view and the rows never disagree.
  const classes =
    VIEWS.find((v) => v.id === viewId)?.classes ?? DEFAULT_VIEW.classes
  const search = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const focusRow = useRef(false)

  useEffect(() => {
    loadDelivered().then(setData, (e) => setFailed(String(e.message ?? e)))
    loadRecords().then(setRecords)
  }, [])

  const all = useMemo(
    () => (data ? joinRows(data, records) : []),
    [data, records],
  )
  const shown = useMemo(
    () => filter(all, { ...view, classes }),
    [all, view, classes],
  )
  const selectedId = route.params.get('ad') ?? shown[0]?.ad.id
  const selected = all.find((r) => r.ad.id === selectedId) ?? shown[0]
  const roles = useMemo(
    () => [...new Set(all.map((r) => r.match.role))].sort(),
    [all],
  )

  const select = (id: string, push = false) => {
    const params = new URLSearchParams(route.params)
    params.set('ad', id)
    setHashParams(route.path, params, push)
  }
  const chooseView = (id: string) => {
    const params = new URLSearchParams(route.params)
    params.set('view', id)
    params.delete('ad')
    setHashParams(route.path, params)
  }

  function saved(
    id: string,
    kind: 'review' | 'label',
    value: Record<string, unknown>,
  ) {
    const at = new Date().toISOString()
    setRecords((r) =>
      kind === 'review'
        ? {
            ...r,
            reviews: {
              ...r.reviews,
              [id]: {
                ...(value as unknown as Review),
                updated_at: at,
              },
            },
          }
        : {
            ...r,
            labels: {
              ...r.labels,
              [id]: {
                ...(value as unknown as LabelRow),
                updated_at: at,
              },
            },
          },
    )
  }

  useEffect(() => {
    function key(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.isComposing ||
        e.defaultPrevented
      )
        return
      if (target.closest('input, textarea, select') && e.key !== 'Escape')
        return
      // Arrow keys move the selection only from the list; elsewhere they scroll the page.
      const arrow = e.key === 'ArrowDown' || e.key === 'ArrowUp'
      if (arrow && !target.closest('.ja-list')) return
      const index = shown.findIndex((r) => r.ad.id === selected?.ad.id)
      if (e.key === '/') {
        e.preventDefault()
        search.current?.focus()
      } else if (e.key === 'Escape' && view.q) {
        setView({ ...view, q: '' })
      } else if (
        (e.key === 'j' || e.key === 'ArrowDown') &&
        index < shown.length - 1
      ) {
        e.preventDefault()
        select(shown[index + 1].ad.id)
        focusRow.current = true
      } else if ((e.key === 'k' || e.key === 'ArrowUp') && index > 0) {
        e.preventDefault()
        select(shown[index - 1].ad.id)
        focusRow.current = true
      } else if (owner && /^[1-6]$/.test(e.key) && selected) {
        document
          .querySelectorAll<HTMLButtonElement>(
            '.ja-decide .ja-segment:first-child button',
          )
          [Number(e.key) - 1]?.click()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(
      '[aria-current="true"]',
    )
    row?.scrollIntoView({ block: 'nearest' })
    if (focusRow.current) row?.focus()
    focusRow.current = false
  }, [selected?.ad.id])

  if (failed)
    return (
      <div className="ja ds-container">
        <h1>{l('Job assistant', 'Jobbassistenten')}</h1>
        <p className="ja-error" role="alert">
          {l(
            'The ad data could not be loaded: ',
            'Annonsdata kunde inte läsas: ',
          )}
          {failed}
        </p>
      </div>
    )

  const profile = data?.matches.profile
  return (
    <div className="ja ds-container">
      <header className="ja-head">
        <h1>{l('Job assistant', 'Jobbassistenten')}</h1>
        <p className="ja-lede">
          {l(
            'My CV matched every hour with current Data/IT ads from JobTech. Each class says why, with the ad sentence and the CV line behind it. It supports my decision; it does not estimate a chance of being hired.',
            'Mitt cv matchat varje timme mot aktuella Data/IT-annonser från JobTech. Varje klass säger varför, med annonsens mening och cv-raden bakom. Det stöder mitt beslut; det uppskattar inte chansen att bli anställd.',
          )}
        </p>
        {data && (
          <p className="ja-meta">
            {data.ads.counts.current.toLocaleString()}{' '}
            {l('current ads', 'aktuella annonser')} ·{' '}
            {l('read up to', 'lästa till')}{' '}
            {data.ads.fetched_until?.replace('T', ' ').slice(0, 16) ?? '–'} ·{' '}
            {profile
              ? `${l('profile version', 'profilversion')} ${profile.profile_version}, CV ${profile.cv_sha256.slice(0, 8)}`
              : l(
                  'no approved profile yet, so nothing is matched',
                  'ingen godkänd profil än, så inget är matchat',
                )}
          </p>
        )}
      </header>

      <div className="ja-toolbar" role="search">
        <div
          className="ja-segment"
          role="group"
          aria-label={l('Which ads', 'Vilka annonser')}
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={viewId === v.id}
              onClick={() => chooseView(v.id)}
            >
              {l(v.en, v.sv)}
              <span className="ja-count">
                {
                  all.filter((r) =>
                    v.classes === 'sample'
                      ? r.match.sample
                      : v.classes.includes(r.match.class as MatchClass),
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <label>
          <span>{l('Status', 'Status')}</span>
          <select
            value={view.status}
            onChange={(e) =>
              setView({ ...view, status: e.target.value as View['status'] })
            }
          >
            <option value="all">{l('Any', 'Alla')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{l('Role', 'Roll')}</span>
          <select
            value={view.role}
            onChange={(e) => setView({ ...view, role: e.target.value })}
          >
            <option value="all">{l('Any', 'Alla')}</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {l(...(ROLE_NAMES[r] ?? [r, r]))}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{l('Sort', 'Sortera')}</span>
          <select
            value={view.sort}
            onChange={(e) =>
              setView({ ...view, sort: e.target.value as View['sort'] })
            }
          >
            <option value="rank">{l('Best match', 'Bäst matchning')}</option>
            <option value="newest">{l('Newest', 'Nyast')}</option>
            <option value="deadline">{l('Deadline', 'Sista dag')}</option>
          </select>
        </label>
        <label className="ja-search">
          <span>
            {l('Search', 'Sök')} <kbd>/</kbd>
          </span>
          <input
            ref={search}
            type="search"
            value={view.q}
            placeholder={l(
              'Title, employer, place',
              'Titel, arbetsgivare, ort',
            )}
            onChange={(e) => setView({ ...view, q: e.target.value })}
          />
        </label>
      </div>

      {!data ? (
        <p className="theme-loading" role="status">
          {l('Loading the ads…', 'Laddar annonserna…')}
        </p>
      ) : (
        <div className="ja-work">
          <div className="ja-list-pane">
            <p className="ja-list-note" aria-live="polite">
              {shown.length} {l('ads', 'annonser')} · <kbd>j</kbd>/<kbd>k</kbd>{' '}
              {l('to move', 'för att flytta')}
              {owner && records.available && (
                <>
                  {' '}
                  · <kbd>1</kbd>–<kbd>6</kbd> {l('status', 'status')}
                </>
              )}
            </p>
            {shown.length === 0 ? (
              <p className="ja-muted">
                {profile
                  ? l('No ad fits this view.', 'Ingen annons passar vyn.')
                  : l(
                      'Matches appear once a profile is approved.',
                      'Matchningar visas när en profil är godkänd.',
                    )}
              </p>
            ) : (
              <ol className="ja-list" ref={listRef}>
                {shown.map((r) => (
                  <li key={r.ad.id}>
                    <a
                      href={`${route.path}?${new URLSearchParams({ ...Object.fromEntries(route.params), ad: r.ad.id })}`}
                      aria-current={
                        r.ad.id === selected?.ad.id ? 'true' : undefined
                      }
                      onClick={(e) => {
                        e.preventDefault()
                        select(r.ad.id, true)
                        // Stacked under 760 px the detail sits below the list: bring it up.
                        if (matchMedia('(max-width: 760px)').matches)
                          requestAnimationFrame(() =>
                            document
                              .getElementById('ja-detail-title')
                              ?.scrollIntoView({ block: 'start' }),
                          )
                      }}
                    >
                      <span className="ja-row-class" data-class={r.match.class}>
                        {classLabel(r.match.class)}
                      </span>
                      <span className="ja-row-title">{r.ad.headline}</span>
                      <span className="ja-row-meta">
                        {r.ad.employer} ·{' '}
                        {r.ad.municipality ?? r.ad.region ?? '–'}
                      </span>
                      <span className="ja-row-side">
                        {r.status !== 'new' && (
                          <span className="ja-row-status">
                            {statusLabel(r.status)}
                          </span>
                        )}
                        {day(r.ad.published)}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {selected && (
            <AdDetail
              key={selected.ad.id}
              row={selected}
              text={data.texts.texts[selected.ad.id]?.description}
              owner={owner}
              storage={records.available}
              onSaved={saved}
            />
          )}
        </div>
      )}

      {data && (
        <Sections
          data={data}
          records={records}
          owner={owner}
          onOwner={setOwner}
          onRecords={setRecords}
        />
      )}
    </div>
  )
}
