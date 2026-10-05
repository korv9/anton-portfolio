/**
 * The start page, in the order a recruiter reads it: who (hero), then the selected projects on
 * the left, each over its own chart as a backdrop, beside the experience and education on the
 * right, so both are on the first screen; then the tech stack and about. Everything is on the
 * page; the eclipse radar is the tech stack's picture, not a door to it. Projects come from
 * projects/projectRegistry.ts.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { l } from '../i18n'
import { profile } from '../content'
import { ABOUT } from './content'
import { EDUCATION, EXPERIENCE, SKILLS, type Bilingual } from './orbitContent'
import './home.css'
import './eclipse.css'
import EclipseRadar from './EclipseRadar'
import { ProjectRow, Tag } from '../ui/Editorial'
import ClusterPreview from '../jobs/ClusterPreview'
import PoliticsPreview from './PoliticsPreview'
import { MethodPreview, SwedenPreview } from './ProjectPreviews'
import SymbolicPreview from '../symbolic/SymbolicPreview'
import { FLAGSHIPS } from '../projects/projectRegistry'

const b = (text: Bilingual) => l(text.en, text.sv)

/** The sections a global address points at; the header's links scroll to them. */
const SECTIONS = ['#projekt', '#erfarenhet', '#kompetenser', '#om-mig']

const PREVIEWS: Record<string, ReactNode> = {
  politics: <PoliticsPreview />,
  jobs: <ClusterPreview />,
  'symbolic-atlas': <SymbolicPreview />,
  welfare: <SwedenPreview />,
  thesis: <MethodPreview />,
}

function Hero() {
  return (
    <section
      className="home-hero ds-container"
      id="start"
      aria-labelledby="home-role"
    >
      <div className="home-hero-copy">
        <h2 id="home-role" className="home-hero-role">
          {l('Data engineer / developer', 'Data engineer / utvecklare')}
          {' · '}
          {l('Stockholm, Sweden', 'Stockholm, Sverige')}
        </h2>
        <p className="home-hero-lede">
          {l(
            'I build data products, pipelines and analytical tools.',
            'Jag bygger dataprodukter, pipelines och analysverktyg.',
          )}
        </p>
        <div className="home-intro-links">
          <div className="home-intro-contact">
            <a href="#projekt">{l('Projects', 'Projekt')} ↓</a>
            {profile.cv && (
              <a href={profile.cv} download>
                {l('Download CV (PDF)', 'Ladda ned CV (PDF)')} ↓
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
            {profile.email && (
              <a href={`mailto:${profile.email}`}>{l('Email', 'E-post')} ↗</a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function SelectedProjects() {
  return (
    <section
      className="home-projects"
      id="projekt"
      aria-labelledby="projects-title"
    >
      <h2 id="projects-title" className="home-first-title">
        {l('Selected projects', 'Utvalda projekt')}
      </h2>
      {FLAGSHIPS.map((project) => (
        <ProjectRow
          backgroundPreview
          key={project.id}
          id={project.id}
          number={project.number ?? ''}
          title={b(project.title)}
          href={project.href}
          preview={PREVIEWS[project.id] ?? null}
        >
          <p className="home-project-kind">{b(project.descriptor)}</p>
          <p className="home-project-description">{b(project.summary)}</p>
          <div className="home-tags">
            {project.tech.slice(0, 4).map((tech) => (
              <Tag key={tech}>{tech}</Tag>
            ))}
          </div>
        </ProjectRow>
      ))}
      <p>
        <a href="#alla-projekt">
          {l('All projects and other work', 'Alla projekt och övriga arbeten')}{' '}
          →
        </a>
      </p>
    </section>
  )
}

function Experience() {
  const [expanded, setExpanded] = useState<string[]>([])
  return (
    <section
      className="home-experience"
      id="erfarenhet"
      aria-labelledby="experience-title"
    >
      <h2 id="experience-title" className="home-first-title">
        {l('Experience', 'Erfarenhet')}
      </h2>
      <ol className="timeline">
        {EXPERIENCE.map((job) => (
          <li key={job.org} className="timeline-row">
            <button
              className="timeline-when experience-bar-button"
              type="button"
              aria-expanded={expanded.includes(job.org)}
              aria-controls={`experience-${job.org}`}
              onClick={() =>
                setExpanded((current) =>
                  current.includes(job.org)
                    ? current.filter((org) => org !== job.org)
                    : [...current, job.org],
                )
              }
            >
              <span className="timeline-period">{b(job.period)}</span>
              <span className="timeline-org">
                {job.org}
                <span className="experience-toggle" aria-hidden="true">
                  {expanded.includes(job.org) ? '−' : '+'}
                </span>
              </span>
              <span className="timeline-role">{b(job.role)}</span>
            </button>
            <div
              className="timeline-what"
              id={`experience-${job.org}`}
              hidden={!expanded.includes(job.org)}
            >
              <p>{b(job.effect)}</p>
              <ul className="timeline-did">
                {job.did.map((item) => (
                  <li key={item.sv}>{b(item)}</li>
                ))}
              </ul>
              <p className="home-tags">
                {job.tech.map((tech) => (
                  <Tag key={tech}>{tech}</Tag>
                ))}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="home-education">
        <h3 className="home-first-title">{l('Education', 'Utbildning')}</h3>
        <p>{b(EDUCATION)}</p>
      </div>
    </section>
  )
}

function TechStack() {
  return (
    <section
      className="ds-section ds-container home-tech"
      id="kompetenser"
      aria-labelledby="skills-title"
    >
      <h2 id="skills-title" className="ds-h2">
        Tech stack
      </h2>
      <div className="home-tech-grid">
        <div className="home-tech-radar">
          <EclipseRadar
            onChoose={() =>
              document
                .getElementById('skills-list')
                ?.scrollIntoView({ block: 'nearest' })
            }
          />
        </div>
        <div className="skills" id="skills-list">
          {SKILLS.map((group) => (
            <div key={group.group.sv} className="skills-group">
              <h3>{b(group.group)}</h3>
              <p className="skills-top">{group.top.join(' · ')}</p>
              <p className="skills-more ds-small">{group.more.join(' · ')}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function About() {
  return (
    <section
      className="ds-section ds-container home-about"
      id="om-mig"
      aria-labelledby="about-title"
    >
      <h2 id="about-title" className="ds-h2">
        {l('About', 'Om mig')}
      </h2>
      <div className="home-about-grid">
        <div>
          {ABOUT.map((text) => (
            <p key={text.sv}>{b(text)}</p>
          ))}
        </div>
        <div>
          <p className="ds-label">{l('Contact', 'Kontakt')}</p>
          <p className="home-about-links">
            {profile.email && (
              <a href={`mailto:${profile.email}`}>{profile.email}</a>
            )}
            {profile.linkedin && (
              <a href={profile.linkedin} target="_blank" rel="noreferrer">
                LinkedIn ↗
              </a>
            )}
            <a href="https://github.com/korv9" target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </p>
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
    <div className="home home-orbit">
      <Hero />
      <div className="home-first ds-container">
        <SelectedProjects />
        <Experience />
      </div>
      <TechStack />
      <About />
    </div>
  )
}
