import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { currentLocale, l, type Locale } from './i18n'
import { sameReport, useRoute } from './router'
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
const SwedenPage = lazy(() => import('./sweden/SwedenPage'))
const SwedenHeader = lazy(() =>
  import('./sweden/Header').then((m) => ({ default: m.SwedenHeader })),
)
const SymbolicAtlasPage = lazy(() => import('./symbolic/SymbolicAtlasPage'))
const PhilosophyAtlasPage = lazy(
  () => import('./philosophy/PhilosophyAtlasPage'),
)
const ConceptConstellationPage = lazy(
  () => import('./concepts/ConceptConstellationPage'),
)
const ClusterVisualsPage = lazy(() => import('./clusters/ClusterVisualsPage'))
const MeaningPage = lazy(() => import('./meaning/MeaningPage'))
const AskTheLaw = lazy(() => import('./lawqa/AskTheLaw'))
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
    page === 'sweden' || page === 'meaning'
      ? 'sweden'
      : (PROJECT_GROUPS.find((group) =>
          group.ids.includes(project?.id ?? ''),
        )?.label.toLowerCase() ?? 'tool')
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
        {/* SWEDEN pages carry their own header (sweden/Header.tsx); the meaning page shares it. */}
        {page === 'meaning' ? (
          <div className="sweden sw-header-host">
            <Suspense fallback={null}>
              <SwedenHeader current="" />
            </Suspense>
          </div>
        ) : (
          page !== 'sweden' && <SiteHeader route={route} />
        )}
        <main
          id="main"
          tabIndex={-1}
          key={language}
          style={{ background: 'transparent' }}
        >
          {page !== 'meaning' && <ProjectContext route={route} />}
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
                {page === 'sweden' && <SwedenPage route={route} />}
                {page === 'symbolic' && <SymbolicAtlasPage route={route} />}
                {page === 'clusters' && <ClusterVisualsPage />}
                {page === 'meaning' && <MeaningPage />}
                {page === 'lawqa' && <AskTheLaw route={route} />}
                {page === 'philosophy' && <PhilosophyAtlasPage route={route} />}
                {page === 'concepts' && (
                  <ConceptConstellationPage route={route} />
                )}
                {page === 'drugcomb' && <DrugCombPage route={route} />}
                {page === 'thesis' && <ThesisPage />}
                {page === 'lakehouse' && <LakehousePage />}
                {page === 'homie' && <HomiePage />}
              </Suspense>
            </ProjectStructure>
          </PageBoundary>
          <ProjectPager route={route} />
        </main>
      </div>
    </CvViewerProvider>
  )
}
