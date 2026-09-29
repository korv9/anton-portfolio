import { Suspense, lazy, useEffect, useState } from 'react'
import { DockContext, WIDE, useMedia } from './site/dock'
import SideNav from './site/SideNav'
import { currentLocale, l, type Locale } from './i18n'
import { useRoute } from './router'
import Intro from './site/Intro'
import Header, { Footer, ProjectBar } from './site/Header'
import HomePage from './home/HomePage'
import './site/site.css'

// Everything but the start page loads on navigation, so the start page ships none of it.
const PoliticsProduct = lazy(() => import('./politik/PoliticsProduct'))
const JobsProduct = lazy(() => import('./jobb/JobsProduct'))
const TallmanPage = lazy(() => import('./tallman/TallmanPage'))
const WelfarePage = lazy(() => import('./welfare/WelfarePage'))
const AnalysisPage = lazy(() => import('./analysis/AnalysisPage'))
const ProjectsPage = lazy(() => import('./projects/ProjectsPage'))
const TechnicalPage = lazy(() => import('./technical/TechnicalPage'))
const StatusPage = lazy(() => import('./status/StatusPage'))
const DataModelPage = lazy(() => import('./datamodel/DataModelPage'))
const DrugCombPage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.DrugCombPage })),
)
const AllegoriaPage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.AllegoriaPage })),
)
const ThesisPage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.ThesisPage })),
)
const HomiePage = lazy(() =>
  import('./products/CaseStudies').then((m) => ({ default: m.HomiePage })),
)

export default function App() {
  const route = useRoute()
  const wide = useMedia(WIDE)
  const [dock, setDock] = useState<HTMLElement | null>(null)
  const [language, setLanguage] = useState<Locale>(currentLocale)
  useEffect(() => {
    document.documentElement.lang = language
    document.title =
      language === 'sv'
        ? 'Anton Ernstsson · Software developer, data och AI'
        : 'Anton Ernstsson · Software developer, data and AI'
  }, [language])

  // A new address scrolls to its section on the start page, or to the top elsewhere. Changing
  // only a view's filters (the query) keeps the reader where they are.
  useEffect(() => {
    requestAnimationFrame(() => {
      const target =
        route.page === 'home' && route.path !== '#start'
          ? document.getElementById(route.path.slice(1))
          : null
      if (target) target.scrollIntoView({ block: 'start' })
      else window.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [route.path, route.page])

  const { page, path } = route
  const back =
    page === 'datamodel' || page === 'status' ? (
      <ProjectBar
        back="#politik-kallor"
        label={l('Sources and method', 'Källor och metod')}
      />
    ) : page === 'analysis' ? (
      <ProjectBar
        back="#sweden"
        label={l('How is Sweden doing?', 'Hur mår Sverige?')}
      />
    ) : page !== 'home' &&
      page !== 'projects' &&
      page !== 'technical' &&
      page !== 'politik' &&
      page !== 'jobs' &&
      page !== 'tallman' ? (
      <ProjectBar />
    ) : null

  return (
    <>
      <a className="skip-link" href="#main">
        {l('Skip to content', 'Hoppa till innehåll')}
      </a>
      <Intro />
      <Header
        path={path}
        inPolitics={page === 'politik'}
        inJobs={page === 'jobs'}
        inTallman={page === 'tallman'}
        onLanguage={setLanguage}
      />
      <DockContext.Provider value={wide ? dock : null}>
        <div className={wide ? 'site-shell has-side' : 'site-shell'}>
          {wide && <SideNav route={route} onDock={setDock} />}
          <div className="site-content">
            <main id="main" tabIndex={-1} key={language}>
              {back}
              <Suspense
                fallback={
                  <p className="theme-loading ds-container" role="status">
                    {l('Loading…', 'Laddar…')}
                  </p>
                }
              >
                {page === 'home' && <HomePage />}
                {page === 'projects' && <ProjectsPage />}
                {page === 'technical' && <TechnicalPage />}
                {page === 'politik' && <PoliticsProduct route={route} />}
                {page === 'jobs' && <JobsProduct route={route} />}
                {page === 'tallman' && <TallmanPage />}
                {page === 'welfare' && <WelfarePage view={path} />}
                {page === 'analysis' && <AnalysisPage view={path} />}
                {page === 'status' && <StatusPage />}
                {page === 'datamodel' && <DataModelPage view={path} />}
                {page === 'drugcomb' && <DrugCombPage />}
                {page === 'allegoria' && <AllegoriaPage />}
                {page === 'thesis' && <ThesisPage />}
                {page === 'homie' && <HomiePage />}
              </Suspense>
            </main>
            <Footer />
          </div>
        </div>
      </DockContext.Provider>
    </>
  )
}
