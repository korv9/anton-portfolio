import { currentLocale, l, setLocale, type Locale } from '../i18n'

export default function Header({
  home,
  onLanguage,
}: {
  home: boolean
  onLanguage: (next: Locale) => void
}) {
  const language = currentLocale()
  const change = (next: Locale) => {
    setLocale(next)
    onLanguage(next)
  }
  return (
    <header className="site-bar">
      {home ? (
        <h1 className="site-name-heading">
          <a
            className="wordmark"
            href="#start"
            aria-label={l(
              'Anton Ernstsson, home',
              'Anton Ernstsson, startsida',
            )}
          >
            <span className="wordmark-name">ANTON ERNSTSSON</span>
          </a>
        </h1>
      ) : (
        <div className="site-name-heading">
          <a
            className="wordmark"
            href="#start"
            aria-label={l(
              'Anton Ernstsson, home',
              'Anton Ernstsson, startsida',
            )}
          >
            <span className="wordmark-name">ANTON ERNSTSSON</span>
          </a>
        </div>
      )}
      <span className="site-location">
        <i aria-hidden="true" /> {l('Stockholm, Sweden', 'Stockholm, Sverige')}
      </span>
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
