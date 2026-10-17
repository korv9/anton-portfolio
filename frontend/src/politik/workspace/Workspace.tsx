import { Suspense, lazy, type ReactNode } from 'react'
import { l } from '../../i18n'
import type { Route } from '../../router'
import { useParties } from '../partySelection'
import { PartyLogo, RIKSDAG_PARTIES, partyName } from '../../parties/identity'
import { workspaceHref } from './logic'
import './workspace.css'
import {
  useDataset,
  workspacePath,
  type Workspace as WorkspaceData,
} from './data'

const Overview = lazy(() => import('./Overview'))
const Elections = lazy(() => import('./Elections'))
const Parliament = lazy(() => import('./Parliament'))
const Economy = lazy(() => import('./Economy'))
const Debates = lazy(() => import('./Debates'))
export const AREAS = [
  { path: '#politik', label: 'Overview' },
  { path: '#politik-val', label: 'Elections & Voters' },
  { path: '#politik-riksdag', label: 'Parliament & Governments' },
  { path: '#politik-budget', label: 'Economy & Policy' },
  { path: '#politik-tal', label: 'Debates & Legislation' },
]

function areaOf(path: string) {
  if (['#politik-val', '#politik-valjarna', '#politik-mandat'].includes(path))
    return 1
  if (
    [
      '#politik-riksdag',
      '#politik-roster',
      '#politik-partier',
      '#politik-modell',
    ].includes(path)
  )
    return 2
  if (path.includes('budget') || path.includes('skatt')) return 3
  if (
    [
      '#politik-tal',
      '#politik-kluster',
      '#politik-utredningar',
      '#politik-partiledardebatter',
      '#politik-sakdebatter',
      '#politik-debatt',
      '#politik-sok',
    ].includes(path)
  )
    return 4
  return 0
}

export function DataState({
  error,
  children,
}: {
  error?: string | null
  children?: ReactNode
}) {
  if (error)
    return (
      <div role="alert" className="po-state">
        <p>Data unavailable in this delivery.</p>
        <details>
          <summary>Coverage and recovery</summary>
          <p>{error}</p>
          <p>
            Use the approved snapshot or rebuild the political workspace export.
            No substitute observations are shown.
          </p>
        </details>
        <button
          type="button"
          className="btn-quiet"
          onClick={() => location.reload()}
        >
          Retry
        </button>
      </div>
    )
  return (
    <p className="po-state" role="status">
      {children ?? 'Loading observations…'}
    </p>
  )
}

export function WorkspaceCoverage() {
  const { data, error } = useDataset<WorkspaceData>(workspacePath)
  return (
    <section
      className="po-workspace-coverage"
      aria-labelledby="workspace-coverage-title"
    >
      <h2 id="workspace-coverage-title">Workspace coverage and evidence</h2>
      {!data ? (
        <DataState error={error} />
      ) : (
        <>
          <p>
            Export dated {data.as_of}. Ordinary substantive roll calls cover{' '}
            {data.sessions[0]?.session}–{data.sessions.at(-1)?.session}.
            Party-level government and issue comparisons cover{' '}
            {data.context_sessions.join(', ')} in this delivery.
          </p>
          <p>
            {data.coverage.ballots_note} {data.ballots.length} reviewed ballots
            cover {data.coverage.ballots_from}–{data.coverage.ballots_to}. Every
            record includes its official source and source checksum.
          </p>
          <p>
            Government membership is dated separately. Agreement labels describe
            the seed’s stated cooperation period; they do not establish support
            on every vote date. Bill links are document citations. Report-title
            matches and semantic speech candidates remain candidate
            relationships.
          </p>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data, null, 2)], {
                  type: 'application/json',
                }),
              )
              const link = document.createElement('a')
              link.href = url
              link.download = 'political-workspace.json'
              link.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            }}
          >
            Download workspace counts, ballots and provenance (JSON)
          </button>
        </>
      )}
    </section>
  )
}

export default function Workspace({
  route,
  children,
}: {
  route: Route
  children?: ReactNode
}) {
  const { selected, toggle, clear } = useParties(route)
  const area = areaOf(route.path)
  const mainArea = AREAS.some((a) => a.path === route.path)
  return (
    <div className="po-workspace">
      <header className="po-header">
        <div>
          <a
            href={workspaceHref('#politik', route.params)}
            className="politik-intro-name"
          >
            Political Observatory
          </a>
          <p>Swedish elections, governments and parliamentary evidence</p>
        </div>
        <nav aria-label="Political research tools">
          <a href={workspaceHref('#politik-partier', route.params)}>
            Party profiles
          </a>
          <a href={workspaceHref('#politik-kallor', route.params)}>
            Sources & coverage
          </a>
        </nav>
      </header>
      <nav className="po-areas" aria-label="Political Observatory areas">
        {AREAS.map((a, i) => (
          <a
            key={a.path}
            href={workspaceHref(a.path, route.params)}
            aria-current={area === i ? 'page' : undefined}
          >
            {a.label}
          </a>
        ))}
      </nav>
      <div className="po-partybar">
        <div role="group" aria-label="Compare parties">
          {RIKSDAG_PARTIES.map((p) => (
            <button
              key={p}
              type="button"
              aria-label={partyName(p)}
              aria-pressed={selected.includes(p)}
              onClick={() => toggle(p)}
            >
              <PartyLogo party={p} size={22} />
              <span>{p}</span>
            </button>
          ))}
        </div>
        <button className="btn-text" type="button" onClick={clear}>
          All parties
        </button>
        <span aria-live="polite">
          {selected.length
            ? `${selected.join(', ')} selected`
            : 'All parties shown'}
        </span>
      </div>
      {!mainArea && (
        <a
          className="po-back"
          href={workspaceHref(AREAS[area].path, route.params)}
        >
          ← {AREAS[area].label}
        </a>
      )}
      <Suspense fallback={<DataState />}>
        {route.path === '#politik' ? (
          <Overview route={route} />
        ) : route.path === '#politik-val' ? (
          <Elections route={route} />
        ) : route.path === '#politik-riksdag' ? (
          <Parliament route={route} />
        ) : route.path === '#politik-budget' ? (
          <Economy route={route} />
        ) : route.path === '#politik-tal' ? (
          <Debates route={route} />
        ) : (
          children
        )}
      </Suspense>
      <footer className="po-footer">
        <span>
          {l(
            'Descriptive evidence. Source periods vary by chart.',
            'Beskrivande data. Källornas perioder varierar mellan diagram.',
          )}
        </span>
        <a href={workspaceHref('#politik-utforska', route.params)}>
          Datasets and downloads
        </a>
      </footer>
    </div>
  )
}
