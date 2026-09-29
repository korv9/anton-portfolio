/**
 * The start page, kept to what a recruiter needs: the left column stays put with the name, the
 * role, three sentences, the CVs and contact links; the right column is the evidence, read top
 * to bottom: projects, experience and the tech stack with what each part is used for.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { profile } from '../content'
import {
  CVS,
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

const TOC: [string, string, string][] = [
  ['projekt', 'Projects', 'Projekt'],
  ['erfarenhet', 'Experience', 'Erfarenhet'],
  ['teknik', 'Tech stack', 'Tech stack'],
]

/** The section currently being read: the last one whose top has passed a third of the view. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const update = () => {
      const line = window.innerHeight * 0.33
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }
      // At the very bottom the last section is current even if it is short.
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4
      )
        current = ids.at(-1)!
      setActive(current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [ids.join()])
  return active
}

function Sidebar({ active }: { active: string }) {
  return (
    <aside className="cv-side">
      <div className="cv-id">
        <h1 className="cv-name">Anton Ernstsson</h1>
        <p className="cv-role">
          {l(
            'Data Engineer · Analytics Engineer · Applied AI',
            'Data Engineer · Analytics Engineer · Tillämpad AI',
          )}
        </p>
        <p className="cv-pitch">{b(PITCH)}</p>
      </div>

      <nav className="cv-toc" aria-label={l('Contents', 'Innehåll')}>
        <ol>
          {TOC.map(([id, en, sv], index) => (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={active === id ? 'location' : undefined}
              >
                <span className="cv-toc-no">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="cv-toc-line" aria-hidden="true" />
                {l(en, sv)}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="cv-side-foot">
        <p className="cv-label">{l('CV by role', 'CV per roll')}</p>
        <ul className="cv-downloads">
          {CVS.map((cv) => (
            <li key={cv.file}>
              <a href={cv.file} download>
                <span>{b(cv.role)}</span>
                <small>PDF ↓</small>
              </a>
            </li>
          ))}
        </ul>
        <ul className="cv-links">
          {profile.email && (
            <li>
              <a href={`mailto:${profile.email}`}>{l('Email', 'Mejl')}</a>
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
            <a href="https://github.com/korv9" target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </li>
        </ul>
      </div>
    </aside>
  )
}

function Section({
  id,
  index,
  title,
  children,
}: {
  id: string
  index: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="cv-section" id={id} aria-labelledby={`${id}-title`}>
      <h2 className="cv-section-title" id={`${id}-title`}>
        <span className="cv-section-no">{String(index).padStart(2, '0')}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Tags({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <ul className="cv-tags" aria-label={l('Technology', 'Teknik')}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function ProjectRow({ project }: { project: Project }) {
  const external = project.href.startsWith('http')
  return (
    <li className="cv-project">
      <a
        className="cv-project-link"
        href={project.href}
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        <span className="cv-project-kind">{b(project.kind)}</span>
        <h3>
          {b(project.title)}
          <span className="cv-arrow" aria-hidden="true">
            {external ? '↗' : '→'}
          </span>
        </h3>
        <p>{b(project.summary)}</p>
        <p className="cv-result">{b(project.result)}</p>
      </a>
      <Tags items={project.tech} />
    </li>
  )
}

export default function HomePage() {
  const active = useActiveSection(TOC.map(([id]) => id))
  return (
    <div className="cv-layout">
      <Sidebar active={active} />
      <div className="cv-main">
        <Section id="projekt" index={1} title={l('Projects', 'Projekt')}>
          <span id="projects" className="anchor-alias" />
          <a className="cv-flagship" href={FLAGSHIP.href}>
            <span className="cv-project-kind">{b(FLAGSHIP.kind)}</span>
            <h3>
              {b(FLAGSHIP.title)}
              <span className="cv-arrow" aria-hidden="true">
                →
              </span>
            </h3>
            <p>{b(FLAGSHIP.summary)}</p>
            <p className="cv-result">{b(FLAGSHIP.result)}</p>
            <span className="cv-flagship-cta">
              {l('Open the dashboard', 'Öppna dashboarden')} →
            </span>
          </a>
          <Tags items={FLAGSHIP.tech} />
          <ul className="cv-projects">
            {PROJECTS.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </ul>
        </Section>

        <Section
          id="erfarenhet"
          index={2}
          title={l('Experience', 'Erfarenhet')}
        >
          <ol className="cv-timeline">
            {EXPERIENCE.map((job) => (
              <li key={job.org} className="cv-job">
                <p className="cv-when">{b(job.period)}</p>
                <div>
                  <h3>
                    {b(job.role)} <span className="cv-at">· {job.org}</span>
                  </h3>
                  <p className="cv-kind">{b(job.kind)}</p>
                  <ul className="cv-did">
                    {job.did.map((item) => (
                      <li key={item.sv}>{b(item)}</li>
                    ))}
                  </ul>
                  <Tags items={job.tech} />
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="teknik" index={3} title={l('Tech stack', 'Tech stack')}>
          <dl className="cv-skills">
            {STACK.map((group) => (
              <div key={group.group.sv}>
                <dt>{b(group.group)}</dt>
                <dd>
                  <p className="cv-use">{b(group.use)}</p>
                  <Tags items={group.items} />
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  )
}
