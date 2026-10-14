/**
 * Jobbmarknaden i siffror: the job-market product, built like the politics product. Eight
 * themes, listed under the project in the site sidebar, a bar of occupation fields above every page (the field
 * bar, like the party bar) and one question per theme. The earlier job-market views open as
 * deep dives under "Utforska själv", so their addresses keep working.
 */
import { Suspense, lazy, useEffect } from 'react'
import { l } from '../i18n'
import { JOB_TABS, type Route } from '../router'
import { DeepPage } from '../report/ReportShell'
import { useMarket, type Market } from './data'
import FieldPicker from './FieldPicker'
import { carryFields, useFields, withFields } from './selection'
import '../politik/politik.css'
import '../politik/dash/dash.css'
import './jobb.css'

const Themes = lazy(() => import('./themes'))
const JobsReport = lazy(() => import('./JobsReport'))
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
  useEffect(() => carryFields(route), [route.hash])

  const loading = (
    <p className="theme-loading" role="status">
      {l('Loading…', 'Laddar…')}
    </p>
  )
  const report = JOB_TABS.includes(route.path)
  return (
    <div className="politik jobb politik-long" id="jobb">
      <div className="politik-body">
        <div className="politik-main">
          {error && (
            <p role="alert" className="theme-error">
              {error}
            </p>
          )}
          <Suspense fallback={loading}>
            {report ? (
              data ? (
                <JobsReport route={route} data={data} fields={selected} />
              ) : (
                !error && loading
              )
            ) : (
              <DeepPage
                id={route.path.slice(1)}
                back={withFields('#jobb', selected)}
                name="Labour Market Observatory"
                aside={
                  data &&
                  theme &&
                  !['kluster', 'kallor'].includes(theme.key) && (
                    <FieldPicker route={route} data={data} />
                  )
                }
              >
                {['#job-market-tech', '#job-data'].includes(route.path) ? (
                  <TechReport />
                ) : theme?.key === 'kluster' ? (
                  <ClusteringSection />
                ) : data ? (
                  <Themes
                    theme={theme?.key ?? 'trender'}
                    route={route}
                    data={data}
                    fields={selected}
                  />
                ) : (
                  !error && loading
                )}
              </DeepPage>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
