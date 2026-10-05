/**
 * A project's own navigation: its name and its views, under the global header and the
 * breadcrumb. Generated from the project's `nav` in projectRegistry.ts; projects without one
 * show nothing. The politics and job-market products keep their own, richer navigation.
 */
import { l } from '../i18n'
import type { Route } from '../router'
import { projectForRoute } from './projectRegistry'

export function ProjectNav({ route }: { route: Route }) {
  const project = projectForRoute(route)
  if (!project?.nav) return null
  return (
    <nav
      className="project-nav ds-container"
      aria-label={l(
        `${project.title.en} sections`,
        `${project.title.sv}, delar`,
      )}
    >
      <p className="project-nav-title">
        {l(project.title.en, project.title.sv)}
      </p>
      <ul>
        {project.nav.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={route.path === item.href ? 'location' : undefined}
            >
              {l(item.label.en, item.label.sv)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
