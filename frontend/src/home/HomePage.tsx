/**
 * The start page, about Anton for a recruiter: the signature, name, role and links on the first
 * screen, then About with the contact links, selected work, experience above education, and the
 * way on to the projects (#projects) beside the job-ads map.
 */
import { useEffect, useRef } from 'react'
import { profile } from '../content'
import { ABOUT, SELECTED } from './content'
import { l, currentLocale } from '../i18n'
import { CvButton } from '../site/CvViewer'
import { scrollToElement } from '../ui/scrollTo'
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
import JobsMap from './JobsMap'
import Signature from './Signature'
import './home.css'

const b = (text: Bilingual) => l(text.en, text.sv)

/** The sections a global address points at; the header's links scroll to them. */
const SECTIONS = ['#kontakt', '#om-mig', '#erfarenhet', '#utbildning']
const GITHUB = 'https://github.com/korv9'

function Identity() {
  return (
    <section
      className="home-screen home-identity"
      id="start"
      aria-labelledby="home-name"
    >
      <div className="home-mark">
        <Signature />
        <div className="home-byline">
          <h1 id="home-name" className="home-name">
            Anton Ernstsson
          </h1>
          <p className="home-role">
            {l(
              'Junior Software Developer · Data & AI',
              'Junior mjukvaruutvecklare · Data & AI',
            )}
          </p>
          <nav
            className="home-links"
            aria-label={l(
              'Projects, CV and profiles',
              'Projekt, CV och profiler',
            )}
          >
            <a href="#projects">{l('Projects', 'Projekt')}</a>
            {profile.cv && <CvButton />}
            <a href={GITHUB} target="_blank" rel="noreferrer">
              GitHub
            </a>
            {profile.linkedin && (
              <a href={profile.linkedin} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            )}
          </nav>
        </div>
      </div>
    </section>
  )
}

/** The email and profiles, directly under the About paragraphs. */
function Contact() {
  return (
    <div className="home-contact" id="kontakt">
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
        <a href={GITHUB} target="_blank" rel="noreferrer">
          GitHub
        </a>
        {profile.cv && <CvButton />}
        <LanguageToggle />
      </nav>
    </div>
  )
}

/** About, then experience above education in one column. */
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
        <Contact />
      </div>
      <div className="home-column home-selected">
        <h2 className="home-title">{l('Selected work', 'Utvalda projekt')}</h2>
        {SELECTED.map((work) => (
          <div key={work.href} className="home-job">
            <h3 className="home-job-org">
              <a href={work.href}>{work.title}</a>
            </h3>
            <p className="home-job-text">{b(work.line)}</p>
          </div>
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
              <div className="home-job-parts">
                {job.parts.map((part) => (
                  <div key={part.heading.en}>
                    <h4 className="home-job-part">{b(part.heading)}</h4>
                    <p className="home-job-text">{b(part.text)}</p>
                  </div>
                ))}
              </div>
              <p className="home-job-tech">{job.tech.join(' | ')}</p>
            </li>
          ))}
        </ol>
        <div className="home-job home-job-additional">
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
            <p className="home-job-text">{b(e.note)}</p>
          </div>
        ))}
        <div className="home-job">
          <div className="home-job-head">
            <h3 className="home-job-org">
              {b(ADDITIONAL_EDUCATION.title)} | {ADDITIONAL_EDUCATION.school}
            </h3>
            <p className="home-job-period">{ADDITIONAL_EDUCATION.period}</p>
          </div>
          <p className="home-job-text">{b(ADDITIONAL_EDUCATION.text)}</p>
        </div>
        {thesis && (
          <div className="home-job">
            <div className="home-job-head">
              <h3 className="home-job-org">{b(THESIS.title)}</h3>
            </div>
            <p className="home-job-role">{b(THESIS.kind)}</p>
            <div className="home-job-parts">
              {THESIS.parts.map((part) => (
                <div key={part.heading.en}>
                  <h4 className="home-job-part">{b(part.heading)}</h4>
                  <p className="home-job-text">{b(part.text)}</p>
                </div>
              ))}
            </div>
            <p className="home-job-role">
              {l('Tech', 'Teknik')}: {THESIS.tech.join(', ')}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

export default function HomePage({ path }: { path: string }) {
  // A section address (from the header, the footer or a shared link) scrolls to its section:
  // a glide within the page, a jump when the page opens on it.
  const last = useRef<string | null>(null)
  useEffect(() => {
    const glide = last.current !== null && last.current !== path
    last.current = path
    if (!SECTIONS.includes(path)) return
    const frame = requestAnimationFrame(() =>
      scrollToElement(document.getElementById(path.slice(1)), { glide }),
    )
    return () => cancelAnimationFrame(frame)
  }, [path])
  return (
    <div className="home" lang={currentLocale()}>
      <Identity />
      <Profile />
      <footer className="home-cta">
        <a className="home-cta-link" href="#projects">
          {l('Projects', 'Projekt')} <span aria-hidden="true">→</span>
        </a>
        <JobsMap />
      </footer>
    </div>
  )
}
