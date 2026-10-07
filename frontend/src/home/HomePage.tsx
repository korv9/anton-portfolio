/**
 * The start page in three screens: who (name, roles, one sentence, four links), experience (the
 * two roles with the core stack beside them) and selected work (one card per flagship). About and
 * the links under the hood follow, smaller. Every detail beyond that is one click deeper:
 * an experience's bullets in a disclosure, a project's depth on its own page.
 *
 * Projects come from projects/projectRegistry.ts (HOME_PROJECTS); experience, education and the
 * stack from home/orbitContent.ts; the About text from home/content.ts.
 */
import { useEffect } from 'react'
import { l } from '../i18n'
import { profile } from '../content'
import { ABOUT } from './content'
import {
  CORE_STACK,
  EDUCATION,
  EXPERIENCE,
  SKILLS,
  type Bilingual,
} from './orbitContent'
import { Disclosure } from '../ui/Disclosure'
import { HOME_PROJECTS } from '../projects/projectRegistry'
import './home.css'

const b = (text: Bilingual) => l(text.en, text.sv)
const word = (tool: string | Bilingual) =>
  typeof tool === 'string' ? tool : b(tool)

/** The sections a global address points at; the header's links scroll to them. */
const SECTIONS = ['#projekt', '#erfarenhet', '#kompetenser', '#om-mig']

function Identity() {
  return (
    <section
      className="home-screen home-identity"
      id="start"
      aria-labelledby="home-name"
    >
      <div className="home-identity-text">
        <h1 id="home-name" className="home-name">
          Anton Ernstsson
        </h1>
        <p className="home-roles">
          <span>Data Engineer</span>
          <span>Analytics Engineer</span>
          <span>{l('Applied AI', 'Tillämpad AI')}</span>
        </p>
        <p className="home-lede">
          {l(
            'I build data pipelines, analytical products and applied AI systems.',
            'Jag bygger datapipelines, analysprodukter och tillämpade AI-system.',
          )}
        </p>
      </div>
      <nav className="home-nav" aria-label={l('Start page', 'Startsidan')}>
        <a href="#projekt">{l('Projects', 'Projekt')}</a>
        <a href="#erfarenhet">{l('Experience', 'Erfarenhet')}</a>
        <a href="#om-mig">{l('About', 'Om mig')}</a>
        {profile.cv && (
          <a href={profile.cv} download>
            CV
          </a>
        )}
      </nav>
    </section>
  )
}

function Experience() {
  return (
    <section
      className="home-screen home-experience"
      id="erfarenhet"
      aria-labelledby="experience-title"
    >
      <p className="home-label">02</p>
      <h2 id="experience-title" className="home-title">
        {l('Experience', 'Erfarenhet')}
      </h2>
      <div className="home-experience-grid">
        <div>
          <ol className="home-jobs">
            {EXPERIENCE.map((job) => (
              <li key={job.org} className="home-job">
                <h3 className="home-job-org">{job.org}</h3>
                <p className="home-job-role">
                  {b(job.role)} · {b(job.period)}
                </p>
                <p className="home-job-impact">{b(job.effect)}</p>
                <Disclosure label={l('Details', 'Detaljer')}>
                  <ul className="home-job-did">
                    {job.did.map((item) => (
                      <li key={item.sv}>{b(item)}</li>
                    ))}
                  </ul>
                  <p className="home-job-tech">{job.tech.join(' · ')}</p>
                </Disclosure>
              </li>
            ))}
          </ol>
          {EDUCATION.map((e) => (
            <p key={e.school} className="home-education">
              <span className="home-label">{l('Education', 'Utbildning')}</span>{' '}
              {b(e.title)} · {e.school} · {e.period}
            </p>
          ))}
        </div>
        <aside
          className="home-stack"
          id="kompetenser"
          aria-labelledby="stack-title"
        >
          <h3 id="stack-title" className="home-label">
            {l('Core stack', 'Kärnstack')}
          </h3>
          <dl>
            {CORE_STACK.map((g) => (
              <div key={g.group.en}>
                <dt>{b(g.group)}</dt>
                <dd>{g.tools.map(word).join(' · ')}</dd>
              </div>
            ))}
          </dl>
          <Disclosure label={l('Full stack', 'Hela stacken')}>
            <dl>
              {SKILLS.map((group) => (
                <div key={group.group.en}>
                  <dt>{b(group.group)}</dt>
                  <dd>{[...group.top, ...group.more].join(' · ')}</dd>
                </div>
              ))}
            </dl>
          </Disclosure>
        </aside>
      </div>
    </section>
  )
}

function SelectedWork() {
  return (
    <section
      className="home-screen home-work"
      id="projekt"
      aria-labelledby="projects-title"
    >
      <p className="home-label">03</p>
      <h2 id="projects-title" className="home-title">
        {l('Selected work', 'Utvalda projekt')}
      </h2>
      <ol className="work-cards">
        {HOME_PROJECTS.map((project, i) => (
          <li key={project.id}>
            <a className="work-card" href={project.href}>
              <span className="work-number">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="work-title">{b(project.title)}</h3>
              <p className="work-question">{b(project.home!.question)}</p>
              <p className="work-finding">{b(project.home!.finding)}</p>
              <p className="work-tech">{project.home!.tech.join(' · ')}</p>
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}

function About() {
  return (
    <section className="home-about" id="om-mig" aria-labelledby="about-title">
      <h2 id="about-title" className="home-title">
        {l('About', 'Om mig')}
      </h2>
      {ABOUT.map((text) => (
        <p key={text.sv}>{b(text)}</p>
      ))}
      <p className="home-links">
        {profile.email && (
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        )}
        {profile.linkedin && (
          <a href={profile.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        )}
        <a href="https://github.com/korv9" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </p>
    </section>
  )
}

function UnderTheHood() {
  return (
    <section
      className="home-hood"
      id="under-huven"
      aria-labelledby="hood-title"
    >
      <h2 id="hood-title" className="home-title">
        {l('Under the hood', 'Under huven')}
      </h2>
      <p className="home-links">
        <a href="#data-constellation">Data Constellation</a>
        <a href="#quality">
          {l('Quality & Validity', 'Kvalitet och validitet')}
        </a>
        <a href="#alla-projekt">{l('All projects', 'Alla projekt')}</a>
      </p>
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
    <div className="home">
      <Identity />
      <Experience />
      <SelectedWork />
      <div className="home-lower">
        <About />
        <UnderTheHood />
      </div>
    </div>
  )
}
