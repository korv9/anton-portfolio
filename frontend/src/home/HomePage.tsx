/**
 * The start page: presentation, experience, selected projects, skills and contact.
 */
import { useEffect, useState } from 'react'
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
import { ProjectRow, Tag } from '../ui/Editorial'
import ClusterPreview from '../jobs/ClusterPreview'
import PoliticsPreview from './PoliticsPreview'
import { MethodPreview, SwedenPreview } from './ProjectPreviews'

const b = (text: Bilingual) => l(text.en, text.sv)

function Presentation() {
  return (
    <section
      className="home-hero ds-container"
      id="start"
      aria-labelledby="home-role"
    >
      <div className="home-hero-copy">
        <h2 id="home-role" className="home-hero-role">
          {l('Data engineer / developer', 'Data engineer / utvecklare')}
          <br />
          {l('Stockholm, Sweden', 'Stockholm, Sverige')}
        </h2>
        <p className="home-hero-lede">
          {l(
            'I build data products, pipelines and analytical tools that make complex data useful. Working with Python, cloud infrastructure and open data, with an interest in finding structure in complex systems.',
            'Jag bygger dataprodukter, pipelines och analysverktyg som gör komplex data användbar. Med Python, molninfrastruktur och öppna data hittar jag struktur i komplexa system.',
          )}
        </p>
        <div className="home-intro-links">
          <div className="home-intro-contact">
            {profile.email && (
              <a href={`mailto:${profile.email}`}>{l('Email', 'E-post')} ↗</a>
            )}
            {profile.linkedin && (
              <a href={profile.linkedin} target="_blank" rel="noreferrer">
                LinkedIn ↗
              </a>
            )}
            <a href="https://github.com/korv9" target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
            {profile.cv && (
              <a href={profile.cv} download>
                {l('Download CV (PDF)', 'Ladda ned CV (PDF)')} ↓
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Experience() {
  const [expanded, setExpanded] = useState<string[]>(['Avtalat'])
  return (
    <section
      className="ds-section ds-container"
      id="erfarenhet"
      aria-labelledby="experience-title"
    >
      <div className="ds-section-head">
        <p className="ds-label">
          <span className="ds-number">02 / </span>
          {l('Work & internships', 'Arbete & praktik')}
        </p>
        <h2 id="experience-title" className="ds-h2">
          {l('Experience', 'Erfarenhet')}
        </h2>
      </div>
      <p className="experience-hint">
        {l(
          'Explore each role · click a bar for details',
          'Utforska rollerna · klicka på en stapel för detaljer',
        )}
      </p>
      <p className="experience-scale">
        {l(
          'Period length · calendar months',
          'Periodens längd · kalendermånader',
        )}{' '}
        <span>0 — 6</span>
      </p>
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
              <span className="experience-bar-track" aria-hidden="true">
                <span
                  className={`experience-bar-fill ${job.org === 'Fora' ? 'experience-bar-fora' : ''}`}
                />
              </span>
              <span className="experience-bar-value">
                {job.org === 'Avtalat' ? 6 : 3}{' '}
                {l('calendar months', 'kalendermånader')}
              </span>
            </button>
            <div
              className="timeline-what"
              id={`experience-${job.org}`}
              hidden={!expanded.includes(job.org)}
            >
              <div className="timeline-result">
                <p className="ds-label">{l('Result', 'Resultat')}</p>
                <p>{b(job.effect)}</p>
              </div>
              <p className="ds-label timeline-work-label">
                {l('What I did', 'Vad jag gjorde')}
              </p>
              <ul className="timeline-did">
                {job.did.map((item) => (
                  <li key={item.sv}>{b(item)}</li>
                ))}
              </ul>
              <dl className="timeline-facts">
                <div>
                  <dt>{l('Technology', 'Teknik')}</dt>
                  <dd className="home-tags">
                    {job.tech.map((tech) => (
                      <Tag key={tech}>{tech}</Tag>
                    ))}
                  </dd>
                </div>
              </dl>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Education() {
  return (
    <section
      className="home-education-panel ds-container"
      id="utbildning"
      aria-labelledby="education-title"
    >
      <div>
        <p className="ds-label">
          04 / {l('Learning & development', 'Lärande & utveckling')}
        </p>
        <h2 id="education-title">{l('Education', 'Utbildning')}</h2>
        <p className="education-period">
          2024 — 2026 <span>400 {l('YH credits', 'YH-poäng')}</span>
        </p>
      </div>
      <div className="education-copy">
        <h3>{l('AI Developer', 'AI-utvecklare')}</h3>
        <p className="education-school">JENSEN Yrkeshögskola</p>
        <p>{b(EDUCATION)}</p>
      </div>
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
  const selected = [
    FEATURED[0],
    {
      ...FEATURED[1],
      title: {
        en: 'Swedish tech job market',
        sv: 'Svenska IT-arbetsmarknaden',
      },
      problem: {
        en: 'Do semantic groups of advertisements match the role categories we normally use?',
        sv: 'Stämmer semantiska grupper av annonser med de rollkategorier vi brukar använda?',
      },
      built: {
        en: 'Local multilingual embeddings, UMAP and HDBSCAN on selected JobTech software and data advertisements, joined back to the existing DuckDB and dbt models.',
        sv: 'Lokala flerspråkiga inbäddningar, UMAP och HDBSCAN på utvalda mjukvaru- och dataannonser från JobTech, kopplade till befintliga DuckDB- och dbt-modeller.',
      },
      result: {
        en: 'Explore the real semantic map by cluster, existing role, seniority or publication year, with diagnostics and automatic cluster profiles.',
        sv: 'Utforska den verkliga semantiska kartan efter kluster, befintlig roll, senioritet eller publiceringsår, med diagnostik och automatiska klusterprofiler.',
      },
      href: '#job-market-clusters',
      tech: ['Python', 'DuckDB', 'dbt', 'UMAP', 'HDBSCAN', 'React'],
    },
    {
      id: 'thesis',
      title: { en: 'ITSM / Machine Learning', sv: 'ITSM / Maskininlärning' },
      problem: {
        en: 'Similar incidents may share a problem before anyone links them.',
        sv: 'Liknande incidenter kan dela ett problem innan någon kopplar ihop dem.',
      },
      built: {
        en: 'A reproducible workflow for data quality, anonymisation, embeddings and clustering in Azure Databricks.',
        sv: 'Ett reproducerbart flöde för datakvalitet, anonymisering, inbäddningar och klustring i Azure Databricks.',
      },
      result: {
        en: 'Groups of incidents become candidates for manual review. Internal source records and coordinates are not public.',
        sv: 'Grupper av incidenter blir kandidater för manuell granskning. Interna källposter och koordinater är inte offentliga.',
      },
      tech: ['Python', 'Databricks', 'NLP', 'UMAP', 'HDBSCAN'],
      href: '#thesis',
      hrefLabel: { en: 'Read the case study', sv: 'Läs fallstudien' },
    },
    FEATURED.find((project) => project.id === 'welfare')!,
  ]
  const descriptions = [
    l(
      'An open data project exploring parliamentary data, politicians and how Sweden votes.',
      'Ett öppet dataprojekt om riksdagen, politikerna och hur Sverige röstar.',
    ),
    l(
      'The Swedish tech job market through open job data, language models and clustering.',
      'Den svenska IT-arbetsmarknaden genom öppna jobbdata, språkmodeller och klustring.',
    ),
    l(
      'Finding groups of related incidents in IT service data for manual review.',
      'Hitta grupper av relaterade incidenter i IT-servicedata för manuell granskning.',
    ),
    l(
      'Jobs, health and trust across Sweden, explored through five public data sources.',
      'Jobb, hälsa och förtroende i Sverige, utforskade genom fem offentliga datakällor.',
    ),
  ]
  return (
    <section
      className="home-projects ds-section ds-container"
      id="projekt"
      aria-labelledby="projects-title"
    >
      <span id="projects" className="anchor-alias" />
      <div className="ds-section-head">
        <p className="ds-label">
          <span className="ds-number">03 / </span>
          {l('Data & analysis', 'Data & analys')}
        </p>
        <h2 id="projects-title" className="ds-h2">
          {l('Featured projects', 'Utvalda projekt')}
        </h2>
      </div>
      <p className="experience-hint">
        {l(
          'Explore the charts · open a project to dive deeper',
          'Utforska graferna · öppna ett projekt för att se mer',
        )}
      </p>
      {selected.map((project, index) => (
        <ProjectRow
          backgroundPreview
          key={project.id}
          id={project.id}
          number={String(index + 1).padStart(2, '0')}
          title={b(project.title)}
          href={project.href}
          preview={
            index === 0 ? (
              <PoliticsPreview />
            ) : index === 1 ? (
              <ClusterPreview />
            ) : index === 2 ? (
              <MethodPreview />
            ) : (
              <SwedenPreview />
            )
          }
        >
          <p className="home-project-description">{descriptions[index]}</p>
          <div className="home-tags">
            {project.tech.slice(0, 4).map((tech) => (
              <Tag key={tech}>{tech}</Tag>
            ))}
          </div>
          <details className="home-project-details">
            <summary>{l('Project details', 'Om projektet')}</summary>
            <ProjectFacts project={project} />
          </details>
        </ProjectRow>
      ))}
      <details className="more-projects">
        <summary>{l('More projects', 'Fler projekt')}</summary>
        <ul className="ds-rule-list">
          {FEATURED.slice(2)
            .filter((p) => p.id !== 'welfare')
            .map((p) => (
              <li key={p.id}>
                <a href={p.href} className="more-row">
                  <strong>{b(p.title)}</strong>
                  <span>{b(p.problem)}</span>
                </a>
              </li>
            ))}
          {MORE_PROJECTS.filter(
            (p) => !['#thesis', '#rfc-drift'].includes(p.href),
          ).map((p) => (
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
          <dd className="home-tags">
            {project.tech.map((tech) => (
              <Tag key={tech}>{tech}</Tag>
            ))}
          </dd>
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

const AREAS = [
  { id: 'erfarenhet', en: 'Experience', sv: 'Erfarenhet', color: '#4e79a7' },
  { id: 'projekt', en: 'Projects', sv: 'Projekt', color: '#887ec8' },
  { id: 'utbildning', en: 'Education', sv: 'Utbildning', color: '#b48a32' },
  { id: 'kompetenser', en: 'Skills', sv: 'Kompetenser', color: '#559266' },
  { id: 'kontakt', en: 'Contact', sv: 'Kontakt', color: '#c77561' },
]

const point = (radius: number, angle: number) => [
  300 + radius * Math.cos(angle),
  300 + radius * Math.sin(angle),
]
function sector(index: number) {
  const start = -Math.PI / 2 + (index * Math.PI * 2) / 5 + 0.025
  const end = start + (Math.PI * 2) / 5 - 0.05
  const a = point(94, start),
    b = point(232, start),
    c = point(232, end),
    d = point(94, end)
  return `M ${a} L ${b} A 232 232 0 0 1 ${c} L ${d} A 94 94 0 0 0 ${a} Z`
}

export default function HomePage({ path }: { path: string }) {
  const active = AREAS.find((area) => `#${area.id}` === path)
  useEffect(() => {
    if (!active) return
    const frame = requestAnimationFrame(() => {
      const panel = document.getElementById('orbit-detail')
      panel?.focus({ preventScroll: true })
      if (window.matchMedia('(max-width: 900px)').matches)
        panel?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [active?.id])
  const select = (id: string) => {
    window.location.hash = id
  }
  return (
    <div className="home home-orbit">
      <Presentation />
      <div className={`portfolio-explorer ${active ? 'has-selection' : ''}`}>
        <div className="portfolio-orbit">
          <p className="orbit-instruction">
            {l(
              'One circle. My work, background and ideas.',
              'En cirkel. Mitt arbete, min bakgrund och mina idéer.',
            )}
          </p>
          <svg className="orbit-chart" viewBox="0 0 600 600" aria-hidden="true">
            {[94, 140, 186, 232].map((r) => (
              <circle
                key={r}
                cx="300"
                cy="300"
                r={r}
                fill="none"
                stroke="currentColor"
                opacity=".12"
              />
            ))}
            {AREAS.map((area, i) => {
              const label = point(
                174,
                -Math.PI / 2 + ((i + 0.5) * Math.PI * 2) / 5,
              )
              return (
                <g
                  key={area.id}
                  className={`orbit-segment ${active?.id === area.id ? 'is-active' : ''}`}
                  onClick={() => select(area.id)}
                >
                  <path d={sector(i)} fill={area.color} stroke={area.color} />
                  <text
                    x={label[0]}
                    y={label[1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {l(area.en, area.sv)}
                  </text>
                </g>
              )
            })}
            <text
              x="300"
              y="290"
              textAnchor="middle"
              className="orbit-center-title"
            >
              {l('Explore', 'Utforska')}
            </text>
            <text
              x="300"
              y="317"
              textAnchor="middle"
              className="orbit-center-hint"
            >
              {l('Choose a colour', 'Välj en färg')}
            </text>
          </svg>
          <nav
            className="orbit-legend"
            aria-label={l('Explore my portfolio', 'Utforska min portfolio')}
          >
            {AREAS.map((area) => (
              <button
                key={area.id}
                type="button"
                aria-expanded={active?.id === area.id}
                aria-controls="orbit-detail"
                onClick={() => select(area.id)}
              >
                <i style={{ backgroundColor: area.color }} aria-hidden="true" />
                {l(area.en, area.sv)}
              </button>
            ))}
          </nav>
        </div>
        <div
          id="orbit-detail"
          tabIndex={-1}
          role="region"
          aria-label={active ? l(active.en, active.sv) : undefined}
          className="orbit-detail"
          hidden={!active}
          style={{ borderColor: active?.color }}
        >
          {active && (
            <>
              <a className="orbit-close" href="#start">
                {l('Close', 'Stäng')} ×
              </a>
              {active.id === 'erfarenhet' && <Experience />}
              {active.id === 'projekt' && <Projects />}
              {active.id === 'utbildning' && <Education />}
              {active.id === 'kompetenser' && <Skills />}
              {active.id === 'kontakt' && <Contact />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
