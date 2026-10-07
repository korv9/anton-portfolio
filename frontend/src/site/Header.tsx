/**
 * The site frame: one header on every page, the project context on project pages, and the
 * footer. Global navigation is four destinations, Projects, Experience, About and CV; a
 * project's own views (the politics themes, the job-market themes, the atlas sections) live
 * inside the project, under this header, never in it.
 *
 * The header is the same on every page: the name large, the navigation under it. Project lists
 * come from projects/projectRegistry.ts.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { currentLocale, l, setLocale, type Locale } from '../i18n'
import { profile } from '../content'
import { CVS } from '../home/content'
import type { Route } from '../router'
import {
  FLAGSHIPS,
  neighbours,
  projectForRoute,
  type Bilingual,
  type ProjectEntry,
} from '../projects/projectRegistry'

const b = (text: Bilingual) => l(text.en, text.sv)

export type GlobalSection = 'projects' | 'experience' | 'about' | null

/** Which global destination the reader is in. Project sub-views never count as their own. */
export function activeSection(
  route: Pick<Route, 'page' | 'path'>,
): GlobalSection {
  if (route.page === 'home') {
    if (route.path === '#erfarenhet') return 'experience'
    if (route.path === '#om-mig') return 'about'
    if (route.path === '#projekt') return 'projects'
    return null
  }
  if (route.page === 'projects' || projectForRoute(route)) return 'projects'
  return null
}

/** A small disclosure menu: a button that opens a list below it. */
function Menu({
  label,
  current,
  children,
}: {
  label: string
  current: boolean
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open])
  // Leaving the menu with the keyboard closes it.
  const onBlur = (e: React.FocusEvent) => {
    if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false)
  }
  return (
    <div className="nav-menu" ref={root} onBlur={onBlur}>
      <button
        ref={button}
        type="button"
        className="nav-item"
        aria-expanded={open}
        aria-controls={id}
        aria-current={current ? 'page' : undefined}
        onClick={() => setOpen(!open)}
      >
        {label} <span aria-hidden="true">▾</span>
      </button>
      <div className="nav-panel" id={id} hidden={!open}>
        {children(() => setOpen(false))}
      </div>
    </div>
  )
}

function ProjectList({ onPick }: { onPick: () => void }) {
  return (
    <>
      <p className="nav-panel-label">
        {l('Selected projects', 'Utvalda projekt')}
      </p>
      <ol className="nav-projects">
        {FLAGSHIPS.map((p) => (
          <li key={p.id}>
            <a href={p.href} onClick={onPick}>
              <span className="nav-number">{p.number}</span>
              <span>
                <strong>{b(p.title)}</strong>
                <small>{b(p.descriptor)}</small>
              </span>
            </a>
          </li>
        ))}
      </ol>
      <a className="nav-all" href="#alla-projekt" onClick={onPick}>
        {l('View all projects', 'Se alla projekt')}
      </a>
      <a className="nav-all" href="#data-constellation" onClick={onPick}>
        {l(
          'Data Constellation: how the platform fits together',
          'Data Constellation: hur plattformen hänger ihop',
        )}
      </a>
    </>
  )
}

function CvList({ onPick }: { onPick: () => void }) {
  return (
    <ul className="nav-cvs">
      {CVS.map((cv) => (
        <li key={cv.file}>
          <a href={cv.file} download onClick={onPick}>
            <strong>{b(cv.role)}</strong>
            <small>{b(cv.focus)}</small>
          </a>
        </li>
      ))}
    </ul>
  )
}

export default function Header({
  route,
  onLanguage,
}: {
  route: Route
  onLanguage: (next: Locale) => void
}) {
  const home = route.page === 'home'
  const language = currentLocale()
  const active = activeSection(route)
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileId = useId()
  // A new address closes the phone menu.
  useEffect(() => setMobileOpen(false), [route.hash])
  const change = (next: Locale) => {
    setLocale(next)
    onLanguage(next)
  }
  const Name = home ? 'h1' : 'div'
  const close = () => setMobileOpen(false)
  // The header stays on screen. Once the page scrolls it folds to one slim row (the name and
  // the navigation side by side); it unfolds at the very top. The gap between the two
  // thresholds keeps it from flickering when its own change of height moves the page.
  const bar = useRef<HTMLElement>(null)
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const onScroll = () =>
      setCompact((was) => (was ? window.scrollY > 8 : window.scrollY > 120))
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // Sticky elements further down (a product's sidebar, anchored sections) sit under it.
  useEffect(() => {
    const el = bar.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const root = document.documentElement
    const observer = new ResizeObserver(() =>
      root.style.setProperty('--header-h', `${el.offsetHeight}px`),
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--header-h')
    }
  }, [])
  return (
    <header ref={bar} className={`site-bar${compact ? ' is-compact' : ''}`}>
      <Name className="site-name-heading">
        <a
          className="wordmark"
          href="#start"
          aria-label={l('Anton Ernstsson, home', 'Anton Ernstsson, startsida')}
        >
          <span className="wordmark-name">ANTON ERNSTSSON</span>
        </a>
      </Name>
      <nav className="global-nav" aria-label={l('Site', 'Webbplatsen')}>
        <Menu label={l('Projects', 'Projekt')} current={active === 'projects'}>
          {(closeMenu) => <ProjectList onPick={closeMenu} />}
        </Menu>
        <a
          className="nav-item"
          href="#erfarenhet"
          aria-current={active === 'experience' ? 'page' : undefined}
        >
          {l('Experience', 'Erfarenhet')}
        </a>
        <a
          className="nav-item"
          href="#om-mig"
          aria-current={active === 'about' ? 'page' : undefined}
        >
          {l('About', 'Om mig')}
        </a>
        <Menu label="CV" current={false}>
          {(closeMenu) => <CvList onPick={closeMenu} />}
        </Menu>
      </nav>
      <div
        className="language-switch"
        role="group"
        aria-label={language === 'sv' ? 'Välj språk' : 'Choose language'}
      >
        <button
          type="button"
          lang="sv"
          aria-pressed={language === 'sv'}
          onClick={() => change('sv')}
        >
          SV
        </button>
        <button
          type="button"
          lang="en"
          aria-pressed={language === 'en'}
          onClick={() => change('en')}
        >
          EN
        </button>
      </div>
      <button
        type="button"
        className="site-menu-button"
        aria-expanded={mobileOpen}
        aria-controls={mobileId}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? l('Close', 'Stäng') : l('Menu', 'Meny')}
      </button>
      <nav
        className="mobile-nav"
        id={mobileId}
        hidden={!mobileOpen}
        aria-label={l('Site', 'Webbplatsen')}
      >
        <ProjectList onPick={close} />
        <a className="mobile-nav-item" href="#erfarenhet" onClick={close}>
          {l('Experience', 'Erfarenhet')}
        </a>
        <a className="mobile-nav-item" href="#om-mig" onClick={close}>
          {l('About', 'Om mig')}
        </a>
        <p className="nav-panel-label">CV</p>
        <CvList onPick={close} />
      </nav>
    </header>
  )
}

/**
 * Where a project page sits: "Projects / <project>", from the registry. Supporting technical
 * pages (architecture, data model, ER diagram, pipeline status, design) say so instead.
 */
const TECHNICAL: Partial<Record<Route['page'], Bilingual>> = {
  technical: { en: 'Architecture', sv: 'Arkitektur' },
  constellation: { en: 'Data Constellation', sv: 'Data Constellation' },
  catalogue: { en: 'Data catalogue', sv: 'Datakatalog' },
  lineage: { en: 'Idea Lineage', sv: 'Idea Lineage' },
  design: { en: 'Design system', sv: 'Designsystem' },
  datamodel: { en: 'Data model', sv: 'Datamodell' },
  er: { en: 'ER diagram', sv: 'ER-diagram' },
  status: { en: 'Pipeline status', sv: 'Pipelinestatus' },
  quality: { en: 'Quality and validity', sv: 'Kvalitet och validitet' },
}

/** The page's own name for the document title, or null on the homepage. */
export function pageTitle(route: Route): string | null {
  if (route.page === 'home') return null
  if (route.page === 'projects') return l('Projects', 'Projekt')
  const project = projectForRoute(route)
  if (project) return b(project.title)
  const technical = TECHNICAL[route.page]
  return technical ? b(technical) : l('Technical', 'Teknik')
}

export function ProjectContext({ route }: { route: Route }) {
  const project = projectForRoute(route)
  const technical = TECHNICAL[route.page]
  if (route.page === 'home') return null
  return (
    <nav
      className="project-context ds-container"
      aria-label={l('Breadcrumb', 'Brödsmulor')}
    >
      <ol>
        <li>
          {route.page === 'projects' ? (
            <span aria-current="page">{l('Projects', 'Projekt')}</span>
          ) : (
            <a href="#alla-projekt">{l('Projects', 'Projekt')}</a>
          )}
        </li>
        {project && (
          <li>
            {route.path === project.href ? (
              <span aria-current="page">{b(project.title)}</span>
            ) : (
              <a href={project.href}>{b(project.title)}</a>
            )}
          </li>
        )}
        {!project && technical && (
          <>
            <li>
              <a href="#technical">{l('Technical', 'Teknik')}</a>
            </li>
            {route.page !== 'technical' && (
              <li>
                <span aria-current="page">{b(technical)}</span>
              </li>
            )}
          </>
        )}
      </ol>
    </nav>
  )
}

/** Previous and next flagship project, at the bottom of a flagship's page. */
export function ProjectPager({ route }: { route: Route }) {
  const project = projectForRoute(route)
  if (!project?.featured) return null
  const { previous, next } = neighbours(project.id)
  const link = (p: ProjectEntry | undefined, dir: 'previous' | 'next') =>
    p ? (
      <a
        className={`pager-${dir}`}
        href={p.href}
        rel={dir === 'previous' ? 'prev' : 'next'}
      >
        <small>
          {dir === 'previous'
            ? l('Previous project', 'Föregående projekt')
            : l('Next project', 'Nästa projekt')}
        </small>
        <span>{b(p.title)}</span>
      </a>
    ) : (
      <span />
    )
  return (
    <nav
      className="project-pager ds-container"
      aria-label={l('More projects', 'Fler projekt')}
    >
      {link(previous, 'previous')}
      {link(next, 'next')}
    </nav>
  )
}

export function Footer() {
  return (
    <footer className="site-foot">
      <div className="ds-container site-foot-inner">
        <div>
          <p className="foot-label">{l('Projects', 'Projekt')}</p>
          <ul>
            {FLAGSHIPS.map((p) => (
              <li key={p.id}>
                <a href={p.href}>{b(p.title)}</a>
              </li>
            ))}
            <li>
              <a href="#alla-projekt">{l('All projects', 'Alla projekt')}</a>
            </li>
          </ul>
        </div>
        <div>
          <p className="foot-label">{l('Profile', 'Profil')}</p>
          <ul>
            <li>
              <a href="#erfarenhet">{l('Experience', 'Erfarenhet')}</a>
            </li>
            <li>
              <a href="#om-mig">{l('About', 'Om mig')}</a>
            </li>
            {profile.cv && (
              <li>
                <a href={profile.cv} download>
                  CV (PDF)
                </a>
              </li>
            )}
            {profile.linkedin && (
              <li>
                <a href={profile.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn
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
          </ul>
        </div>
        <div>
          <p className="foot-label">{l('Under the hood', 'Under huven')}</p>
          <ul>
            <li>
              <a href="#data-constellation">Data Constellation</a>
            </li>
            <li>
              <a href="#data-catalogue">{l('Data catalogue', 'Datakatalog')}</a>
            </li>
            <li>
              <a href="#idea-lineage">Idea Lineage</a>
            </li>
            <li>
              <a href="#quality">
                {l('Quality & validity', 'Kvalitet och validitet')}
              </a>
            </li>
            <li>
              <a href="#technical">{l('Architecture', 'Arkitektur')}</a>
            </li>
            <li>
              <a href="#data-model">{l('Data model', 'Datamodell')}</a>
            </li>
            <li>
              <a href="#er">{l('ER diagram', 'ER-diagram')}</a>
            </li>
          </ul>
        </div>
        <p className="foot-name">
          Anton Ernstsson
          <br />
          {l('Stockholm, Sweden', 'Stockholm, Sverige')}
        </p>
      </div>
    </footer>
  )
}
