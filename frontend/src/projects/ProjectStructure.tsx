import { useEffect, type ReactNode } from 'react'
import { l } from '../i18n'
import { isLongRead, type Route } from '../router'
import { PROJECTS, projectForRoute } from './projectRegistry'
import { PROJECT_TOPICS } from './topics'
import './projectStructure.css'

export function ProjectDepth({
  project,
  children,
}: {
  project: string
  children?: ReactNode
}) {
  const entry = PROJECTS.find((p) => p.id === project)!
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
          {l('Method and data', 'Metod och data')}
        </h2>
      </header>
      {children}
      <footer className="project-depth-foot">
        <p>{entry.tech.join(' · ')}</p>
        <nav aria-label={l('Code and documentation', 'Kod och dokumentation')}>
          {code.map((href) => (
            <a key={href} href={href} target="_blank" rel="noreferrer">
              {l('Code and documentation', 'Kod och dokumentation')} ↗
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
  const topics = project ? (PROJECT_TOPICS[project.id] ?? []) : []
  const active = topics.find((topic) =>
    topic.href.includes('?')
      ? new URLSearchParams(topic.href.split('?')[1]).get('section') ===
        route.params.get('section')
      : topic.href === route.path ||
        topic.links?.some((link) => link.href === route.path),
  )
  useEffect(() => {
    const section = route.params.get('section')
    // A long read lands on its own chapters (PoliticsProduct).
    if (!project || isLongRead(route.path)) return
    if (!section && route.path === project.href) return
    const id =
      section === 'depth'
        ? `project-${project.id}-depth`
        : section
          ? `${project.id}-${section}`
          : route.path.slice(1)
    const land = () =>
      document
        .getElementById(id)
        ?.scrollIntoView({ block: 'start', behavior: 'instant' })
    const frame = requestAnimationFrame(land)
    const observer = new MutationObserver(land)
    const resize = new ResizeObserver(land)
    const main = document.getElementById('main')!
    observer.observe(main, { childList: true, subtree: true })
    resize.observe(main)
    const stop = () => {
      observer.disconnect()
      resize.disconnect()
    }
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown']
    events.forEach((event) =>
      window.addEventListener(event, stop, { passive: true }),
    )
    return () => {
      cancelAnimationFrame(frame)
      stop()
      events.forEach((event) => window.removeEventListener(event, stop))
    }
  }, [route.hash, project?.id])
  if (!project || isLongRead(route.path)) return children
  return (
    <div className="project-structure">
      {topics.length > 0 &&
        (route.path !== project.href ||
          !['politics', 'jobs', 'welfare', 'ai-act'].includes(project.id)) && (
          <nav
            className="project-topics"
            aria-label={l('Project topics', 'Projektets teman')}
          >
            <a
              href={project.href}
              aria-current={
                route.path === project.href && !route.params.has('section')
                  ? 'page'
                  : undefined
              }
            >
              {l('Overview', 'Översikt')}
            </a>
            {topics
              .filter((topic) => topic.href !== project.href)
              .map((topic) => (
                <a
                  key={topic.href}
                  href={topic.href}
                  aria-current={active === topic ? 'page' : undefined}
                >
                  {l(topic.title.en, topic.title.sv)}
                </a>
              ))}
          </nav>
        )}
      {active?.links && (
        <nav
          className="project-topic-tools"
          aria-label={l('In this topic', 'Inom temat')}
        >
          {active.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={link.href === route.path ? 'page' : undefined}
            >
              {l(link.label.en, link.label.sv)}
            </a>
          ))}
        </nav>
      )}
      {children}
    </div>
  )
}
