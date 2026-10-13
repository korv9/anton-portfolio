/** Every project on one screen: three categories side by side, each with its projects listed under it. */
import { l } from '../i18n'
import { PROJECT_GROUPS, PROJECTS } from './projectRegistry'
import './projectsPage.css'

const ORDER = ['Engineering', 'Observatories', 'Labs']

export default function ProjectsPage() {
  return (
    <article className="projects-page" id="projekt">
      <h1 className="projects-title">{l('Projects', 'Projekt')}</h1>
      {ORDER.map((label) => {
        const group = PROJECT_GROUPS.find((item) => item.label === label)!
        return (
          <section
            key={label}
            className="projects-group"
            aria-labelledby={`projects-${label}`}
          >
            <h2 id={`projects-${label}`} className="projects-group-title">
              {label}
            </h2>
            <ul className="projects-list">
              {group.ids.map((id) => {
                const project = PROJECTS.find((p) => p.id === id)!
                return (
                  <li key={id}>
                    <a className="project-card" href={project.href}>
                      <h3 className="project-card-title">
                        {l(project.title.en, project.title.sv)}
                      </h3>
                      <p className="project-card-kind">
                        {l(project.descriptor.en, project.descriptor.sv)}
                      </p>
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </article>
  )
}
