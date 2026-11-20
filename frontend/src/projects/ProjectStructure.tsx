import { useEffect, useRef, type ReactNode } from 'react'
import { l } from '../i18n'
import { isLongRead, type Route } from '../router'
import { PROJECTS, projectForRoute } from './projectRegistry'
import { scrollToElement } from '../ui/scrollTo'
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
  // Another section of the page the reader is on glides; a page opened on a section jumps.
  const last = useRef<{ path: string; hash: string } | null>(null)
  useEffect(() => {
    const glide =
      last.current?.path === route.path && last.current.hash !== route.hash
    last.current = { path: route.path, hash: route.hash }
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
    const land = () => scrollToElement(document.getElementById(id), { glide })
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
  return <div className="project-structure">{children}</div>
}
