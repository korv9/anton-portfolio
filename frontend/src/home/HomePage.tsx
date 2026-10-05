/**
 * The start page: presentation and a circle with three topics, experience, projects and tech stack.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { profile } from '../content'
import {
  EDUCATION,
  EXPERIENCE,
  FEATURED,
  SKILLS,
  type Bilingual,
} from './orbitContent'
import './home.css'
import './eclipse.css'
import EclipseRadar from './EclipseRadar'
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
            'I build data products, pipelines and analytical tools.',
            'Jag bygger dataprodukter, pipelines och analysverktyg.',
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
  const [expanded, setExpanded] = useState<string[]>([])
  return (
    <section
      className="ds-section ds-container"
      id="erfarenhet"
      aria-labelledby="experience-title"
    >
      <h2 id="experience-title" className="ds-h2">
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
      <p className="ds-small education-line">{b(EDUCATION)}</p>
    </section>
  )
}

function Skills() {
  return (
    <section
      className="ds-section ds-container"
      id="kompetenser"
      aria-labelledby="skills-title"
    >
      <h2 id="skills-title" className="ds-h2">
        Tech stack
      </h2>
      <div className="skills" id="skills-list">
        {SKILLS.map((group) => (
          <div key={group.group.sv} className="skills-group">
            <h3>{b(group.group)}</h3>
            <p className="skills-top">{group.top.join(' · ')}</p>
            <p className="skills-more ds-small">{group.more.join(' · ')}</p>
          </div>
        ))}
      </div>
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
      <h2 id="projects-title" className="ds-h2">
        {l('Projects', 'Projekt')}
      </h2>
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
        </ProjectRow>
      ))}
      <p>
        <a href="#alla-projekt">
          {l('Browse all projects', 'Se alla projekt')} →
        </a>
      </p>
    </section>
  )
}

const AREAS = [
  { id: 'erfarenhet', en: 'Experience', sv: 'Erfarenhet', color: '#4e79a7' },
  { id: 'projekt', en: 'Projects', sv: 'Projekt', color: '#887ec8' },
  { id: 'kompetenser', en: 'Tech stack', sv: 'Tech stack', color: '#559266' },
]

const areaOf = (path: string) =>
  AREAS.find((area) => `#${area.id}` === path)?.id ?? null

export default function HomePage({ path }: { path: string }) {
  // The topic opens beside the circle (under it on narrow screens) without touching the address,
  // so the page never jumps. A link from elsewhere to #erfarenhet etc. still opens its topic.
  const [open, setOpen] = useState<string | null>(() => areaOf(path))
  useEffect(() => {
    const id = areaOf(path)
    if (id) setOpen(id)
  }, [path])
  const active = AREAS.find((area) => area.id === open)
  const select = (id: string) =>
    setOpen((current) => (current === id ? null : id))
  return (
    <div className="home home-orbit">
      <Presentation />
      <div className={`portfolio-explorer ${active ? 'has-selection' : ''}`}>
        <div className="portfolio-orbit">
          <EclipseRadar onChoose={() => setOpen('kompetenser')} />
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
          role="region"
          aria-label={active ? l(active.en, active.sv) : undefined}
          className="orbit-detail"
          hidden={!active}
          style={{ borderColor: active?.color }}
        >
          {active && (
            <>
              <button
                type="button"
                className="orbit-close"
                onClick={() => setOpen(null)}
              >
                {l('Close', 'Stäng')} ×
              </button>
              {active.id === 'erfarenhet' && <Experience />}
              {active.id === 'projekt' && <Projects />}
              {active.id === 'kompetenser' && <Skills />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
