/**
 * The start page, across the whole screen: the name and role centred; education, experience and
 * About side by side; every project in rows of two, three and four; and a way into the project
 * pages. The sidebar is not shown here. Every detail beyond that is one click deeper: an
 * experience's bullets in a disclosure, a project's depth on its own page.
 *
 * Projects come from projects/projectRegistry.ts (HOME_PROJECTS); experience, education and the
 * stack from home/orbitContent.ts; the About text from home/content.ts.
 */
import { useEffect } from 'react'
import { l } from '../i18n'
import { profile } from '../content'
import { ABOUT } from './content'
import {
  ADDITIONAL,
  CORE_STACK,
  EDUCATION,
  EXPERIENCE,
  SKILLS,
  THESIS,
  type Bilingual,
} from './orbitContent'
import { Disclosure } from '../ui/Disclosure'
import { HOME_PROJECTS, PROJECTS } from '../projects/projectRegistry'
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
      <h1 id="home-name" className="home-name">
        Anton Ernstsson
      </h1>
      <p className="home-roles">Data &amp; AI Engineer</p>
      <nav className="home-nav" aria-label={l('Start page', 'Startsidan')}>
        <a href="#erfarenhet">{l('Experience', 'Erfarenhet')}</a>
        <a href="#projekt">{l('Projects', 'Projekt')}</a>
        <a href="#om-mig">{l('About', 'Om mig')}</a>
        {profile.cv && (
          <a
            href={profile.cv}
            download
            aria-label={l('Download CV', 'Ladda ner CV')}
          >
            CV
          </a>
        )}
      </nav>
    </section>
  )
}

/** Education on the left, experience in the middle, about on the right, across the screen. */
function Profile() {
  const thesis = PROJECTS.find((p) => p.id === 'thesis')
  return (
    <section
      className="home-screen home-profile"
      id="erfarenhet"
      aria-label={l('Profile', 'Profil')}
    >
      <div className="home-column" id="utbildning">
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
            <p className="home-job-tech">{THESIS.tech.join(' | ')}</p>
          </div>
        )}
      </div>
      <div className="home-column home-column-wide">
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
      <div className="home-column" id="om-mig">
        <h2 className="home-title">{l('About', 'Om mig')}</h2>
        {ABOUT.map((text) => (
          <p key={text.sv} className="home-about-text">
            {b(text)}
          </p>
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
        <div className="home-stack" id="kompetenser">
          <h3 className="home-label">{l('Core stack', 'Kärnstack')}</h3>
          <dl>
            {CORE_STACK.map((g) => (
              <div key={g.group.en}>
                <dt>{b(g.group)}</dt>
                <dd>{g.tools.map(word).join(', ')}</dd>
              </div>
            ))}
          </dl>
          <Disclosure label={l('Full stack', 'Hela stacken')}>
            <dl>
              {SKILLS.map((group) => (
                <div key={group.group.en}>
                  <dt>{b(group.group)}</dt>
                  <dd>{[...group.top, ...group.more].join(', ')}</dd>
                </div>
              ))}
            </dl>
          </Disclosure>
        </div>
      </div>
    </section>
  )
}

/** Rows of 2, 3 and 4 projects, then 4 a row: the flagships largest, first. */
const ROWS = [2, 3, 4]

function Work() {
  const projects = [
    ...HOME_PROJECTS,
    ...PROJECTS.filter((p) => !p.home && p.id !== 'thesis'),
  ]
  const rows: (typeof projects)[] = []
  for (let i = 0, r = 0; i < projects.length; r++) {
    const size = ROWS[Math.min(r, ROWS.length - 1)]
    rows.push(projects.slice(i, i + size))
    i += size
  }
  return (
    <section
      className="home-screen home-work"
      id="projekt"
      aria-labelledby="projects-title"
    >
      <h2 id="projects-title" className="home-work-title">
        {l('Projects', 'Projekt')}
      </h2>
      {rows.map((row, index) => (
        <ul
          key={index}
          className={`work-row cols-${ROWS[Math.min(index, ROWS.length - 1)]}`}
        >
          {row.map((project) => {
            const code = Array.isArray(project.code)
              ? project.code[0]
              : project.code
            const href = project.href || code
            const external = !project.href && !!code
            const body = (
              <>
                <h3 className="work-title">{b(project.title)}</h3>
                <p className="work-question">
                  {project.home ? b(project.home.question) : b(project.summary)}
                </p>
                {project.home && (
                  <p className="work-finding">{b(project.home.finding)}</p>
                )}
                <p className="work-tech">
                  {project.home
                    ? project.home.tech.join(', ')
                    : b(project.descriptor)}
                </p>
              </>
            )
            return (
              <li key={project.id}>
                {href ? (
                  <a
                    className="work-card"
                    href={href}
                    {...(external
                      ? { target: '_blank', rel: 'noreferrer' }
                      : {})}
                  >
                    {body}
                  </a>
                ) : (
                  <div className="work-card">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      ))}
    </section>
  )
}

/** The way into the project pages, with their dashboards and the sidebar. */
function ToProjects() {
  return (
    <section
      className="home-cta"
      id="under-huven"
      aria-label={l('Project pages', 'Projektsidorna')}
    >
      <a className="home-cta-link" href="#politik">
        {l(
          'Go to the project pages with live demos',
          'Gå till projektsidorna med demos',
        )}{' '}
        <span aria-hidden="true">→</span>
      </a>
      <p className="home-links">
        <a href="#data-constellation">Data Constellation</a>
        <a href="#data-model">{l('Data platform', 'Dataplattformen')}</a>
        <a href="#quality">
          {l('Quality & Validity', 'Kvalitet och validitet')}
        </a>
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
      <Profile />
      <Work />
      <ToProjects />
    </div>
  )
}
