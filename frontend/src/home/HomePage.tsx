/**
 * The start page, read in one screen: who Anton is in two sentences, then experience and the
 * tech stack side by side, then the politics product (the project that shows what he can do,
 * from sources to dashboard) and the other projects as small tiles. Every detail is one click
 * further in.
 */
import { l } from '../i18n'
import { profile } from '../content'
import {
  CVS,
  EDUCATION,
  EXPERIENCE,
  FLAGSHIP,
  PITCH,
  PROJECTS,
  STACK,
  type Bilingual,
  type Project,
} from './content'
import './home.css'

const b = (text: Bilingual) => l(text.en, text.sv)

/** The politics product as a pipeline: each step is a skill a recruiter can check. */
const PIPELINE: [string, string][] = [
  ['Sources', 'Källor'],
  ['Python ingestion', 'Inläsning i Python'],
  ['dbt + DuckDB, tested', 'dbt + DuckDB, testat'],
  ['Parquet in R2', 'Parquet i R2'],
  ['React dashboard', 'React-dashboard'],
]

const AREAS = [
  { key: 'ai', en: 'AI and machine learning', sv: 'AI och maskininlärning' },
  { key: 'data', en: 'Data and software', sv: 'Data och mjukvara' },
] as const

const repoName = (url: string) => url.replace('https://github.com/', '')

/**
 * One project: what it is, what came of it and the tools, with the page and the code as
 * separate links. A project without a public page or repository says so.
 */
function ProjectTile({ project }: { project: Project }) {
  const external = project.href.startsWith('http')
  const code = project.code
    ? Array.isArray(project.code)
      ? project.code
      : [project.code]
    : []
  return (
    <li className={`cv-project${project.area === 'ai' ? ' ai' : ''}`}>
      <span className="cv-kind">{b(project.kind)}</span>
      <h3>
        {project.href ? (
          <a
            href={project.href}
            {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            {b(project.title)}{' '}
            <span aria-hidden="true">{external ? '↗' : '→'}</span>
          </a>
        ) : (
          b(project.title)
        )}
      </h3>
      {project.area === 'ai' && <p>{b(project.summary)}</p>}
      <p className="cv-project-result">{b(project.result)}</p>
      <ul className="cv-chips" aria-label={l('Tools', 'Verktyg')}>
        {project.tech.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="cv-project-links">
        {project.team && <span>{b(project.team)}</span>}
        {code.map((url) => (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            {code.length > 1 ? repoName(url) : l('Code', 'Kod')} ↗
          </a>
        ))}
        {!project.href && !code.length && (
          <span>{l('Code not public', 'Koden är inte publik')}</span>
        )}
      </p>
    </li>
  )
}

export default function HomePage() {
  return (
    <div className="cv">
      <header className="cv-hero" id="start">
        <div>
          <h1 className="cv-name">Anton Ernstsson</h1>
          <p className="cv-role">
            {l(
              'Software Developer · Data Engineer · Analytics Engineer · Applied AI',
              'Software Developer · Data Engineer · Analytics Engineer · Tillämpad AI',
            )}
          </p>
          <p className="cv-pitch">{b(PITCH)}</p>
        </div>
        <nav
          className="cv-actions"
          aria-label={l('Contact and CV', 'Kontakt och CV')}
        >
          <a className="cv-button primary" href={CVS[0].file} download>
            {l('Download CV', 'Ladda ned CV')} ↓
          </a>
          {profile.email && (
            <a className="cv-button" href={`mailto:${profile.email}`}>
              {l('Email', 'Mejl')}
            </a>
          )}
          {profile.linkedin && (
            <a
              className="cv-button"
              href={profile.linkedin}
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn ↗
            </a>
          )}
          <a
            className="cv-button"
            href="https://github.com/korv9"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
          <details className="cv-more-cvs">
            <summary>{l('CV by role', 'CV per roll')}</summary>
            <ul>
              {CVS.map((cv) => (
                <li key={cv.file}>
                  <a href={cv.file} download>
                    {b(cv.role)} ↓
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </nav>
      </header>

      <div className="cv-overview">
        <section
          className="cv-panel"
          id="erfarenhet"
          aria-labelledby="erfarenhet-title"
        >
          <h2 className="cv-panel-title" id="erfarenhet-title">
            {l('Experience', 'Erfarenhet')}
          </h2>
          <ol className="cv-jobs">
            {EXPERIENCE.map((job) => (
              <li key={job.org} className="cv-job">
                <p className="cv-job-head">
                  <b>{b(job.role)}</b> · {job.org}
                  <span className="cv-when">{b(job.period)}</span>
                </p>
                <p className="cv-job-short">{b(job.short)}</p>
              </li>
            ))}
            <li className="cv-job education">
              <p className="cv-job-head">
                <b>{b(EDUCATION.role)}</b> · {EDUCATION.org}
                <span className="cv-when">{b(EDUCATION.period)}</span>
              </p>
              <p className="cv-job-short">{b(EDUCATION.short)}</p>
            </li>
          </ol>
        </section>

        <section
          className="cv-panel"
          id="teknik"
          aria-labelledby="teknik-title"
        >
          <h2 className="cv-panel-title" id="teknik-title">
            Tech stack
          </h2>
          <dl className="cv-stack">
            {STACK.map((group) => (
              <div key={group.group.sv} title={b(group.use)}>
                <dt>{b(group.group)}</dt>
                <dd>
                  <ul className="cv-chips">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section
        className="cv-projects-section"
        id="projekt"
        aria-labelledby="projekt-title"
      >
        <span id="projects" className="anchor-alias" />
        <h2 className="cv-panel-title" id="projekt-title">
          {l('Projects', 'Projekt')}
        </h2>
        <a className="cv-flagship" href={FLAGSHIP.href}>
          <div>
            <span className="cv-kind">{b(FLAGSHIP.kind)}</span>
            <h3>
              {b(FLAGSHIP.title)} <span aria-hidden="true">→</span>
            </h3>
            <p>{b(FLAGSHIP.result)}</p>
          </div>
          <ol
            className="cv-pipeline"
            aria-label={l('How it is built', 'Hur den är byggd')}
          >
            {PIPELINE.map(([en, sv], i) => (
              <li key={en} style={{ ['--i' as string]: i }}>
                {l(en, sv)}
              </li>
            ))}
          </ol>
          <span className="cv-flagship-cta">
            {l('Open the dashboard', 'Öppna dashboarden')} →
          </span>
        </a>
        {AREAS.map((area) => (
          <section
            key={area.key}
            className={`cv-area ${area.key}`}
            aria-labelledby={`cv-area-${area.key}`}
          >
            <h3 className="cv-area-title" id={`cv-area-${area.key}`}>
              {l(area.en, area.sv)}
            </h3>
            <ul className="cv-tiles">
              {PROJECTS.filter((p) => p.area === area.key).map((project) => (
                <ProjectTile key={project.id} project={project} />
              ))}
            </ul>
          </section>
        ))}
      </section>
    </div>
  )
}
