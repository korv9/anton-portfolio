/**
 * The start page, about Anton for a recruiter: the name alone on the first screen, then contact,
 * About, experience and education, and one way on to the projects (#projekt).
 */
import { useEffect } from 'react'
import { profile } from '../content'
import { ABOUT, CONTACT } from './content'
import { l, currentLocale } from '../i18n'
import { CvButton } from '../site/CvViewer'
import {
  ADDITIONAL,
  ADDITIONAL_EDUCATION,
  EDUCATION,
  EXPERIENCE,
  THESIS,
  type Bilingual,
} from './orbitContent'
import { PROJECTS } from '../projects/projectRegistry'
import LanguageToggle from '../site/LanguageToggle'
import './home.css'

const b = (text: Bilingual) => l(text.en, text.sv)

/** The sections a global address points at; the header's links scroll to them. */
const SECTIONS = ['#kontakt', '#om-mig', '#erfarenhet', '#utbildning']

function Identity() {
  return (
    <section
      className="home-screen home-identity"
      id="start"
      aria-labelledby="home-name"
    >
      <h1 id="home-name" className="home-name">
        Anton Ernstsson
      </h1>
    </section>
  )
}

/** The contact line the reader reaches on the first scroll. */
function Contact() {
  return (
    <section
      className="home-screen home-contact"
      id="kontakt"
      aria-label={l('Contact', 'Kontakt')}
    >
      <p className="home-contact-intro">{l(CONTACT.en, CONTACT.sv)}</p>
      {profile.email && (
        <p className="home-contact-email">
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </p>
      )}
      <nav
        className="home-links"
        aria-label={l('CV and profiles', 'CV och profiler')}
      >
        {profile.linkedin && (
          <a href={profile.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        )}
        <a href="https://github.com/korv9" target="_blank" rel="noreferrer">
          GitHub
        </a>
        {profile.cv && <CvButton />}
        <LanguageToggle />
      </nav>
    </section>
  )
}

/** About above the work history, with space between experience and education. */
function Profile() {
  const thesis = PROJECTS.find((p) => p.id === 'thesis')
  return (
    <section
      className="home-screen home-profile"
      aria-label={l('Profile', 'Profil')}
    >
      <div
        className="home-column home-about"
        id="om-mig"
        lang={currentLocale()}
      >
        <h2 className="home-title">{l('About', 'Om mig')}</h2>
        {ABOUT.map((text) => (
          <p key={text.sv} className="home-about-text">
            {l(text.en, text.sv)}
          </p>
        ))}
      </div>
      <div className="home-column home-experience" id="erfarenhet">
        <h2 className="home-title">{l('Experience', 'Erfarenhet')}</h2>
        <ol className="home-jobs">
          {EXPERIENCE.map((job) => (
            <li key={job.org} className="home-job">
              <div className="home-job-head">
                <h3 className="home-job-org">
                  {job.role} | {job.org}
                </h3>
                <p className="home-job-period">{b(job.period)}</p>
              </div>
              <p className="home-job-role">{b(job.kind)}</p>
              <p className="home-job-role">{b(job.did)}</p>
              <p className="home-job-tech">{job.tech.join(' | ')}</p>
            </li>
          ))}
        </ol>
        <div className="home-job home-job-additional">
          <h3 className="home-label">
            {l('Additional experience', 'Övrig erfarenhet')}
          </h3>
          <div className="home-job-head">
            <p className="home-job-org-small">
              {b(ADDITIONAL.role)} | {ADDITIONAL.org}
            </p>
            <p className="home-job-period">{ADDITIONAL.period}</p>
          </div>
          <p className="home-job-role">{b(ADDITIONAL.text)}</p>
        </div>
      </div>
      <div className="home-column home-education" id="utbildning">
        <h2 className="home-title">{l('Education', 'Utbildning')}</h2>
        {EDUCATION.map((e) => (
          <div key={e.school} className="home-job">
            <div className="home-job-head">
              <h3 className="home-job-org">
                {b(e.title)} | {e.school}
              </h3>
              <p className="home-job-period">{e.period}</p>
            </div>
            <p className="home-job-role">{b(e.note)}</p>
          </div>
        ))}
        {thesis && (
          <div className="home-job">
            <div className="home-job-head">
              <h3 className="home-job-org">{b(THESIS.title)}</h3>
            </div>
            <p className="home-job-role">{b(THESIS.kind)}</p>
            <p className="home-job-role">{THESIS.points.map(b).join(' ')}</p>
            <p className="home-job-role">
              {l('Tech', 'Teknik')}: {THESIS.tech.join(', ')}
            </p>
          </div>
        )}
        <div className="home-job home-job-additional">
          <h3 className="home-label">
            {l('Additional education', 'Övrig utbildning')}
          </h3>
          <div className="home-job-head">
            <p className="home-job-org-small">
              {b(ADDITIONAL_EDUCATION.title)} | {ADDITIONAL_EDUCATION.school}
            </p>
            <p className="home-job-period">{ADDITIONAL_EDUCATION.period}</p>
          </div>
          <p className="home-job-role">{b(ADDITIONAL_EDUCATION.text)}</p>
        </div>
      </div>
    </section>
  )
}

export default function HomePage({ path }: { path: string }) {
  // A section address (from the header, the footer or a shared link) scrolls to its section.
  useEffect(() => {
    if (!SECTIONS.includes(path)) return
    const frame = requestAnimationFrame(() =>
      document
        .getElementById(path.slice(1))
        ?.scrollIntoView({ block: 'start' }),
    )
    return () => cancelAnimationFrame(frame)
  }, [path])
  return (
    <div className="home" lang={currentLocale()}>
      <Identity />
      <Contact />
      <Profile />
      <footer className="home-cta">
        <a className="home-cta-link" href="#projekt">
          {l('Projects', 'Projekt')} <span aria-hidden="true">→</span>
        </a>
      </footer>
    </div>
  )
}
