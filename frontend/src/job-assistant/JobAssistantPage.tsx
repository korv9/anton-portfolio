/**
 * #jobs: the owner's review list of current Data/IT ads matched with the approved CV profile
 * (docs/job-assistant.md). A work tool: dense rows, the selected ad beside them, keyboard first.
 * j/k or the arrow keys move, 1-6 set a status for the owner, / searches, Escape clears it
 * (useListKeys.ts).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { l } from '../i18n'
import { setHashParams, type Route } from '../router'
import AdDetail from './AdDetail'
import AdList from './AdList'
import Sections from './Sections'
import Toolbar, { VIEWS } from './Toolbar'
import { useListKeys } from './useListKeys'
import {
  DEFAULT_VIEW,
  filter,
  loadDelivered,
  loadRecords,
  ownerToken,
  rows as joinRows,
  type Delivered,
  type LabelRow,
  type Records,
  type Review,
  type Status,
  type View,
} from './data'
import './job-assistant.css'
import './job-assistant-detail.css'
import './job-assistant-sections.css'

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
  const statusKey = useRef<((status: Status) => void) | null>(null)

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

  useListKeys({
    shown,
    selected,
    view,
    setView,
    search,
    select,
    statusKey,
    focusRow,
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

      <Toolbar
        all={all}
        viewId={viewId}
        onView={chooseView}
        view={view}
        setView={setView}
        roles={roles}
        search={search}
      />

      {!data ? (
        <p className="theme-loading" role="status">
          {l('Loading the ads…', 'Laddar annonserna…')}
        </p>
      ) : (
        <div className="ja-work">
          <AdList
            route={route}
            shown={shown}
            selectedId={selected?.ad.id}
            keys={owner && records.available}
            profile={Boolean(profile)}
            listRef={listRef}
            onSelect={(id) => select(id, true)}
          />
          {selected && (
            <AdDetail
              key={selected.ad.id}
              row={selected}
              text={data.texts.texts[selected.ad.id]?.description}
              owner={owner}
              storage={records.available}
              onSaved={saved}
              statusKey={statusKey}
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
