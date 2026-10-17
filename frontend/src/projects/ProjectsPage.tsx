/** The projects to choose from, in three categories side by side, on the projects page. */
import { l } from '../i18n'
import { PROJECT_GROUPS, PROJECTS } from './projectRegistry'
import './projectsPage.css'

const ORDER = ['Engineering', 'Observatories', 'Labs']

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
      {ORDER.map((label) => {
        const group = PROJECT_GROUPS.find((item) => item.label === label)!
        return (
          <section
            key={label}
            className="projects-group"
            aria-labelledby={`projects-${label}`}
          >
            <h3 id={`projects-${label}`} className="projects-group-title">
              {label}
            </h3>
            <ul className="projects-list">
              {group.ids.map((id) => {
                const project = PROJECTS.find((p) => p.id === id)!
                const counts = holds(
                  domains.find((d) => d.id === DOMAIN[id])?.counts,
                )
                return (
                  <li key={id}>
                    <a className="project-card" href={project.href}>
                      <span className="project-card-title">
                        {l(project.title.en, project.title.sv)}
                      </span>
                      <span className="project-card-kind">
                        {l(project.descriptor.en, project.descriptor.sv)}
                      </span>
                      {counts && (
                        <span className="project-card-holds">{counts}</span>
                      )}
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
