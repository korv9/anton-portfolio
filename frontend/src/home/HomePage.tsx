/**
 * The start page: a fast, recruiter-facing summary. Simple first, depth on demand.
 *
 * Order: hero (who, what kind of work, what to click); selected work, so a recruiter sees what
 * has been built first; experience; education beside the core stack; about; and under the hood
 * (the technical deep dives). Projects come from projects/projectRegistry.ts (HOME_PROJECTS,
 * each with its question and finding, tech secondary); experience, education and the stack
 * from home/orbitContent.ts. Methods, metrics and research live on the project pages; the
 * platform pages (Data Constellation, Quality & Validity) are linked at the bottom.
 */
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react'
import { l } from '../i18n'
import { profile } from '../content'
import { ABOUT } from './content'
import {
  CORE_STACK,
  EARLIER,
  EDUCATION,
  EXPERIENCE,
  SKILLS,
  type Bilingual,
} from './orbitContent'
import './home.css'
import { ProjectRow, Tag } from '../ui/Editorial'
import { HOME_PROJECTS, PROJECTS } from '../projects/projectRegistry'

const b = (text: Bilingual) => l(text.en, text.sv)
const word = (tool: string | Bilingual) =>
  typeof tool === 'string' ? tool : b(tool)

/** The sections a global address points at; the header's links scroll to them. */
const SECTIONS = ['#projekt', '#erfarenhet', '#kompetenser', '#om-mig']

/**
 * The previews are pictures behind the project rows. Their code and data load only when a row
 * comes into view, and never on narrow screens, where the text is the whole row.
 */
const PREVIEWS: Record<string, () => Promise<{ default: ComponentType }>> = {
  politics: () => import('./PoliticsPreview'),
  jobs: () => import('../jobs/ClusterPreview'),
  'symbolic-atlas': () => import('../symbolic/SymbolicPreview'),
  welfare: () =>
    import('./ProjectPreviews').then((m) => ({ default: m.SwedenPreview })),
}
const LAZY = Object.fromEntries(
  Object.entries(PREVIEWS).map(([id, load]) => [id, lazy(load)]),
)

function LazyPreview({ id }: { id: string }) {
  const Preview = LAZY[id]
  const box = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!Preview || !box.current) return
    if (window.matchMedia?.('(max-width: 760px)').matches) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [Preview])
  if (!Preview) return null
  return (
    <div ref={box} className="home-preview-slot">
      {show && (
        <Suspense fallback={null}>
          <Preview />
        </Suspense>
      )}
    </div>
  )
}

function Hero() {
  return (
    <section
      className="home-hero ds-container"
      id="start"
      aria-labelledby="home-role"
    >
      <p id="home-role" className="home-hero-role">
        {l(
          'Data Engineer · Analytics Engineer · Applied AI',
          'Data Engineer · Analytics Engineer · Tillämpad AI',
        )}
      </p>
      <p className="home-hero-lede">
        {l(
          'I build data pipelines, analytical products and applied AI systems.',
          'Jag bygger datapipelines, analysprodukter och tillämpade AI-system.',
        )}
      </p>
      <div className="home-hero-actions">
        <a className="home-cta is-primary" href="#projekt">
          {l('Selected work', 'Utvalda projekt')}
        </a>
        {profile.cv && (
          <a className="home-cta" href={profile.cv} download>
            {l('Download CV (PDF)', 'Ladda ned CV (PDF)')}
          </a>
        )}
        <span className="home-hero-links">
          <a href="https://github.com/korv9" target="_blank" rel="noreferrer">
            GitHub
          </a>
          {profile.linkedin && (
            <a href={profile.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          )}
        </span>
      </div>
    </section>
  )
}

function SelectedWork() {
  return (
    <section
      className="home-projects"
      id="projekt"
      aria-labelledby="projects-title"
    >
      <h2 id="projects-title" className="home-first-title">
        {l('Selected work', 'Utvalda projekt')}
      </h2>
      {HOME_PROJECTS.map((project, i) => (
        <ProjectRow
          backgroundPreview
          key={project.id}
          id={project.id}
          number={String(i + 1).padStart(2, '0')}
          title={b(project.title)}
          href={project.href}
          preview={<LazyPreview id={project.id} />}
        >
          <p className="home-project-question">{b(project.home!.question)}</p>
          <p className="home-project-description">{b(project.home!.finding)}</p>
          <p className="home-project-tech">{project.home!.tech.join(' · ')}</p>
          <a
            className="home-project-link"
            href={project.href}
            tabIndex={-1}
            aria-hidden="true"
          >
            {l('View project', 'Visa projektet')}
          </a>
        </ProjectRow>
      ))}
    </section>
  )
}

function Experience() {
  const [open, setOpen] = useState<string[]>([])
  return (
    <section
      className="home-experience"
      id="erfarenhet"
      aria-labelledby="experience-title"
    >
      <h2 id="experience-title" className="home-first-title">
        {l('Experience', 'Erfarenhet')}
      </h2>
      <ol className="home-jobs">
        {EXPERIENCE.map((job) => {
          const expanded = open.includes(job.org)
          return (
            <li key={job.org} className="home-job">
              <p className="home-job-period">{b(job.period)}</p>
              <h3 className="home-job-org">{job.org}</h3>
              <p className="home-job-role">{b(job.role)}</p>
              <p className="home-job-impact">{b(job.effect)}</p>
              <button
                type="button"
                className="home-job-toggle"
                aria-expanded={expanded}
                aria-controls={`experience-${job.org}`}
                onClick={() =>
                  setOpen((current) =>
                    expanded
                      ? current.filter((org) => org !== job.org)
                      : [...current, job.org],
                  )
                }
              >
                {expanded
                  ? l('Fewer details', 'Färre detaljer')
                  : l('What I did', 'Vad jag gjorde')}
                <span aria-hidden="true">{expanded ? ' −' : ' +'}</span>
              </button>
              <div id={`experience-${job.org}`} hidden={!expanded}>
                <ul className="home-job-did">
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
          )
        })}
      </ol>
    </section>
  )
}

function Education() {
  const thesis = PROJECTS.find((p) => p.id === 'thesis')
  return (
    <section
      className="home-education"
      id="utbildning"
      aria-labelledby="education-title"
    >
      <h2 id="education-title" className="home-first-title">
        {l('Education', 'Utbildning')}
      </h2>
      {EDUCATION.map((e) => (
        <p key={e.school} className="home-edu">
          <b>{b(e.title)}</b> · {e.school} · {e.period}
          <small>{b(e.note)}</small>
        </p>
      ))}
      {thesis && (
        <p className="home-edu-thesis">
          <a href={thesis.href}>{b(thesis.title)}</a>
        </p>
      )}
      <p className="home-earlier">{b(EARLIER)}</p>
    </section>
  )
}

function CoreStack() {
  return (
    <section
      className="home-stack"
      id="kompetenser"
      aria-labelledby="skills-title"
    >
      <h2 id="skills-title" className="home-first-title">
        {l('Core stack', 'Kärnstack')}
      </h2>
      <dl className="home-stack-groups">
        {CORE_STACK.map((g) => (
          <div key={g.group.en}>
            <dt>{b(g.group)}</dt>
            <dd>
              {g.tools.map(word).join(' · ')}
              {g.note && <small> ({b(g.note)})</small>}
            </dd>
          </div>
        ))}
      </dl>
      <details className="home-stack-full">
        <summary>
          {l('Full technical stack', 'Hela den tekniska stacken')}
        </summary>
        <div className="skills" id="skills-list">
          {SKILLS.map((group) => (
            <div key={group.group.sv} className="skills-group">
              <h3>{b(group.group)}</h3>
              <p className="skills-top">{group.top.join(' · ')}</p>
              <p className="skills-more ds-small">{group.more.join(' · ')}</p>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}

function About() {
  return (
    <section
      className="ds-container home-about"
      id="om-mig"
      aria-labelledby="about-title"
    >
      <h2 id="about-title" className="home-first-title">
        {l('About', 'Om mig')}
      </h2>
      <div className="home-about-grid">
        <div className="home-about-text">
          {ABOUT.map((text) => (
            <p key={text.sv}>{b(text)}</p>
          ))}
        </div>
        <p className="home-about-links">
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
      </div>
    </section>
  )
}

const DEEP_DIVES: { href: string; title: Bilingual; line: Bilingual }[] = [
  {
    href: '#data-constellation',
    title: { en: 'Data Constellation', sv: 'Data Constellation' },
    line: {
      en: 'How the platform is connected, from sources to products.',
      sv: 'Hur plattformen hänger ihop, från källor till produkter.',
    },
  },
  {
    href: '#quality',
    title: { en: 'Quality & Validity', sv: 'Kvalitet och validitet' },
    line: {
      en: 'How data quality and analytical validity are evaluated.',
      sv: 'Hur datakvalitet och analytisk validitet utvärderas.',
    },
  },
  {
    href: '#data-catalogue',
    title: { en: 'Data catalogue', sv: 'Datakatalog' },
    line: {
      en: 'Every published dataset, its model, source, readers and quality.',
      sv: 'Varje publicerat dataset, dess modell, källa, läsare och kvalitet.',
    },
  },
  {
    href: '#alla-projekt',
    title: { en: 'All projects', sv: 'Alla projekt' },
    line: {
      en: 'Other work, research and experiments.',
      sv: 'Övriga arbeten, forskning och experiment.',
    },
  },
]

function UnderTheHood() {
  return (
    <section
      className="ds-container home-hood"
      id="under-huven"
      aria-labelledby="hood-title"
    >
      <h2 id="hood-title" className="home-first-title">
        {l('Under the hood', 'Under huven')}
      </h2>
      <ul className="home-hood-list">
        {DEEP_DIVES.map((d) => (
          <li key={d.href}>
            <a href={d.href}>
              <b>{b(d.title)}</b>
              <span>{b(d.line)}</span>
            </a>
          </li>
        ))}
      </ul>
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
      <div className="home-work ds-container">
        <SelectedWork />
      </div>
      <div className="home-profile ds-container">
        <Experience />
        <div className="home-profile-side">
          <Education />
          <CoreStack />
        </div>
      </div>
      <About />
      <UnderTheHood />
    </div>
  )
}
