import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { currentLocale, l, setLocale, type Locale } from '../i18n'
import { profile } from '../content'

// The contents menu loads the first time it is opened.
const SiteMap = lazy(() => import('./SiteMap'))

const LINKS: [string, string, string][] = [
  ['#projekt', 'Projects', 'Projekt'],
  ['#politik', 'Political Observatory', 'Political Observatory'],
  ['#jobb', 'Job market', 'Jobbmarknad'],
  ['#tallman', 'taLLMan', 'taLLMan'],
  ['#technical', 'Technical', 'Technical'],
]

export default function Header({
  path,
  inPolitics,
  inJobs = false,
  inTallman = false,
  onLanguage,
}: {
  path: string
  inPolitics: boolean
  inJobs?: boolean
  inTallman?: boolean
  onLanguage: (next: Locale) => void
}) {
  const [open, setOpen] = useState(false)
  const [contents, setContents] = useState(false)
  useEffect(() => {
    setOpen(false)
    setContents(false)
  }, [path])
  const closeContents = useCallback(() => setContents(false), [])
  const language = currentLocale()
  const change = (next: Locale) => {
    setLocale(next)
    onLanguage(next)
  }
  return (
    <header className="site-bar">
      <a
        className="wordmark"
        href="#start"
        aria-label={l('Anton Ernstsson, home', 'Anton Ernstsson, startsida')}
      >
        <span className="wordmark-name">Anton Ernstsson</span>
      </a>
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
        className="site-contents-button"
        aria-expanded={contents}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(false)
          setContents(true)
        }}
      >
        <span className="site-contents-icon" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {l('Contents', 'Innehåll')}
      </button>
      {contents && (
        <Suspense fallback={null}>
          <SiteMap onClose={closeContents} />
        </Suspense>
      )}
      <nav
        id="site-nav"
        className={open ? 'site-nav open' : 'site-nav'}
        aria-label={l('Main navigation', 'Huvudnavigering')}
      >
        <ul>
          {LINKS.map(([href, en, sv]) => (
            <li key={href}>
              <a
                href={href}
                aria-current={
                  href === path ||
                  (href === '#politik' && inPolitics) ||
                  (href === '#jobb' && inJobs) ||
                  (href === '#tallman' && inTallman)
                    ? 'true'
                    : undefined
                }
                onClick={() => setOpen(false)}
              >
                {l(en, sv)}
              </a>
            </li>
          ))}
          {profile.cv && (
            <li>
              <a href={profile.cv} download className="site-cv">
                CV
              </a>
            </li>
          )}
        </ul>
      </nav>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="site-foot">
      <div className="ds-container site-foot-inner">
        <span>Anton Ernstsson · Stockholm</span>
        <span>
          <a href="#projekt">{l('All projects', 'Alla projekt')}</a>
          {' · '}
          <a href="#politik-kallor">
            {l('Sources and method', 'Källor och metod')}
          </a>
          {' · '}
          <a
            href="https://github.com/korv9/anton-portfolio"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </span>
      </div>
    </footer>
  )
}

/** The slim bar above a single project page: back to the projects. */
export function ProjectBar({
  back = '#projekt',
  label,
}: {
  back?: string
  label?: string
}) {
  return (
    <div className="project-bar ds-container">
      <a href={back}>← {label ?? l('All projects', 'Alla projekt')}</a>
    </div>
  )
}
