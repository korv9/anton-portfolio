/**
 * The start page, in reading order: a short presentation, about me, experience, skills,
 * selected projects and contact. Large sections, thin rules, one grid.
 */
import { useState } from 'react'
import { l } from '../i18n'
import { profile } from '../content'
import {
  EDUCATION,
  EXPERIENCE,
  FEATURED,
  MORE_PROJECTS,
  SKILLS,
  type Bilingual,
} from './content'
import './home.css'

const b = (text: Bilingual) => l(text.en, text.sv)

function Presentation() {
  return (
    <section
      className="home-hero ds-container"
      id="start"
      aria-labelledby="hero-title"
    >
      <p className="ds-label">
        {l('Data engineer · Stockholm', 'Data engineer · Stockholm')}
      </p>
      <h1 id="hero-title" className="home-hero-title">
        {l(
          'I build the whole path from raw data to something people understand.',
          'Jag bygger hela vägen från rådata till något människor förstår.',
        )}
      </h1>
      <p className="home-hero-lede">
        {l(
          'Anton Ernstsson — data engineering, analytics and applied AI.',
          'Anton Ernstsson – data engineering, analys och tillämpad AI.',
        )}
      </p>
      <div className="home-hero-links">
        <a className="ds-button" href="#politik">
          {l('See the politics product', 'Se politikprodukten')}
        </a>
        <a className="ds-button secondary" href="#projekt">
          {l('All projects', 'Alla projekt')}
        </a>
      </div>
    </section>
  )
}

function About() {
  return (
    <section
      className="ds-section ds-container"
      id="om-mig"
      aria-labelledby="about-title"
    >
      <div className="ds-section-head">
        <p className="ds-label">{l('About me', 'Om mig')}</p>
        <h2 id="about-title" className="ds-h2">
          {l(
            'I like understanding how the pieces fit together.',
            'Jag gillar att förstå hur delarna hänger ihop.',
          )}
        </h2>
      </div>
      <div className="home-columns">
        <div />
        <div>
          <p className="ds-body">
            {l(
              'I’m Anton, a data engineer in Stockholm. I work with data engineering, analytics and AI/ML, and what I enjoy most is building the whole flow: collecting data, transforming it into something reliable, and then analysing and showing it so that it can be used.',
              'Jag heter Anton och är data engineer i Stockholm. Jag arbetar med data engineering, analys och AI/ML, och det jag tycker allra mest om är att bygga hela flödet: samla in data, göra om den till något pålitligt, och sedan analysera och visa den så att den går att använda.',
            )}
          </p>
          <p className="ds-body">
            {l(
              'This portfolio shows both sides: the technical work behind each project, and how the data can be made understandable to someone who has never seen it before.',
              'Den här portfolion visar båda sidorna: det tekniska arbetet bakom varje projekt, och hur datan kan göras begriplig för någon som aldrig sett den förut.',
            )}
          </p>
        </div>
      </div>
    </section>
  )
}

function Experience() {
  return (
    <section
      className="ds-section ds-container"
      id="erfarenhet"
      aria-labelledby="experience-title"
    >
      <div className="ds-section-head">
        <p className="ds-label">{l('Experience', 'Erfarenhet')}</p>
        <h2 id="experience-title" className="ds-h2">
          {l(
            'From source systems to reports people use.',
            'Från källsystem till rapporter som används.',
          )}
        </h2>
      </div>
      <ol className="timeline">
        {EXPERIENCE.map((job) => (
          <li key={job.org} className="timeline-row">
            <div className="timeline-when">
              <p className="timeline-org">{job.org}</p>
              <p className="ds-small">{b(job.role)}</p>
              <p className="ds-small">{b(job.period)}</p>
            </div>
            <div className="timeline-what">
              <h3 className="visually-hidden">
                {l('What I did', 'Vad jag gjorde')}
              </h3>
              <ul className="timeline-did">
                {job.did.map((item) => (
                  <li key={item.sv}>{b(item)}</li>
                ))}
              </ul>
              <dl className="timeline-facts">
                <div>
                  <dt>{l('Result', 'Resultat')}</dt>
                  <dd>{b(job.effect)}</dd>
                </div>
                <div>
                  <dt>{l('Technology', 'Teknik')}</dt>
                  <dd>{job.tech.join(' · ')}</dd>
                </div>
              </dl>
            </div>
          </li>
        ))}
      </ol>
      <p className="ds-small home-education">
        {l('Education', 'Utbildning')}: {b(EDUCATION)}
      </p>
    </section>
  )
}

function Skills() {
  const [open, setOpen] = useState(false)
  return (
    <section
      className="ds-section ds-container"
      id="kompetenser"
      aria-labelledby="skills-title"
    >
      <div className="ds-section-head">
        <p className="ds-label">
          {l('Technical skills', 'Tekniska kompetenser')}
        </p>
        <h2 id="skills-title" className="ds-h2">
          {l('What I work with.', 'Det jag arbetar med.')}
        </h2>
      </div>
      <div className="skills" id="skills-list">
        {SKILLS.map((group) => (
          <div key={group.group.sv} className="skills-group">
            <h3>{b(group.group)}</h3>
            <p className="skills-top">{group.top.join(' · ')}</p>
            {open && (
              <p className="skills-more ds-small">{group.more.join(' · ')}</p>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="ds-button secondary skills-toggle"
        aria-expanded={open}
        aria-controls="skills-list"
        onClick={() => setOpen(!open)}
      >
        {open ? l('Show fewer', 'Visa färre') : l('Show more', 'Visa fler')}
      </button>
    </section>
  )
}

function Projects() {
  const [lead, ...rest] = FEATURED
  return (
    <section
      className="ds-section ds-container"
      id="projekt"
      aria-labelledby="projects-title"
    >
      <span id="projects" className="anchor-alias" />
      <div className="ds-section-head">
        <p className="ds-label">{l('Selected projects', 'Utvalda projekt')}</p>
        <h2 id="projects-title" className="ds-h2">
          {l('Questions I wanted answered.', 'Frågor jag ville ha svar på.')}
        </h2>
      </div>
      <article
        className="hp-project hp-lead"
        aria-labelledby={`project-${lead.id}`}
      >
        <p className="ds-label">{l('Featured', 'I fokus')}</p>
        <h3 id={`project-${lead.id}`} className="hp-lead-title">
          <a href={lead.href}>{b(lead.title)}</a>
        </h3>
        <ProjectFacts project={lead} />
      </article>
      <div className="hp-grid">
        {rest.map((project) => (
          <article
            key={project.id}
            className="hp-project"
            aria-labelledby={`project-${project.id}`}
          >
            <h3 id={`project-${project.id}`} className="hp-title">
              <a href={project.href}>{b(project.title)}</a>
            </h3>
            <ProjectFacts project={project} />
          </article>
        ))}
      </div>
      <details className="more-projects">
        <summary>{l('More projects', 'Fler projekt')}</summary>
        <ul className="ds-rule-list">
          {MORE_PROJECTS.map((p) => (
            <li key={p.title.sv}>
              <a
                href={p.href}
                className="more-row"
                {...(p.href.startsWith('http')
                  ? { target: '_blank', rel: 'noreferrer' }
                  : {})}
              >
                <strong>
                  {b(p.title)}
                  {p.href.startsWith('http') ? ' ↗' : ''}
                </strong>
                <span>{b(p.about)}</span>
              </a>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

function ProjectFacts({ project }: { project: (typeof FEATURED)[number] }) {
  return (
    <>
      <dl className="hp-facts">
        <div>
          <dt>{l('Problem', 'Problemet')}</dt>
          <dd>{b(project.problem)}</dd>
        </div>
        <div>
          <dt>{l('What I built', 'Vad jag byggde')}</dt>
          <dd>{b(project.built)}</dd>
        </div>
        <div>
          <dt>{l('Result', 'Resultatet')}</dt>
          <dd>{b(project.result)}</dd>
        </div>
        <div>
          <dt>{l('Technology', 'Teknik')}</dt>
          <dd>{project.tech.join(' · ')}</dd>
        </div>
      </dl>
      <p className="hp-links">
        <a className="ds-link" href={project.href}>
          {b(project.hrefLabel)} →
        </a>
        {project.code && (
          <a
            className="ds-link"
            href={project.code}
            target="_blank"
            rel="noreferrer"
          >
            {l('Code on GitHub', 'Koden på GitHub')} ↗
          </a>
        )}
      </p>
    </>
  )
}

function Contact() {
  return (
    <section
      className="ds-section ds-container"
      id="kontakt"
      aria-labelledby="contact-title"
    >
      <div className="ds-section-head">
        <p className="ds-label">{l('Contact', 'Kontakt')}</p>
        <h2 id="contact-title" className="ds-h2">
          {l(
            'Looking for a junior data role.',
            'Jag söker en junior roll inom data.',
          )}
        </h2>
      </div>
      <div className="home-columns">
        <div />
        <div>
          <p className="ds-body">
            {l(
              'In data engineering or analytics engineering, where I can contribute with Python, SQL and data modelling, keep learning, and work close to the people who use the results.',
              'Inom data engineering eller analytics engineering, där jag kan bidra med Python, SQL och datamodellering, fortsätta lära mig och arbeta nära dem som använder resultatet.',
            )}
          </p>
          <ul className="contact-list ds-rule-list">
            {profile.email && (
              <li>
                <a href={`mailto:${profile.email}`}>{profile.email}</a>
              </li>
            )}
            {profile.linkedin && (
              <li>
                <a href={profile.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn ↗
                </a>
              </li>
            )}
            <li>
              <a
                href="https://github.com/korv9"
                target="_blank"
                rel="noreferrer"
              >
                GitHub ↗
              </a>
            </li>
            {profile.cv && (
              <li>
                <a href={profile.cv} download>
                  {l('Download CV (PDF)', 'Ladda ned CV (PDF)')}
                </a>
              </li>
            )}
          </ul>
          <p className="ds-small">
            {l(
              'Stockholm · Swedish and English',
              'Stockholm · svenska och engelska',
            )}
          </p>
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <div className="home">
      <Presentation />
      <About />
      <Experience />
      <Skills />
      <Projects />
      <Contact />
    </div>
  )
}
