/**
 * Jobbmarknaden i siffror: the job-market product, built like the politics product. Eight
 * themes, listed under the project in the site sidebar, a bar of occupation fields above every page (the field
 * bar, like the party bar) and one question per theme. The earlier job-market views open as
 * deep dives under "Utforska själv", so their addresses keep working.
 */
import { Suspense, lazy, useEffect } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { fieldName, useMarket, type Market } from './data'
import { carryFields, useFields } from './selection'
import '../politik/politik.css'
import '../politik/dash/dash.css'
import './jobb.css'

const Dashboard = lazy(() => import('./Dashboard'))
const Themes = lazy(() => import('./themes'))
const JobMarketPage = lazy(() => import('../jobs/JobMarketPage'))
const TechReport = lazy(() => import('../jobs/TechReport'))
const ClusteringSection = lazy(() => import('../jobs/ClusteringSection'))

import { JOB_THEMES, type JobsTheme } from './nav'
export { JOB_THEMES, type JobsTheme }

export type ThemeProps = { route: Route; data: Market; fields: string[] }

export default function JobsProduct({ route }: { route: Route }) {
  const theme = JOB_THEMES.find((t) => t.path === route.path)
  const { data, error } = useMarket()
  const valid = data?.fields.map((f) => f.id)
  const { selected } = useFields(route, valid)
  useEffect(() => carryFields(route), [route.path])

  const loading = (
    <p className="theme-loading" role="status">
      {l('Loading…', 'Laddar…')}
    </p>
  )
  // The overview opens on its own first screen, with the field bar under it.
  const landing = theme?.key === 'lage'
  return (
    <div
      className={`politik jobb${landing ? ' politik-landing' : ''}`}
      id="jobb"
    >
      <div className="politik-body">
        {theme && !landing && theme.key !== 'kluster' && data && (
          <FieldBar route={route} data={data} />
        )}
        <div className="politik-main">
          {error && (
            <p role="alert" className="theme-error">
              {error}
            </p>
          )}
          <Suspense fallback={loading}>
            {!theme ? (
              ['#job-market-tech', '#job-data'].includes(route.path) ? (
                <TechReport />
              ) : (
                <JobMarketPage view={route.path} />
              )
            ) : theme.key === 'kluster' ? (
              // The semantic clusters of IT ads have their own data; the field bar does not apply.
              <ClusteringSection />
            ) : !data ? (
              !error && loading
            ) : theme.key === 'lage' ? (
              <Dashboard
                route={route}
                data={data}
                fields={selected}
                slicer={<FieldBar route={route} data={data} />}
              />
            ) : (
              <Themes
                theme={theme.key}
                route={route}
                data={data}
                fields={selected}
              />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  )
}

/**
 * The field bar: the occupation fields as one row of buttons above every page. Any number can
 * be chosen and every chart then answers for them; none chosen means the whole market.
 */
function FieldBar({ route, data }: { route: Route; data: Market }) {
  const { selected, toggle, clear } = useFields(
    route,
    data.fields.map((f) => f.id),
  )
  const latest = data.latest_year
  const sizeOf = (id: string) =>
    (data.monthly[id] ?? [])
      .filter(([m]) => Number(m.slice(0, 4)) === latest)
      .reduce((s, [, a]) => s + a, 0)
  // Largest fields first, so the common choices are at hand.
  const fields = [...data.fields].sort((a, b) => sizeOf(b.id) - sizeOf(a.id))
  return (
    <div
      className={
        selected.length
          ? 'politik-slicer jobb-slicer active'
          : 'politik-slicer jobb-slicer'
      }
      role="group"
      aria-label={l('Occupation fields', 'Yrkesområden')}
    >
      <p className="politik-slicer-label" aria-hidden="true">
        {l('Fields', 'Områden')}
      </p>
      <ul>
        {fields.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              aria-pressed={selected.includes(f.id)}
              onClick={() => toggle(f.id)}
            >
              {fieldName(f.name)}
            </button>
          </li>
        ))}
      </ul>
      <p className="politik-slicer-state" aria-live="polite">
        {selected.length ? (
          <>
            <span>
              {selected.length === 1
                ? fieldName(data.fields.find((f) => f.id === selected[0])!.name)
                : l(`${selected.length} fields`, `${selected.length} områden`)}
            </span>
            <button type="button" onClick={clear}>
              {l('Show all', 'Visa alla')}
            </button>
          </>
        ) : (
          <span>{l('Whole market', 'Hela marknaden')}</span>
        )}
      </p>
    </div>
  )
}
