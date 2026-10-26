import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { currentLocale, l, type Locale } from './i18n'
import { sameReport, useRoute } from './router'
import { pageTitle, ProjectContext } from './site/Header'
import SiteHeader from './site/SiteHeader'
import ProjectRail from './site/ProjectRail'
import { CvViewerProvider } from './site/CvViewer'
import HomePage from './home/HomePage'
import DebateBackdrop from './home/DebateBackdrop'
import ProjectStructure from './projects/ProjectStructure'
import { PROJECT_GROUPS, projectForRoute } from './projects/projectRegistry'
import { PageBoundary } from './site/PageBoundary'
import './site/site.css'
import './site/editorial.css'

// Everything but the start page loads on navigation, so the start page ships none of it.
const ProjectsHub = lazy(() => import('./hub/ProjectsHub'))
const SwedenPage = lazy(() => import('./sweden/SwedenPage'))
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
const JobAssistantPage = lazy(() => import('./job-assistant/JobAssistantPage'))
const ReplikPage = lazy(() => import('./replik/ReplikPage'))
const AiClockPage = lazy(() => import('./aiclock/AiClockPage'))
const DrugCombPage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.DrugCombPage })),
)
const ThesisPage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.ThesisPage })),
)
const HomiePage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.HomiePage })),
)

export default function App() {
  const route = useRoute()
  const [language, setLanguage] = useState<Locale>(currentLocale)
  useEffect(() => {
    const update = () => setLanguage(currentLocale())
    window.addEventListener('localechange', update)
    return () => window.removeEventListener('localechange', update)
  }, [])
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

  // A new address scrolls to its section on the start page or in the projects hub, or to the
  // top elsewhere. Changing only a view's filters (the query) keeps the reader where they are.
  const cameFrom = useRef(route.path)
  useEffect(() => {
    const from = cameFrom.current
    cameFrom.current = route.path
    if (route.page === 'home' && route.path !== '#start') return
    if (route.page === 'projects' && route.path !== '#projects') return
    // A tab of a report opens where the reader stands, like a tab.
    if (sameReport(from, route.path)) return
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }, [route.path, route.page])

  const { page, path } = route
  const project = projectForRoute(route)
  const workspace =
    page === 'sweden'
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
        {/* The start page has no header: it opens on the name alone. Project pages sit beside
            the index; the header stays for phones and is hidden on wide screens
            (project-rail.css). */}
        {page !== 'home' && <ProjectRail route={route} />}
        {page !== 'home' && <SiteHeader />}
        <main
          id="main"
          tabIndex={-1}
          // A new page enters with the projects-start motion: up from below, out of a blur.
          key={`${language}-${page}`}
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
                {page === 'projects' && <ProjectsHub path={path} />}
                {page === 'sweden' && <SwedenPage route={route} />}
                {page === 'symbolic' && <SymbolicAtlasPage route={route} />}
                {page === 'clusters' && <ClusterVisualsPage />}
                {page === 'meaning' && <MeaningPage />}
                {page === 'lawqa' && <AskTheLaw route={route} />}
                {page === 'jobs' && <JobAssistantPage route={route} />}
                {page === 'philosophy' && <PhilosophyAtlasPage route={route} />}
                {page === 'concepts' && (
                  <ConceptConstellationPage route={route} />
                )}
                {page === 'drugcomb' && <DrugCombPage route={route} />}
                {page === 'thesis' && <ThesisPage />}
                {page === 'homie' && <HomiePage />}
                {page === 'replik' && <ReplikPage />}
                {page === 'aiclock' && <AiClockPage />}
              </Suspense>
            </ProjectStructure>
          </PageBoundary>
        </main>
      </div>
    </CvViewerProvider>
  )
}
