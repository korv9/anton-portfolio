import { useEffect, useRef, useState } from 'react'
import { currentLocale, l, setLocale, type Locale } from '../i18n'
import { profile } from '../content'
import {
  PROJECT_GROUPS,
  PROJECTS,
  projectForRoute,
} from '../projects/projectRegistry'
import type { Route } from '../router'
import './header.css'

export default function SiteHeader({
  route,
  onLanguage,
}: {
  route: Route
  onLanguage: (locale: Locale) => void
}) {
  const menu = useRef<HTMLDetailsElement>(null)
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
    const section = document.getElementById('projekt')
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
    <header className="site-header" data-hidden={hidden} inert={hidden}>
      <a className="site-identity" href="#start">
        <strong>ANTON ERNSTSSON</strong>
        <span>PERSONAL PROJECTS</span>
      </a>
      <nav
        className="site-navigation"
        aria-label={l('Main navigation', 'Huvudnavigation')}
      >
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
            {l('Projects', 'Projekt')} <span aria-hidden="true">⌄</span>
          </summary>
          <div className="project-menu-panel">
            {PROJECT_GROUPS.map((group) => (
              <section key={group.label}>
                <h2>{group.label}</h2>
                <ul>
                  {group.ids.map((id) => {
                    const project = PROJECTS.find((p) => p.id === id)!
                    return (
                      <li key={id}>
                        <a
                          href={project.href}
                          aria-current={active?.id === id ? 'true' : undefined}
                        >
                          {l(project.title.en, project.title.sv)}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
            <div className="project-menu-tools">
              <a href="#projekt">{l('All projects', 'Alla projekt')}</a>
              <a href="#cluster-visuals">Cluster Visuals</a>
            </div>
          </div>
        </details>
        <a href="#om-mig">{l('About', 'Om mig')}</a>
        <a href="#erfarenhet">{l('Experience', 'Erfarenhet')}</a>
        <a href="#utbildning">{l('Education', 'Utbildning')}</a>
        {profile.cv && (
          <a href={profile.cv} download>
            CV
          </a>
        )}
        <button
          className="language-switch"
          type="button"
          aria-label={l('Switch to Swedish', 'Byt till engelska')}
          onClick={() => {
            const next = currentLocale() === 'sv' ? 'en' : 'sv'
            setLocale(next)
            onLanguage(next)
          }}
        >
          {currentLocale() === 'sv' ? 'EN' : 'SV'}
        </button>
      </nav>
    </header>
  )
}
