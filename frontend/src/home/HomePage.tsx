/**
 * The start page, black (.noir) and centred like an index: who (name, roles, one sentence, four
 * links), experience (the two roles, then the core stack), selected projects (a large name per
 * flagship, the whole entry a link) and the rest smaller; about, contact and the links under the
 * hood close it. Every detail beyond that is one click deeper: an experience's bullets in a
 * disclosure, a project's depth on its own page.
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
import { HOME_PROJECTS, PROJECTS } from '../projects/projectRegistry'
import './home.css'

const b = (text: Bilingual) => l(text.en, text.sv)
const word = (tool: string | Bilingual) =>
  typeof tool === 'string' ? tool : b(tool)

/** The sections a global address points at; the header's links scroll to them. */
const SECTIONS = ['#projekt', '#erfarenhet', '#kompetenser', '#om-mig']

function Identity() {
  return (
    <section className="home-identity" id="start" aria-labelledby="home-name">
      <h1 id="home-name" className="index-title home-name">
        Anton Ernstsson
      </h1>
      <p className="index-meta home-roles">
        <span>Junior Software Developer</span>
        <span>Data &amp; AI</span>
      </p>
      <p className="home-lede">
        {l(
          'I build data pipelines, analytical products and applied AI systems.',
          'Jag bygger datapipelines, analysprodukter och tillämpade AI-system.',
        )}
      </p>
      <nav
        className="index-meta home-nav"
        aria-label={l('Start page', 'Startsidan')}
      >
        <a href="#projekt">{l('Projects', 'Projekt')}</a>
        <a href="#erfarenhet">{l('Experience', 'Erfarenhet')}</a>
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

function Experience() {
  return (
    <section
      className="home-section"
      id="erfarenhet"
      aria-labelledby="experience-title"
    >
      <h2 id="experience-title" className="index-label">
        {l('Experience', 'Erfarenhet')}
      </h2>
      <ol className="index">
        {EXPERIENCE.map((job) => (
          <li key={job.org} className="home-job">
            <h3 className="index-title">{job.org}</h3>
            <p className="index-meta">
              <span>{b(job.role)}</span>
              <span>{b(job.period)}</span>
            </p>
            <p className="home-job-impact">{b(job.effect)}</p>
            <Disclosure label={l('Details', 'Detaljer')}>
              <ul className="home-job-did">
                {job.did.map((item) => (
                  <li key={item.sv}>{b(item)}</li>
                ))}
              </ul>
              <p className="index-meta">{job.tech.join(', ')}</p>
            </Disclosure>
          </li>
        ))}
      </ol>
      {EDUCATION.map((e) => (
        <p key={e.school} className="index-meta home-education">
          <span>{l('Education', 'Utbildning')}</span>
          <span>
            {b(e.title)}, {e.school}, {e.period}
          </span>
        </p>
      ))}
      <aside
        className="home-stack"
        id="kompetenser"
        aria-labelledby="stack-title"
      >
        <h3 id="stack-title" className="index-label">
          {l('Core stack', 'Kärnstack')}
        </h3>
        <dl>
          {CORE_STACK.map((g) => (
            <div key={g.group.en}>
              <dt className="index-meta">{b(g.group)}</dt>
              <dd>{g.tools.map(word).join(', ')}</dd>
            </div>
          ))}
        </dl>
        <Disclosure label={l('Full stack', 'Hela stacken')}>
          <dl>
            {SKILLS.map((group) => (
              <div key={group.group.en}>
                <dt className="index-meta">{b(group.group)}</dt>
                <dd>{[...group.top, ...group.more].join(', ')}</dd>
              </div>
            ))}
          </dl>
        </Disclosure>
      </aside>
    </section>
  )
}

function SelectedWork() {
  return (
    <section
      className="home-section"
      id="projekt"
      aria-labelledby="projects-title"
    >
      <h2 id="projects-title" className="index-label">
        {l('Selected projects', 'Utvalda projekt')}
      </h2>
      <ol className="index">
        {HOME_PROJECTS.map((project) => (
          <li key={project.id}>
            <a className="index-link" href={project.href}>
              <h3 className="index-title">{b(project.title)}</h3>
              <p className="index-meta">{project.home!.tech.join(', ')}</p>
              <p className="home-question">{b(project.home!.question)}</p>
            </a>
          </li>
        ))}
      </ol>
      <MoreWork />
    </section>
  )
}

/** Every other project, smaller: the name a link to its page or code where there is one. */
function MoreWork() {
  const rest = PROJECTS.filter((p) => !p.home)
  return (
    <section
      className="home-more"
      id="fler-projekt"
      aria-labelledby="more-title"
    >
      <h3 id="more-title" className="index-label">
        {l('More work', 'Fler projekt')}
      </h3>
      <ul className="index">
        {rest.map((project) => {
          const code = Array.isArray(project.code)
            ? project.code[0]
            : project.code
          const href = project.href ?? code
          const external = !project.href && !!code
          const body = (
            <>
              <span className="index-title">{b(project.title)}</span>
              <span className="index-meta">{b(project.descriptor)}</span>
            </>
          )
          return (
            <li key={project.id}>
              {href ? (
                <a
                  className="index-link"
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                >
                  {body}
                </a>
              ) : (
                body
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The close, in three short blocks: about, contact, and the technical depth. */
function Outro() {
  return (
    <section className="home-outro">
      <div id="om-mig">
        <h2 className="index-title">{l('About', 'Om mig')}</h2>
        {ABOUT.map((text) => (
          <p key={text.sv}>{b(text)}</p>
        ))}
      </div>
      <div>
        <h2 className="index-title">{l('Contact', 'Kontakt')}</h2>
        <p className="index-meta">
          {l('Stockholm, Sweden', 'Stockholm, Sverige')}
        </p>
        <p className="index-meta">
          {profile.email && (
            <a href={`mailto:${profile.email}`}>{l('Email', 'Mejl')}</a>
          )}
          {profile.linkedin && (
            <a href={profile.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          )}
          <a href="https://github.com/korv9" target="_blank" rel="noreferrer">
            GitHub
          </a>
          {profile.cv && (
            <a href={profile.cv} download>
              CV
            </a>
          )}
        </p>
      </div>
      <div id="under-huven">
        <h2 className="index-title">{l('Under the hood', 'Under huven')}</h2>
        <p className="index-meta">
          <a href="#data-constellation">Data Constellation</a>
          <a href="#data-model">{l('Data platform', 'Dataplattformen')}</a>
          <a href="#quality">
            {l('Quality & Validity', 'Kvalitet och validitet')}
          </a>
        </p>
      </div>
      <p className="index-meta home-credits">
        <span>© {new Date().getFullYear()} Anton Ernstsson</span>
        <span>{l('Typeface', 'Typsnitt')}: Terminal Grotesque</span>
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
      <Outro />
    </div>
  )
}
