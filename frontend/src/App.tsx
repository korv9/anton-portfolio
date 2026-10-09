import { Suspense, lazy, useEffect, useState } from 'react'
import { currentLocale, l, type Locale } from './i18n'
import { useRoute } from './router'
import { pageTitle, ProjectContext, ProjectPager } from './site/Header'
import Sidebar from './site/Sidebar'
import HomePage from './home/HomePage'
import { PageBoundary } from './site/PageBoundary'
import './site/site.css'

// Everything but the start page loads on navigation, so the start page ships none of it.
const PoliticsProduct = lazy(() => import('./politik/PoliticsProduct'))
const TechReport = lazy(() => import('./jobs/TechReport'))
const JobsProduct = lazy(() => import('./jobb/JobsProduct'))
const WelfarePage = lazy(() => import('./welfare/WelfarePage'))
const DataModelPage = lazy(() => import('./datamodel/DataModelPage'))
const ErPage = lazy(() => import('./datamodel/ErPage'))
const SymbolicAtlasPage = lazy(() => import('./symbolic/SymbolicAtlasPage'))
const AiActProduct = lazy(() => import('./aiact/AiActProduct'))
const PhilosophyAtlasPage = lazy(
  () => import('./philosophy/PhilosophyAtlasPage'),
)
const QualityPage = lazy(() => import('./quality/QualityPage'))
const ConceptConstellationPage = lazy(
  () => import('./concepts/ConceptConstellationPage'),
)
const CataloguePage = lazy(() => import('./catalogue/CataloguePage'))
const IdeaLineagePage = lazy(() => import('./lineage/IdeaLineagePage'))
const ClusterVisualsPage = lazy(() => import('./clusters/ClusterVisualsPage'))
const DataConstellationPage = lazy(
  () => import('./constellation/DataConstellationPage'),
)
const DrugCombPage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.DrugCombPage })),
)
const AllegoriaPage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.AllegoriaPage })),
)
const ThesisPage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.ThesisPage })),
)
const DivaPage = lazy(() => import('./diva/DivaPage'))
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
      : l('Anton Ernstsson, Data engineer', 'Anton Ernstsson, Data engineer')
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
        (route.page === 'quality' && route.path !== '#quality') ||
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
      <a className="skip-link" href="#main">
        {l('Skip to content', 'Hoppa till innehåll')}
      </a>
      <Sidebar route={route} onLanguage={setLanguage} />
      <main id="main" tabIndex={-1} key={language}>
        <ProjectContext route={route} />
        <PageBoundary key={page}>
          <Suspense
            fallback={
              <p className="theme-loading ds-container" role="status">
                {l('Loading…', 'Laddar…')}
              </p>
            }
          >
            {page === 'home' && <HomePage path={path} />}
            {page === 'politik' && <PoliticsProduct route={route} />}
            {page === 'jobs' &&
              (['#job-market-tech', '#job-data'].includes(path) ? (
                <TechReport />
              ) : (
                <JobsProduct route={route} />
              ))}
            {page === 'welfare' && <WelfarePage view={path} />}
            {page === 'datamodel' && <DataModelPage view={path} />}
            {page === 'er' && <ErPage route={route} />}
            {page === 'symbolic' && <SymbolicAtlasPage route={route} />}
            {page === 'constellation' && (
              <DataConstellationPage route={route} />
            )}
            {page === 'catalogue' && <CataloguePage />}
            {page === 'lineage' && <IdeaLineagePage />}
            {page === 'clusters' && <ClusterVisualsPage />}
            {page === 'aiact' && <AiActProduct route={route} />}
            {page === 'philosophy' && <PhilosophyAtlasPage route={route} />}
            {page === 'concepts' && <ConceptConstellationPage route={route} />}
            {page === 'quality' && <QualityPage route={route} />}
            {page === 'drugcomb' && <DrugCombPage />}
            {page === 'allegoria' && <AllegoriaPage />}
            {page === 'thesis' && <ThesisPage />}
            {page === 'homie' && <HomiePage />}
            {page === 'diva' && <DivaPage />}
          </Suspense>
        </PageBoundary>
        <ProjectPager route={route} />
      </main>
    </div>
  )
}
