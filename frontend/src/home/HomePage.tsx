/** Homepage: About, work history, the platform, selected projects and experiments. */
import { useEffect } from 'react'
import { profile } from '../content'
import { ABOUT, CONTACT } from './content'
import { l, currentLocale } from '../i18n'
import { CvButton } from '../site/CvViewer'
import {
  ADDITIONAL,
  EDUCATION,
  EXPERIENCE,
  THESIS,
  type Bilingual,
} from './orbitContent'
import { LISTED_PROJECTS, PROJECTS } from '../projects/projectRegistry'
import './home.css'
import { useSlowScroll } from './useSlowScroll'
import ClusterPreview from './ClusterPreview'

const b = (text: Bilingual) => text.en

/** The sections a global address points at; the header's links scroll to them. */
const SECTIONS = ['#erfarenhet', '#om-mig', '#utbildning']

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
      <p className="home-roles">
        <span>SOFTWARE</span> <span>DATA</span> <span>AI</span>
      </p>
    </section>
  )
}

/** About above the work history, with space between experience and education. */
function Profile() {
  const thesis = PROJECTS.find((p) => p.id === 'thesis')
  return (
    <section className="home-screen home-profile" aria-label="Profile">
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
        <div className="home-contact">
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
            {profile.cv && <CvButton />}
            {profile.linkedin && (
              <a href={profile.linkedin} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            )}
            <a href="https://github.com/korv9" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </div>
      <div className="home-column home-experience" id="erfarenhet">
        <h2 className="home-title">Experience</h2>
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
              <ul className="home-job-did">
                {job.did.map((item) => (
                  <li key={item.sv}>{b(item)}</li>
                ))}
              </ul>
              <p className="home-job-tech">{job.tech.join(' | ')}</p>
            </li>
          ))}
        </ol>
        <div className="home-job home-job-additional">
          <h3 className="home-label">Additional experience</h3>
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
        <h2 className="home-title">Education</h2>
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
              <h3 className="home-job-org">
                <a href={thesis.href}>{b(THESIS.title)}</a>
              </h3>
            </div>
            <p className="home-job-role">{b(THESIS.kind)}</p>
            <ul className="home-job-did">
              {THESIS.points.map((item) => (
                <li key={item.sv}>{b(item)}</li>
              ))}
            </ul>
            <p className="home-job-role">Tech: {THESIS.tech.join(', ')}</p>
          </div>
        )}
      </div>
    </section>
  )
}

function Work() {
  return (
    <section className="home-screen home-work" aria-labelledby="projects-title">
      <span className="home-project-marker" aria-hidden="true" />
      <div className="home-work-heading">
        <h2 id="projects-title" className="home-work-title">
          <a href="#projekt">Projects</a>
        </h2>
        <div className="home-project-intro">
          <p className="home-about-text">
            This website is my largest ongoing project: a data platform that
            brings together automated pipelines, analytics and interactive
            applications. I build the full flow, from collecting and processing
            data to presenting it here.
          </p>
          <p className="home-about-text">
            Several demos are still prototypes, and I’m continuing to improve
            their design, navigation and presentation.
          </p>
          <p className="home-about-text">
            Most of my latest projects are part of this data platform. Explore
            the pipelines and application code on{' '}
            <a href="https://github.com/korv9/anton-portfolio">GitHub</a>.
          </p>
        </div>
      </div>
      <ClusterPreview kind="jobs" background />
      <div className="home-project-groups">
        <section aria-label="Project list">
          <ul className="work-row">
            {LISTED_PROJECTS.map((project) => (
              <li key={project.id}>
                <a className="work-card" href={project.href}>
                  <h3 className="work-title">{b(project.title)}</h3>
                  <p className="work-question">{b(project.summary)}</p>
                  <p className="work-tech">
                    {project.tech.slice(0, 4).join(' · ')}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  )
}

export default function HomePage({ path }: { path: string }) {
  useSlowScroll()
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
    <div className="home" lang="en">
      <Identity />
      <Profile />
      <Work />
      <footer className="home-cta">
        <a className="home-cta-link" href="#projekt">
          Explore projects <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </div>
  )
}
