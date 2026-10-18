/** A continuous project index with available pipeline metadata. */
import { l } from '../i18n'
import { LISTED_PROJECTS } from './projectRegistry'
import './projectsPage.css'

/** The subject in architecture/graph.json that each project on the platform is built from. */
const DOMAIN: Record<string, string> = {
  politics: 'politics',
  jobs: 'jobs',
  welfare: 'welfare',
  'ai-act': 'ai_act',
  'symbolic-atlas': 'symbolic',
  'philosophy-atlas': 'philosophy',
  'concept-constellation': 'concepts',
}

export type Domain = { id: string; counts: Record<string, number> }

function holds(counts: Record<string, number> | undefined) {
  if (!counts) return null
  const parts: [number, string, string][] = [
    [counts.sources, l('source', 'källa'), l('sources', 'källor')],
    [
      counts.models,
      l('dbt model', 'dbt-modell'),
      l('dbt models', 'dbt-modeller'),
    ],
    [counts.ml, l('ML stage', 'ML-steg'), l('ML stages', 'ML-steg')],
  ]
  return parts
    .filter(([n]) => n)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(' · ')
}

export default function ProjectList({ domains }: { domains: Domain[] }) {
  return (
    <div className="projects-groups">
      <p>
        Most of my latest projects are part of this data platform. Explore the
        pipelines and application code on{' '}
        <a href="https://github.com/korv9/anton-portfolio">GitHub</a>.
      </p>
      <ul className="projects-list">
        {LISTED_PROJECTS.map((project) => {
          const counts = holds(
            domains.find((domain) => domain.id === DOMAIN[project.id])?.counts,
          )
          return (
            <li key={project.id}>
              <a className="project-card" href={project.href}>
                <span className="project-card-title">
                  {l(project.title.en, project.title.sv)}
                </span>
                <span className="project-card-kind">
                  {l(project.descriptor.en, project.descriptor.sv)}
                </span>
                {counts && <span className="project-card-holds">{counts}</span>}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
