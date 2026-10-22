import { useEffect, useRef, useState } from 'react'
import { l } from '../i18n'
import { LISTED_PROJECTS, projectForRoute } from '../projects/projectRegistry'
import type { Route } from '../router'
import './header.css'

export default function SiteHeader({ route }: { route: Route }) {
  const menu = useRef<HTMLDetailsElement>(null)
  const header = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = header.current
    if (!element) return
    const update = () =>
      document.documentElement.style.setProperty(
        '--header-h',
        `${element.getBoundingClientRect().height}px`,
      )
    const observer = new ResizeObserver(update)
    observer.observe(element)
    update()
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--header-h')
    }
  }, [])
  const [projectsReached, setProjectsReached] = useState(false)
  const hidden = route.page === 'home' && !projectsReached
  useEffect(() => {
    if (route.page !== 'home') return
    const projects = document.querySelector('.home-project-marker')
    if (!projects) return
    const update = () =>
      setProjectsReached(projects.getBoundingClientRect().top <= 160)
    const observer = new IntersectionObserver(update, {
      rootMargin: '-160px 0px 0px 0px',
    })
    observer.observe(projects)
    const section = projects.parentElement
    if (section) observer.observe(section)
    update()
    return () => observer.disconnect()
  }, [route.page])
  const active = projectForRoute(route)
  useEffect(() => {
    if (menu.current) menu.current.open = false
  }, [route.hash])
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && menu.current)
        menu.current.open = false
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  return (
    <header
      ref={header}
      className="site-header"
      data-hidden={hidden}
      inert={hidden}
    >
      <a className="site-identity" href="#start">
        <strong>ANTON ERNSTSSON</strong>
      </a>
      <p className="site-notice">SITE STILL IN DEVELOPMENT</p>
      <nav
        className="site-navigation"
        aria-label={l('Main navigation', 'Huvudnavigation')}
      >
        <a
          href="#sweden"
          className="site-featured"
          aria-current={route.page === 'sweden' ? 'page' : undefined}
        >
          SWEDEN
        </a>
        <details
          ref={menu}
          className="project-menu"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && menu.current) {
              menu.current.open = false
              menu.current.querySelector('summary')?.focus()
            }
          }}
        >
          <summary>
            {l('Other projects', 'Andra projekt')}{' '}
            <span aria-hidden="true">⌄</span>
          </summary>
          <div className="project-menu-panel">
            <ul>
              {LISTED_PROJECTS.map((project) => (
                <li key={project.id}>
                  <a
                    href={project.href}
                    aria-current={
                      active?.id === project.id ? 'true' : undefined
                    }
                  >
                    {l(project.title.en, project.title.sv)}
                  </a>
                </li>
              ))}
            </ul>
            <div className="project-menu-tools">
              <a href="#projekt">{l('All projects', 'Alla projekt')}</a>
              <a href="#cluster-visuals">Cluster Visuals</a>
              <a href="#what-does-it-even-mean">What does it even mean?</a>
            </div>
          </div>
        </details>
        <a href="#om-mig">{l('About', 'Om mig')}</a>
      </nav>
    </header>
  )
}
