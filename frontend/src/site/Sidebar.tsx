/**
 * The site sidebar: one navigation for every page. The name and role at the top lead home;
 * then the experience, the projects, more projects and the platform pages, all from
 * projects/projectRegistry.ts; the open project's own views indented under it; CV, GitHub,
 * LinkedIn and the language at the bottom.
 *
 * On a wide screen it is a column to the left of the page. Under 900 px it is a slim bar at the
 * top with a button that opens the same list as a panel. On the start page it stays out of the
 * way while the name and role fill the first screen, and slides in once the reader is past them.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { currentLocale, l, setLocale, type Locale } from '../i18n'
import { profile } from '../content'
import type { Route } from '../router'
import {
  PLATFORM_PAGES,
  PROJECTS,
  SIDEBAR_GROUPS,
  projectForRoute,
  type Bilingual,
  type ProjectEntry,
} from '../projects/projectRegistry'
import { THEMES, activeTheme } from '../politik/nav'
import { partiesOf, withParties } from '../politik/partySelection'
import { JOB_THEMES } from '../jobb/nav'
import { fieldsOf, withFields } from '../jobb/selection'
import './sidebar.css'

const b = (text: Bilingual) => l(text.en, text.sv)

/** `current` is 'page' on the view itself, 'true' on the view an older page lives under. */
type View = { href: string; label: string; current?: 'page' | 'true' }

/** A project's own views, shown indented under it while the reader is inside the project. */
function viewsOf(project: ProjectEntry, route: Route): View[] {
  let views: View[] = []
  if (project.id === 'politics') {
    const active = activeTheme(route.path, route.params)
    const parties = partiesOf(route.params)
    views = THEMES.map((t) => ({
      href: withParties(t.path, parties),
      label: l(t.en, t.sv),
      current: t.key === active ? 'page' : undefined,
    }))
  } else if (project.id === 'jobs') {
    const fields = fieldsOf(route.params)
    // Earlier views (#job-market-occupations …) live under "Explore for yourself".
    const theme = JOB_THEMES.find((t) => t.path === route.path)
    const active = theme?.key ?? 'utforska'
    views = JOB_THEMES.map((t) => ({
      href: withFields(t.path, fields),
      label: l(t.en, t.sv),
      current: t.key === active ? (theme ? 'page' : 'true') : undefined,
    }))
  } else if (project.nav) {
    views = project.nav.map((item) => ({
      href: item.href,
      label: b(item.label),
      current: route.path === item.href ? 'page' : undefined,
    }))
  }
  // The project's own link already leads to its first view.
  return views.filter((v) => v.href.split('?')[0] !== project.href)
}

function ProjectLink({
  project,
  route,
}: {
  project: ProjectEntry
  route: Route
}) {
  const open = projectForRoute(route)?.id === project.id
  const views = open ? viewsOf(project, route) : []
  const here = open && !views.some((v) => v.current)
  const title = b(project.title)
  return (
    <li className={open ? 'is-open' : undefined}>
      {project.href.startsWith('#') ? (
        <a href={project.href} aria-current={here ? 'page' : undefined}>
          {title}
        </a>
      ) : project.href ? (
        <a href={project.href} target="_blank" rel="noreferrer">
          {title} <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <span className="side-plain">{title}</span>
      )}
      {views.length > 0 && (
        <ul className="side-views" aria-label={title}>
          {views.map((v) => (
            <li key={v.href}>
              <a href={v.href} aria-current={v.current}>
                {v.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function Sidebar({
  route,
  onLanguage,
}: {
  route: Route
  onLanguage: (next: Locale) => void
}) {
  const home = route.page === 'home'
  const language = currentLocale()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const bar = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  // A new address closes the phone menu.
  useEffect(() => setOpen(false), [route.hash])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // On the start page the sidebar waits until the first screen (name and role) is passed.
  const [atTop, setAtTop] = useState(home)
  useEffect(() => {
    if (!home) return setAtTop(false)
    const marker = document.createElement('div')
    marker.style.cssText =
      'position:absolute;top:70vh;left:0;width:1px;height:1px;pointer-events:none'
    document.body.append(marker)
    const observer = new IntersectionObserver(([entry]) =>
      setAtTop(entry.isIntersecting || entry.boundingClientRect.top > 0),
    )
    observer.observe(marker)
    return () => {
      observer.disconnect()
      marker.remove()
    }
  }, [home])

  // Sticky elements on the page (a product's slicer bar) sit under the phone bar; on a wide
  // screen the sidebar is beside the page and takes no height.
  useEffect(() => {
    const el = bar.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const root = document.documentElement
    const narrow = window.matchMedia('(max-width: 899px)')
    const update = () =>
      root.style.setProperty(
        '--header-h',
        narrow.matches && !atTop ? `${el.offsetHeight}px` : '0px',
      )
    const observer = new ResizeObserver(update)
    observer.observe(el)
    narrow.addEventListener('change', update)
    update()
    return () => {
      observer.disconnect()
      narrow.removeEventListener('change', update)
      root.style.removeProperty('--header-h')
    }
  }, [atTop])

  const change = (next: Locale) => {
    setLocale(next)
    onLanguage(next)
  }
  const languages = (
    <div
      className="side-lang"
      role="group"
      aria-label={language === 'sv' ? 'Välj språk' : 'Choose language'}
    >
      {(['sv', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={language === code}
          onClick={() => change(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
  const byId = (id: string) => PROJECTS.find((p) => p.id === id)
  const hidden = home && atTop
  return (
    <>
      <aside
        className={`side${hidden ? ' is-hidden' : ''}${open ? ' is-open' : ''}`}
        inert={hidden || undefined}
      >
        <div className="side-bar" ref={bar}>
          <a
            className="side-brand"
            href="#start"
            aria-label={l(
              'Anton Ernstsson, home',
              'Anton Ernstsson, startsida',
            )}
          >
            <span className="side-mono" aria-hidden="true">
              AE
            </span>
            <span className="side-who">
              <strong>Anton Ernstsson</strong>
              <small>Data &amp; AI Engineer</small>
            </span>
          </a>
          <button
            ref={button}
            type="button"
            className="side-menu-button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen(!open)}
          >
            {open ? l('Close', 'Stäng') : l('Menu', 'Meny')}
          </button>
        </div>
        <div
          className="side-panel"
          id={panelId}
          // A link closes the phone menu, also one to the page already open.
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) setOpen(false)
          }}
        >
          <nav className="side-nav" aria-label={l('Site', 'Webbplatsen')}>
            {SIDEBAR_GROUPS.map((group) => (
              <section key={group.id} aria-labelledby={`side-${group.id}`}>
                <h2 className="side-group" id={`side-${group.id}`}>
                  {b(group.label)}
                </h2>
                <ul>
                  {group.projects.map((id) => {
                    const project = byId(id)
                    return project ? (
                      <ProjectLink key={id} project={project} route={route} />
                    ) : null
                  })}
                </ul>
              </section>
            ))}
            <section aria-labelledby="side-platform">
              <h2 className="side-group" id="side-platform">
                {l('Platform', 'Plattform')}
              </h2>
              <ul>
                {PLATFORM_PAGES.map((p) => (
                  <li key={p.id}>
                    <a
                      href={p.href}
                      aria-current={
                        p.pages.includes(route.page) ? 'page' : undefined
                      }
                    >
                      {b(p.title)}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </nav>
          <div className="side-foot">
            <ul>
              {profile.cv && (
                <li>
                  <a href={profile.cv} download>
                    CV (PDF)
                  </a>
                </li>
              )}
              <li>
                <a
                  href="https://github.com/korv9"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </li>
              {profile.linkedin && (
                <li>
                  <a href={profile.linkedin} target="_blank" rel="noreferrer">
                    LinkedIn
                  </a>
                </li>
              )}
            </ul>
            {languages}
          </div>
        </div>
      </aside>
      {/* The language stays within reach on the start page's first screen. */}
      {hidden && <div className="side-lang-float">{languages}</div>}
    </>
  )
}
