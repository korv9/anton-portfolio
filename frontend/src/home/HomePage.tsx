/**
 * The start page as one document with two columns. The left column stays put: who Anton is,
 * the role in one line, a table of contents that follows the reader, the three CVs and how to
 * get in touch. The right column is read top to bottom: overview, about, experience, projects,
 * skills, education, contact. Nothing sits behind a toggle; a recruiter should have the whole
 * picture in ten seconds and the detail a scroll away.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { profile } from '../content'
import {
  CVS,
  EDUCATION,
  EXPERIENCE,
  FACTS,
  FLAGSHIP,
  LANGUAGES,
  PROJECTS,
  SKILLS,
  type Bilingual,
  type Project,
} from './content'
import './home.css'

const b = (text: Bilingual) => l(text.en, text.sv)

const TOC: [string, string, string][] = [
  ['start', 'Overview', 'Översikt'],
  ['om-mig', 'About', 'Om mig'],
  ['erfarenhet', 'Experience', 'Erfarenhet'],
  ['projekt', 'Projects', 'Projekt'],
  ['kompetenser', 'Skills', 'Kompetenser'],
  ['utbildning', 'Education', 'Utbildning'],
  ['kontakt', 'Contact', 'Kontakt'],
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
        <p className="cv-pitch">
          {l(
            'I build the whole path from raw data to something people understand: pipelines, models, analysis and the interface on top.',
            'Jag bygger hela vägen från rådata till något människor förstår: pipelines, modeller, analys och gränssnittet ovanpå.',
          )}
        </p>
        <p className="cv-status">
          <span className="cv-dot round" aria-hidden="true" />
          {l(
            'Open to junior roles · Stockholm',
            'Söker junior roll · Stockholm',
          )}
        </p>
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
        <Section id="start" index={1} title={l('Overview', 'Översikt')}>
          <p className="cv-lede">
            {l(
              'Junior data engineer with two data internships behind me, most recently at Avtalat, and a portfolio of end-to-end projects: from API ingestion and dbt models to machine learning and the dashboards people use.',
              'Junior data engineer med två datapraktiker i bagaget, senast på Avtalat, och en portfolio med projekt från början till slut: från API-inläsning och dbt-modeller till maskininlärning och dashboards som används.',
            )}
          </p>
          <dl className="cv-facts">
            {FACTS.map((fact, i) => (
              <div key={fact.value + i} style={{ ['--i' as string]: i }}>
                <dt>{b(fact.label)}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <div className="cv-fit">
            <p className="cv-label">
              {l(
                'Which role are you hiring for?',
                'Vilken roll rekryterar du till?',
              )}
            </p>
            <ul>
              {CVS.map((cv) => (
                <li key={cv.file}>
                  <a href={cv.file} download>
                    <strong>{b(cv.role)}</strong>
                    <span>{b(cv.focus)}</span>
                    <small>{l('Download CV', 'Ladda ned CV')} ↓</small>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="om-mig" index={2} title={l('About', 'Om mig')}>
          <div className="cv-prose">
            <p>
              {l(
                'I’m Anton, a data engineer in Stockholm. What I enjoy most is building the whole flow: getting data out of a source system, making it reliable, and turning it into something a person can read and act on.',
                'Jag heter Anton och är data engineer i Stockholm. Det jag tycker allra mest om är att bygga hela flödet: få ut data ur ett källsystem, göra den pålitlig och göra om den till något en människa kan läsa och agera på.',
              )}
            </p>
            <p>
              {l(
                'At Fora and Avtalat I built lakehouse pipelines in Azure Databricks, star schemas for reporting, Power BI models and an NLP analysis of 21,000 incidents. I work closely with the people who use the results and care about data quality, GDPR and being able to trace every number back to its source.',
                'På Fora och Avtalat byggde jag lakehouse-pipelines i Azure Databricks, stjärnscheman för rapportering, Power BI-modeller och en NLP-analys av 21 000 incidenter. Jag arbetar nära dem som använder resultatet och bryr mig om datakvalitet, GDPR och att varje siffra går att spåra till sin källa.',
              )}
            </p>
            <p>
              {l(
                'This site is itself a project: open data, tested models and the interface, built and run by me.',
                'Den här sajten är själv ett projekt: öppna data, testade modeller och gränssnittet, byggda och drivna av mig.',
              )}
            </p>
          </div>
        </Section>

        <Section
          id="erfarenhet"
          index={3}
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

        <Section id="projekt" index={4} title={l('Projects', 'Projekt')}>
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

        <Section id="kompetenser" index={5} title={l('Skills', 'Kompetenser')}>
          <dl className="cv-skills">
            {SKILLS.map((group) => (
              <div key={group.group.sv}>
                <dt>{b(group.group)}</dt>
                <dd>
                  <Tags items={group.items} />
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="utbildning" index={6} title={l('Education', 'Utbildning')}>
          <div className="cv-job">
            <p className="cv-when">{EDUCATION.period}</p>
            <div>
              <h3>{b(EDUCATION.title)}</h3>
              <p className="cv-kind">{b(EDUCATION.about)}</p>
              <p className="cv-kind">{b(LANGUAGES)}</p>
            </div>
          </div>
        </Section>

        <Section id="kontakt" index={7} title={l('Contact', 'Kontakt')}>
          <p className="cv-lede">
            {l(
              'Looking for a junior role in data engineering, analytics engineering or applied AI. The quickest way is email.',
              'Jag söker en junior roll inom data engineering, analytics engineering eller tillämpad AI. Snabbast når du mig på mejl.',
            )}
          </p>
          <ul className="cv-contact">
            {profile.email && (
              <li>
                <a href={`mailto:${profile.email}`}>
                  <small>{l('Email', 'Mejl')}</small>
                  {profile.email}
                </a>
              </li>
            )}
            {profile.linkedin && (
              <li>
                <a href={profile.linkedin} target="_blank" rel="noreferrer">
                  <small>LinkedIn</small>
                  linkedin.com/in/anton-ernstsson ↗
                </a>
              </li>
            )}
            <li>
              <a
                href="https://github.com/korv9"
                target="_blank"
                rel="noreferrer"
              >
                <small>GitHub</small>
                github.com/korv9 ↗
              </a>
            </li>
          </ul>
        </Section>
      </div>
    </div>
  )
}
