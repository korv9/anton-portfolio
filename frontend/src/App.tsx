import { Suspense, lazy, useEffect, useState } from 'react'
import { currentLocale, l, type Locale } from './i18n'
import { useRoute } from './router'
import { pageTitle, ProjectContext, ProjectPager } from './site/Header'
import SiteHeader from './site/SiteHeader'
import HomePage from './home/HomePage'
import DebateBackdrop from './home/DebateBackdrop'
import ProjectOverview from './projects/ProjectOverview'
import ProjectStructure from './projects/ProjectStructure'
import { PageBoundary } from './site/PageBoundary'
import './site/site.css'
import './site/editorial.css'

// Everything but the start page loads on navigation, so the start page ships none of it.
const PoliticsProduct = lazy(() => import('./politik/PoliticsProduct'))
const JobsProduct = lazy(() => import('./jobb/JobsProduct'))
const WelfarePage = lazy(() => import('./welfare/WelfarePage'))
const SymbolicAtlasPage = lazy(() => import('./symbolic/SymbolicAtlasPage'))
const AiActProduct = lazy(() => import('./aiact/AiActProduct'))
const PhilosophyAtlasPage = lazy(
  () => import('./philosophy/PhilosophyAtlasPage'),
)
const ConceptConstellationPage = lazy(
  () => import('./concepts/ConceptConstellationPage'),
)
const ClusterVisualsPage = lazy(() => import('./clusters/ClusterVisualsPage'))
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
  const [language, setLanguage] = useState<Locale>(currentLocale)
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
  useEffect(() => {
    if (route.page === 'home' && route.path !== '#start') return
    requestAnimationFrame(() => {
      // A section address (#symbolic-method, #concepts-method) scrolls to that section;
      // a page address to the top.
      const target =
        (route.page === 'symbolic' && route.path !== '#symbolic-atlas') ||
        (route.page === 'philosophy' && route.path !== '#philosophy-atlas') ||
        route.path === '#concepts-profiles' ||
        route.path === '#concepts-method'
          ? document.getElementById(route.path.slice(1))
          : null
      if (target) target.scrollIntoView({ block: 'start' })
      else window.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [route.path, route.page])

  const { page, path } = route
  return (
    <div
      className={`site-shell${page === 'home' ? ' home-shell' : ' project-shell'}`}
    >
      {page === 'home' && <DebateBackdrop playIntro />}
      <a className="skip-link" href="#main">
        {l('Skip to content', 'Hoppa till innehåll')}
      </a>
      <SiteHeader route={route} onLanguage={setLanguage} />
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
              {page === 'politik' &&
                (path === '#politik' ? (
                  <ProjectOverview id="politics" />
                ) : (
                  <PoliticsProduct route={route} />
                ))}
              {page === 'jobs' &&
                (path === '#jobb' ? (
                  <ProjectOverview id="jobs" />
                ) : (
                  <JobsProduct route={route} />
                ))}
              {page === 'welfare' &&
                (path === '#sweden' ? (
                  <ProjectOverview id="welfare" />
                ) : (
                  <WelfarePage view={path} />
                ))}
              {page === 'symbolic' && <SymbolicAtlasPage route={route} />}
              {page === 'clusters' && <ClusterVisualsPage />}
              {page === 'aiact' &&
                (path === '#ai-act' ? (
                  <ProjectOverview id="ai-act" />
                ) : (
                  <AiActProduct route={route} />
                ))}
              {page === 'philosophy' && <PhilosophyAtlasPage route={route} />}
              {page === 'concepts' && (
                <ConceptConstellationPage route={route} />
              )}
              {page === 'drugcomb' && <DrugCombPage />}
              {page === 'thesis' && <ThesisPage />}
              {page === 'lakehouse' && <LakehousePage />}
              {page === 'homie' && <HomiePage />}
            </Suspense>
          </ProjectStructure>
        </PageBoundary>
        <ProjectPager route={route} />
      </main>
    </div>
  )
}
