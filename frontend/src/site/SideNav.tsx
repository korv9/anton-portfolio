/**
 * The site sidebar: every part of the site in one column, on every page of a wide screen. The
 * part being read is open; in the politics and job-market products it holds their own
 * navigation (docked here, see dock.ts). On a narrow screen the header's contents menu does the
 * same job.
 */
import { l } from '../i18n'
import { profile } from '../content'
import { PROJECTS } from '../home/content'
import type { Page, Route } from '../router'

type Link = { href: string; en: string; sv: string }
type Section = {
  key: string
  en: string
  sv: string
  href: string
  /** Pages that belong to this part: it opens when one of them is read. */
  pages: Page[]
  items?: Link[]
  /** The product's own navigation is docked here instead of a list. */
  dock?: boolean
}

const project = (id: string): Link => {
  const p = PROJECTS.find((x) => x.id === id)!
  return { href: p.href, en: p.title.en, sv: p.title.sv }
}

function sections(): Section[] {
  return [
    {
      key: 'me',
      en: 'About me',
      sv: 'Om mig',
      href: '#start',
      pages: ['home'],
      items: [
        { href: '#start', en: 'Start', sv: 'Start' },
        { href: '#erfarenhet', en: 'Experience', sv: 'Erfarenhet' },
        { href: '#teknik', en: 'Tech stack', sv: 'Tech stack' },
      ],
    },
    {
      key: 'projects',
      en: 'All projects',
      sv: 'Alla projekt',
      href: '#projekt',
      pages: ['projects'],
    },
    {
      key: 'technical',
      en: 'Technical',
      sv: 'Technical',
      href: '#technical',
      pages: ['technical', 'design', 'datamodel', 'status'],
      items: [
        { href: '#technical', en: 'Architecture', sv: 'Arkitektur' },
        { href: '#design', en: 'Design system', sv: 'Designsystem' },
        { href: '#data-model', en: 'Data model', sv: 'Datamodell' },
        { href: '#status', en: 'Pipeline status', sv: 'Pipelinestatus' },
      ],
    },
    {
      key: 'politik',
      en: 'Political Observatory',
      sv: 'Political Observatory',
      href: '#politik',
      pages: ['politik'],
      dock: true,
    },
    {
      key: 'jobs',
      en: 'The job market in numbers',
      sv: 'Jobbmarknaden i siffror',
      href: '#jobb',
      pages: ['jobs'],
      dock: true,
    },
    {
      key: 'ai',
      en: 'AI and machine learning',
      sv: 'AI och maskininlärning',
      href: '#tallman',
      pages: ['tallman', 'thesis', 'drugcomb'],
      items: [project('tallman'), project('thesis'), project('drugcomb')],
    },
    {
      key: 'data',
      en: 'How is Sweden doing?',
      sv: 'Hur mår Sverige?',
      href: '#sweden',
      pages: ['welfare', 'analysis'],
      items: [
        { href: '#sweden', en: 'Overview', sv: 'Översikt' },
        { href: '#sweden-counties', en: 'Compare counties', sv: 'Jämför län' },
        {
          href: '#sweden-explorer',
          en: 'Explore indicators',
          sv: 'Utforska indikatorer',
        },
        { href: '#analysis-counties', en: 'Analysis', sv: 'Analys' },
      ],
    },
    {
      key: 'more',
      en: 'More projects',
      sv: 'Fler projekt',
      href: '#homie',
      pages: ['homie'],
      items: [project('homie')],
    },
  ]
}

export default function SideNav({
  route,
  onDock,
}: {
  route: Route
  onDock: (el: HTMLElement | null) => void
}) {
  return (
    <aside className="site-side" aria-label={l('Site', 'Webbplatsen')}>
      <nav aria-label={l('All pages', 'Alla sidor')}>
        <ul className="site-side-list">
          {sections().map((s) => {
            const open = s.pages.includes(route.page)
            return (
              <li
                key={s.key}
                className={`site-side-section${open ? ' open' : ''}`}
              >
                <a
                  className="site-side-head"
                  href={s.href}
                  aria-current={
                    open && !s.items && !s.dock ? 'page' : undefined
                  }
                >
                  {l(s.en, s.sv)}
                </a>
                {open && s.dock && (
                  <div className="site-side-dock" ref={onDock} />
                )}
                {open && s.items && (
                  <ul>
                    {s.items.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          aria-current={
                            item.href === route.path ? 'page' : undefined
                          }
                        >
                          {l(item.en, item.sv)}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
      <p className="site-side-contact">
        {profile.cv && (
          <a href={profile.cv} download>
            CV ↓
          </a>
        )}
        <a href="https://github.com/korv9" target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
        {profile.linkedin && (
          <a href={profile.linkedin} target="_blank" rel="noreferrer">
            LinkedIn ↗
          </a>
        )}
      </p>
    </aside>
  )
}
