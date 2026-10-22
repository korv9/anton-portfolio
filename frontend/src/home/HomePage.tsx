/** Homepage: About, work history and selected projects on GitHub. */
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
import './home.css'
import { useSlowScroll } from './useSlowScroll'
import ClusterPreview from './ClusterPreview'

const b = (text: Bilingual) => text.en

/** Selected repositories, the platform first. Each card leads to its code on GitHub. */
const REPOS: {
  name: string
  title: string
  summary: string
  tech: string[]
}[] = [
  {
    name: 'anton-portfolio',
    title: 'Data platform behind this site',
    summary:
      'Collects Swedish and EU public data every day and models it in dbt. The platform pages are offline for now; the code is public.',
    tech: ['Python', 'dbt', 'DuckDB', 'React', 'Cloudflare'],
  },
  {
    name: 'DrugComb-Synergy-Prediction',
    title: 'DrugComb synergy prediction',
    summary:
      'Joins two public drug-research datasets in DuckDB and tests how well a LightGBM model predicts drug-combination synergy under four evaluation splits.',
    tech: ['Python', 'DuckDB', 'SQL', 'LightGBM'],
  },
  {
    name: 'swedish-job-market-analytics',
    title: 'Swedish job market analytics',
    summary:
      'A dbt pipeline that turns four years of Arbetsförmedlingen job ads into role, skill and region trends.',
    tech: ['dbt', 'DuckDB', 'Python', 'Power BI'],
  },
  {
    name: 'diva-fabric-lakehouse',
    title: 'DiVA Fabric lakehouse',
    summary:
      'An incremental Microsoft Fabric lakehouse for DiVA thesis metadata, with quarantine and quality gates. Re-runs add no duplicates.',
    tech: ['PySpark', 'Delta Lake', 'Fabric', 'pytest'],
  },
]

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
              <h3 className="home-job-org">{b(THESIS.title)}</h3>
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
        <div className="home-job home-job-additional">
          <h3 className="home-label">Additional education</h3>
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

function Work() {
  return (
    <section className="home-screen home-work" aria-labelledby="projects-title">
      <span className="home-project-marker" aria-hidden="true" />
      <div className="home-work-heading">
        <h2 id="projects-title" className="home-work-title">
          Projects
        </h2>
        <div className="home-project-intro">
          <p className="home-about-text">
            My largest ongoing project is the data platform behind this site:
            automated pipelines, dbt models and the applications on top. I build
            the full flow, from collecting and processing data to presenting it.
          </p>
          <p className="home-about-text">
            The platform’s own pages are offline while I refine them. The code
            for it and for the projects below is on GitHub.
          </p>
        </div>
      </div>
      <ClusterPreview kind="jobs" background />
      <div className="home-project-groups">
        <section aria-label="Project list">
          <ul className="work-row">
            {REPOS.map((repo) => (
              <li key={repo.name}>
                <a
                  className="work-card"
                  href={`https://github.com/korv9/${repo.name}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <h3 className="work-title">{repo.title}</h3>
                  <p className="work-question">{repo.summary}</p>
                  <p className="work-tech">{repo.tech.join(' · ')}</p>
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
        <a
          className="home-cta-link"
          href="https://github.com/korv9"
          target="_blank"
          rel="noreferrer"
        >
          More on GitHub <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </div>
  )
}
