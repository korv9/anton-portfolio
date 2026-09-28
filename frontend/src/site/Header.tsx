import { useEffect, useState } from 'react'
import { currentLocale, l, setLocale, type Locale } from '../i18n'
import { profile } from '../content'

const LINKS: [string, string, string][] = [
  ['#om-mig', 'About', 'Om mig'],
  ['#projekt', 'Projects', 'Projekt'],
  ['#politik', 'Politics', 'Politik'],
  ['#kontakt', 'Contact', 'Kontakt'],
]

export default function Header({
  path,
  inPolitics,
  onLanguage,
}: {
  path: string
  inPolitics: boolean
  onLanguage: (next: Locale) => void
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [path])
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
        className="site-menu-button"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen(!open)}
      >
        {open ? l('Close', 'Stäng') : l('Menu', 'Meny')}
      </button>
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
                  href === '#politik' && inPolitics ? 'true' : undefined
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
