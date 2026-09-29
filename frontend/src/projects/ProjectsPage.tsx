/**
 * All projects on one page: the politics product first, then AI and machine learning, then
 * data and software. A filter narrows the tiles; every tile links to its page and its code.
 */
import { useState } from 'react'
import { l } from '../i18n'
import { FLAGSHIP, PROJECTS, type Bilingual } from '../home/content'
import { useReveal } from '../home/reveal'
import ProjectTile from './ProjectTile'
import '../home/home.css'

const b = (text: Bilingual) => l(text.en, text.sv)

const AREAS = [
  { key: 'ai', en: 'AI and machine learning', sv: 'AI och maskininlärning' },
  { key: 'data', en: 'Data and software', sv: 'Data och mjukvara' },
] as const

type Filter = 'all' | 'ai' | 'data'

export default function ProjectsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const root = useReveal<HTMLDivElement>([filter])
  const count = (key: Filter) =>
    key === 'all'
      ? PROJECTS.length
      : PROJECTS.filter((p) => p.area === key).length
  return (
    <div className="cv projects-page" id="projekt" ref={root}>
      <header className="page-hero">
        <p className="page-eyebrow">{l('Projects', 'Projekt')}</p>
        <h1>{l('What I have built', 'Det jag har byggt')}</h1>
        <p className="page-lead">
          {l(
            'From raw public data to finished products: pipelines, data models, machine learning, RAG and web apps. Each project links to its page and its code.',
            'Från rå offentlig data till färdiga produkter: pipelines, datamodeller, maskininlärning, RAG och webbappar. Varje projekt länkar till sin sida och sin kod.',
          )}
        </p>
        <div
          className="project-filter"
          role="group"
          aria-label={l('Show projects', 'Visa projekt')}
        >
          {(
            [
              ['all', 'All', 'Alla'],
              ['ai', 'AI and ML', 'AI och ML'],
              ['data', 'Data and software', 'Data och mjukvara'],
            ] as const
          ).map(([key, en, sv]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {l(en, sv)} <span>{count(key)}</span>
            </button>
          ))}
        </div>
      </header>

      {filter !== 'ai' && (
        <a className="cv-flagship reveal" href={FLAGSHIP.href}>
          <div>
            <span className="cv-kind">{b(FLAGSHIP.kind)}</span>
            <h2>
              {b(FLAGSHIP.title)} <span aria-hidden="true">→</span>
            </h2>
            <p>{b(FLAGSHIP.summary)}</p>
          </div>
          <ul className="cv-chips on-dark" aria-label={l('Tools', 'Verktyg')}>
            {FLAGSHIP.tech.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <span className="cv-flagship-cta">
            {l('Open the dashboard', 'Öppna dashboarden')} →
          </span>
        </a>
      )}

      {AREAS.filter((a) => filter === 'all' || a.key === filter).map((area) => (
        <section
          key={area.key}
          className={`cv-area ${area.key}`}
          aria-labelledby={`cv-area-${area.key}`}
        >
          <h2 className="cv-area-title" id={`cv-area-${area.key}`}>
            {l(area.en, area.sv)}
          </h2>
          <ul className="cv-tiles">
            {PROJECTS.filter((p) => p.area === area.key).map((project) => (
              <ProjectTile key={project.id} project={project} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
