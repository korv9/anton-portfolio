/** Political Observatory: five analytical areas, with retained evidence readers and tools. */
import { Suspense, lazy, useEffect } from 'react'
import type { Route } from '../router'
import { carryParties } from './partySelection'
import { themeByPath, type ThemeKey } from './nav'
import Workspace, { DataState, WorkspaceCoverage } from './workspace/Workspace'
import './politik.css'
import './dash/dash.css'

const ValjarnaTheme = lazy(() => import('./themes/ValjarnaTheme'))
const RosterTheme = lazy(() => import('./themes/RosterTheme'))
const BudgetTheme = lazy(() => import('./themes/BudgetTheme'))
const BudgetBoard = lazy(() => import('./budget/BudgetBoard'))
const SkatterTheme = lazy(() => import('./themes/SkatterTheme'))
const UtredningarTheme = lazy(() => import('./themes/UtredningarTheme'))
const NyheterTheme = lazy(() => import('./themes/NyheterTheme'))
const Partier = lazy(() => import('./partier/Partier'))
const Sakdebatter = lazy(() => import('./debatter/Sakdebatter'))
const Partiledardebatter = lazy(() => import('./debatter/Partiledardebatter'))
const DebateView = lazy(() => import('./debatter/DebateView'))
const TalTheme = lazy(() => import('./themes/TalTheme'))
const UtforskaTheme = lazy(() => import('./themes/UtforskaTheme'))
const ModellTheme = lazy(() => import('./modell/ModellTheme'))
const KallorTheme = lazy(() => import('./themes/KallorTheme'))
const DeepDive = lazy(() => import('./DeepDive'))
const ReportMaps = lazy(() => import('../clusters/ReportMaps'))

function ThemeView({ theme, route }: { theme: ThemeKey; route: Route }) {
  switch (theme) {
    case 'valjarna':
      return <ValjarnaTheme route={route} />
    case 'roster':
      return <RosterTheme route={route} />
    case 'budget':
      return <BudgetBoard route={route} />
    case 'skatter':
      return (
        <>
          <h1>Tax details</h1>
          <SkatterTheme route={route} />
        </>
      )
    case 'utredningar':
      return <UtredningarTheme route={route} />
    case 'nyheter':
      return <NyheterTheme route={route} />
    case 'partier':
      return <Partier route={route} />
    case 'sakdebatter':
      return <Sakdebatter route={route} />
    case 'partiledare':
      return <Partiledardebatter route={route} />
    case 'tal':
      return <TalTheme route={route} />
    case 'modell':
      return <ModellTheme route={route} />
    case 'utforska':
      return (
        <>
          <UtforskaTheme />
          <WorkspaceCoverage />
        </>
      )
    case 'kallor':
      return (
        <>
          <KallorTheme />
          <WorkspaceCoverage />
        </>
      )
  }
}

export default function PoliticsProduct({ route }: { route: Route }) {
  useEffect(() => carryParties(route), [route.hash])
  const theme = themeByPath(route.path)
  return (
    <div className="politik" id="politik">
      <Workspace route={route}>
        <Suspense fallback={<DataState />}>
          <section id={route.path.slice(1)} className="po-research-view">
            {route.path === '#politik-debatt' ? (
              <DebateView route={route} />
            ) : route.path === '#politik-kluster' ? (
              <section>
                <h1>Experimental debate maps</h1>
                <ReportMaps ids={['debates', 'research-debates']} />
              </section>
            ) : route.path === '#politik-budget-detalj' ? (
              <BudgetTheme route={route} />
            ) : route.path === '#politik-tal-detalj' ? (
              <TalTheme route={route} />
            ) : theme ? (
              <ThemeView theme={theme.key} route={route} />
            ) : (
              <DeepDive path={route.path} />
            )}
          </section>
        </Suspense>
      </Workspace>
    </div>
  )
}
