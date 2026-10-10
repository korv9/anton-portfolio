import { useEffect, useRef, type ReactNode } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { PROJECTS, projectForRoute } from './projectRegistry'
import './projectStructure.css'

const INLINE_DEPTH = [
  'symbolic-atlas',
  'welfare',
  'thesis',
  'homie',
  'drugcomb',
  'philosophy-atlas',
  'jobs',
  'ai-act',
  'diva',
]

export function ProjectDepth({
  project,
  children,
}: {
  project: string
  children?: ReactNode
}) {
  const entry = PROJECTS.find((p) => p.id === project)!
  const b = (text: { en: string; sv: string }) => l(text.en, text.sv)
  const code =
    typeof entry.code === 'string' ? [entry.code] : (entry.code ?? [])
  return (
    <section
      className="project-depth"
      id={`project-${project}-depth`}
      aria-labelledby={`project-${project}-depth-title`}
    >
      <header className="project-depth-head">
        <h2 id={`project-${project}-depth-title`}>
          {l('Deep dive', 'Fördjupning')}
        </h2>
        <p>
          {l(
            'Method, sources and the details behind the overview.',
            'Metod, källor och detaljerna bakom översikten.',
          )}
        </p>
      </header>
      {children ?? (
        <div className="project-depth-notes">
          <article>
            <h3>{l('The question', 'Frågan')}</h3>
            <p>{b(entry.question)}</p>
          </article>
          <article>
            <h3>{l('How it is built', 'Så är det byggt')}</h3>
            <p>{b(entry.built)}</p>
          </article>
          <article>
            <h3>{l('Results and status', 'Resultat och status')}</h3>
            <p>{b(entry.result)}</p>
          </article>
        </div>
      )}
      <footer className="project-depth-foot">
        <p>{entry.tech.join(' · ')}</p>
        <nav aria-label={l('More detail', 'Mer fördjupning')}>
          {entry.nav
            ?.filter((item) => item.href !== entry.href)
            .map((item) => (
              <a key={item.href} href={item.href}>
                {b(item.label)}
              </a>
            ))}
          {project === 'jobs' && (
            <a href="#job-market-tech">
              {l('Pipeline and data model', 'Pipeline och datamodell')}
            </a>
          )}
          {project === 'welfare' && (
            <a href="#sweden-explorer">
              {l('Explore the indicators', 'Utforska indikatorerna')}
            </a>
          )}
          {code.map((href) => (
            <a key={href} href={href} target="_blank" rel="noreferrer">
              {l('Code and documentation', 'Kod och dokumentation')}{' '}
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>
      </footer>
    </section>
  )
}

export default function ProjectStructure({
  route,
  children,
}: {
  route: Route
  children: ReactNode
}) {
  const project = projectForRoute(route)
  const enabled = project && project.id !== 'politics'
  const depth = route.params.get('section') === 'depth'
  const wasDepth = useRef(depth)
  const params = new URLSearchParams(
    route.path === project?.href ? route.params : undefined,
  )
  params.delete('section')
  const dashboard = `${project?.href}${params.size ? `?${params}` : ''}`
  params.set('section', 'depth')
  const deepLink = `${project?.href}?${params}`

  useEffect(() => {
    const previous = wasDepth.current
    wasDepth.current = depth
    if (!enabled) return
    if (!depth) {
      if (previous) window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    const land = () => {
      const target = document.getElementById(`project-${project.id}-depth`)
      if (!target) return false
      target.scrollIntoView({ block: 'start', behavior: 'instant' })
      return true
    }
    land()
    // Keep the anchor in place while data loads; stop as soon as the reader moves.
    const observer = new MutationObserver(land)
    observer.observe(document.getElementById('main')!, {
      childList: true,
      subtree: true,
    })
    const resize = new ResizeObserver(land)
    resize.observe(document.querySelector('.project-structure')!)
    const stop = () => {
      observer.disconnect()
      resize.disconnect()
    }
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown']
    events.forEach((event) =>
      window.addEventListener(event, stop, { passive: true }),
    )
    return () => {
      stop()
      events.forEach((event) => window.removeEventListener(event, stop))
    }
  }, [enabled, project?.id, depth, route.hash])

  if (!enabled) return children
  return (
    <div className="project-structure">
      <nav
        className="project-view-nav"
        aria-label={l('Project views', 'Projektvyer')}
      >
        <a
          href={dashboard}
          aria-current={
            !depth && route.path === project.href ? 'location' : undefined
          }
        >
          Dashboard
        </a>
        <a href={deepLink} aria-current={depth ? 'location' : undefined}>
          {l('Deep dive', 'Fördjupning')}
        </a>
      </nav>
      {children}
      {!INLINE_DEPTH.includes(project.id) && route.path === project.href && (
        <ProjectDepth project={project.id} />
      )}
    </div>
  )
}
