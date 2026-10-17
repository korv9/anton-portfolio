import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { currentLocale, l, type Locale } from './i18n'
import { AI_ACT_TABS, WELFARE_TABS, sameReport, useRoute } from './router'
import { pageTitle, ProjectContext, ProjectPager } from './site/Header'
import SiteHeader from './site/SiteHeader'
import { CvViewerProvider } from './site/CvViewer'
import HomePage from './home/HomePage'
import DebateBackdrop from './home/DebateBackdrop'
import ProjectStructure from './projects/ProjectStructure'
import { PROJECT_GROUPS, projectForRoute } from './projects/projectRegistry'
import { PageBoundary } from './site/PageBoundary'
import './site/site.css'
import './site/editorial.css'

// Everything but the start page loads on navigation, so the start page ships none of it.
const ProjectsPage = lazy(() => import('./tech/TechPanel'))
const PoliticsProduct = lazy(() => import('./politik/PoliticsProduct'))
const JobsProduct = lazy(() => import('./jobb/JobsProduct'))
const ComplianceExplorer = lazy(() => import('./compliance/ComplianceExplorer'))
const CompanyIntelligence = lazy(
  () => import('./companies/CompanyIntelligence'),
)
const WelfareReport = lazy(() => import('./welfare/WelfareReport'))
const WelfareDeep = lazy(() =>
  import('./welfare/WelfareReport').then((m) => ({ default: m.WelfareDeep })),
)
const SymbolicAtlasPage = lazy(() => import('./symbolic/SymbolicAtlasPage'))
const AiActProduct = lazy(() => import('./aiact/AiActProduct'))
const AiActReport = lazy(() => import('./aiact/AiActReport'))
const PhilosophyAtlasPage = lazy(
  () => import('./philosophy/PhilosophyAtlasPage'),
)
const ConceptConstellationPage = lazy(
  () => import('./concepts/ConceptConstellationPage'),
)
const ClusterVisualsPage = lazy(() => import('./clusters/ClusterVisualsPage'))
const AskTheLaw = lazy(() => import('./lawqa/AskTheLaw'))
const SfsReport = lazy(() => import('./sfs/SfsReport'))
const DrugCombPage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.DrugCombPage })),
)
const ThesisPage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.ThesisPage })),
)
const LakehousePage = lazy(() => import('./products/LakehousePage'))
const HomiePage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.HomiePage })),
)

export default function App() {
  const route = useRoute()
  const [language] = useState<Locale>(currentLocale)
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  // Each page names itself in the tab and the history: "<page> | Anton Ernstsson".
  useEffect(() => {
    const name = pageTitle(route)
    document.title = name
      ? `${name} | Anton Ernstsson`
      : 'ANTON ERNSTSSON DATA & AI'
  }, [route.path, route.page, language])

  // A new address scrolls to its section on the start page, or to the top elsewhere. Changing
  // only a view's filters (the query) keeps the reader where they are.
  const cameFrom = useRef(route.path)
  useEffect(() => {
    const from = cameFrom.current
    cameFrom.current = route.path
    if (route.page === 'home' && route.path !== '#start') return
    // A tab of a report opens where the reader stands, like a tab.
    if (sameReport(from, route.path)) return
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }, [route.path, route.page])

  const { page, path } = route
  const project = projectForRoute(route)
  const workspace =
    PROJECT_GROUPS.find((group) =>
      group.ids.includes(project?.id ?? ''),
    )?.label.toLowerCase() ?? 'tool'
  return (
    <CvViewerProvider>
      <div
        className={`site-shell${page === 'home' ? ' home-shell' : ' project-shell'}`}
        data-workspace={page === 'home' ? undefined : workspace}
      >
        {page === 'home' && <DebateBackdrop playIntro />}
        <a className="skip-link" href="#main">
          {l('Skip to content', 'Hoppa till innehåll')}
        </a>
        <SiteHeader route={route} />
        <main
          id="main"
          tabIndex={-1}
          key={language}
          style={{ background: 'transparent' }}
        >
          <ProjectContext route={route} />
          <PageBoundary key={page}>
            <ProjectStructure route={route}>
              <Suspense
                fallback={
                  <p className="theme-loading ds-container" role="status">
                    {l('Loading…', 'Laddar…')}
                  </p>
                }
              >
                {page === 'home' && <HomePage path={path} />}
                {page === 'projects' && <ProjectsPage />}
                {page === 'politik' && <PoliticsProduct route={route} />}
                {page === 'jobs' &&
                  (path === '#jobb-it' ? (
                    <CompanyIntelligence route={route} />
                  ) : (
                    <JobsProduct route={route} />
                  ))}
                {page === 'company' && <CompanyIntelligence route={route} />}
                {page === 'compliance' && <ComplianceExplorer route={route} />}
                {page === 'welfare' &&
                  (WELFARE_TABS.includes(path) ? (
                    <WelfareReport route={route} />
                  ) : (
                    <WelfareDeep route={route} />
                  ))}
                {page === 'symbolic' && <SymbolicAtlasPage route={route} />}
                {page === 'clusters' && <ClusterVisualsPage />}
