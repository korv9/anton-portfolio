/**
 * All projects on one page, in two tiers: the five selected projects in their numbered order,
 * each in the same grammar (question, what was built, result, tech), then the other work, which
 * a filter can narrow to AI or to data and software. Everything comes from projectRegistry.ts.
 */
import { useState } from 'react'
import { l } from '../i18n'
import { useReveal } from '../home/reveal'
import ProjectTile from './ProjectTile'
import {
  FLAGSHIPS,
  OTHER_WORK,
  RESEARCH,
  type Bilingual,
} from './projectRegistry'
import './projects.css'

const b = (text: Bilingual) => l(text.en, text.sv)

type Filter = 'all' | 'ai' | 'data'

export default function ProjectsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const root = useReveal<HTMLDivElement>([filter])
  const other = OTHER_WORK.filter(
    (p) => filter === 'all' || p.category === filter,
  )
  const count = (key: Filter) =>
    key === 'all'
      ? OTHER_WORK.length
      : OTHER_WORK.filter((p) => p.category === key).length
  return (
    <div className="cv projects-page" id="alla-projekt" ref={root}>
      <header className="page-hero">
        <p className="page-eyebrow">{l('Projects', 'Projekt')}</p>
        <h1>{l('What I have built', 'Det jag har byggt')}</h1>
        <p className="page-lead">
          {l(
            'From raw public data to finished products: pipelines, data models, machine learning and web apps. Selected projects first, then other work, then research and experiments.',
            'Från rå offentlig data till färdiga produkter: pipelines, datamodeller, maskininlärning och webbappar. Utvalda projekt först, sedan övriga arbeten, sist forskning och experiment.',
          )}
        </p>
      </header>

      <section className="selected-work" aria-labelledby="selected-work-title">
        <h2 className="cv-area-title" id="selected-work-title">
          {l('Selected work', 'Utvalda arbeten')}
        </h2>
        <ol className="selected-list">
          {FLAGSHIPS.map((p) => (
            <li key={p.id} className="selected-row reveal">
              <span className="selected-number" aria-hidden="true">
                {p.number}
              </span>
              <div className="selected-body">
                <p className="cv-kind">{b(p.descriptor)}</p>
                <h3>
                  <a href={p.href}>
                    {b(p.title)} <span aria-hidden="true"></span>
                  </a>
                </h3>
                <dl className="selected-facts">
                  <div>
                    <dt>{l('Question', 'Fråga')}</dt>
                    <dd>{b(p.question)}</dd>
                  </div>
                  <div>
                    <dt>{l('Built', 'Byggt')}</dt>
                    <dd>{b(p.built)}</dd>
                  </div>
                  <div>
                    <dt>{l('Result', 'Resultat')}</dt>
                    <dd>{b(p.result)}</dd>
                  </div>
                </dl>
                <ul className="cv-chips" aria-label={l('Tools', 'Verktyg')}>
                  {p.tech.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="other-work" aria-labelledby="other-work-title">
        <h2 className="cv-area-title" id="other-work-title">
          {l('Other work', 'Övriga arbeten')}
        </h2>
        <div
          className="project-filter"
          role="group"
          aria-label={l('Show other work', 'Visa övriga arbeten')}
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
        <ul className="cv-tiles">
          {other.map((project) => (
            <ProjectTile key={project.id} project={project} />
          ))}
        </ul>
      </section>

      <section className="other-work" aria-labelledby="research-title">
        <h2 className="cv-area-title" id="research-title">
          {l('Research & experiments', 'Forskning och experiment')}
        </h2>
        <p className="page-lead">
          {l(
            'Exploratory work on meaning in text: open questions, documented limits, nothing presented as finished.',
            'Utforskande arbete om betydelse i text: öppna frågor, dokumenterade begränsningar, inget presenterat som färdigt.',
          )}
        </p>
        <ul className="cv-tiles">
          {RESEARCH.map((project) => (
            <ProjectTile key={project.id} project={project} />
          ))}
        </ul>
      </section>
    </div>
  )
}
