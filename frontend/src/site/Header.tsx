/** Document titles, breadcrumbs and project paging from the project registry. */
import { l } from '../i18n'
import { isLongRead, type Route } from '../router'
import {
  neighbours,
  projectForRoute,
  type Bilingual,
  type ProjectEntry,
} from '../projects/projectRegistry'
import { PROJECT_PAGES, briefPath } from '../projects/ProjectBrief'

const b = (text: Bilingual) => l(text.en, text.sv)

/**
 * Where a project page sits: "Projects / <project>", from the registry. The pages under the
 * hood (Data Constellation, the data platform, quality, Idea Lineage) say so instead.
 */
const TECHNICAL: Partial<Record<Route['page'], Bilingual>> = {
  clusters: { en: 'Cluster Visuals', sv: 'Cluster Visuals' },
  meaning: {
    en: 'What does it even mean?',
    sv: 'What does it even mean?',
  },
  projects: { en: 'Projects', sv: 'Projekt' },
  jobs: { en: 'Arbetsförmedla', sv: 'Arbetsförmedla' },
  sweden: { en: 'SWEDEN', sv: 'SWEDEN' },
}

/** The page's own name for the document title, or null on the homepage. */
export function pageTitle(route: Route): string | null {
  if (route.page === 'home') return null
  const project = projectForRoute(route)
  if (project) return b(project.title)
  const technical = TECHNICAL[route.page]
  return technical ? b(technical) : l('Under the hood', 'Under huven')
}

export function ProjectContext({ route }: { route: Route }) {
  const project = projectForRoute(route)
  const technical = TECHNICAL[route.page]
  if (route.page === 'home' || route.page === 'projects') return null
  if (isLongRead(route.path)) return null
  return (
    <nav
      className="project-context ds-container"
      aria-label={l('Breadcrumb', 'Brödsmulor')}
    >
      <ol>
        <li>
          <a href="#projects">{l('Projects', 'Projekt')}</a>
        </li>
        {project && (
          <li>
            {route.path === project.href ? (
              <span aria-current="page">{b(project.title)}</span>
            ) : (
              <a href={project.href}>{b(project.title)}</a>
            )}
          </li>
        )}
        {!project && technical && (
          <>
            <li>
              <a href="#projects">{l('Tools', 'Verktyg')}</a>
            </li>
            <li>
              <span aria-current="page">{b(technical)}</span>
            </li>
          </>
        )}
      </ol>
    </nav>
  )
}

/** Previous and next flagship project, at the bottom of a flagship's page. */
type PagerLink = Pick<ProjectEntry, 'href' | 'title'>

/** Previous and next in the order #projects lists the pages, else in registry order. */
function pagerNeighbours(route: Route): {
  previous?: PagerLink
  next?: PagerLink
} | null {
  const path = briefPath(route)
  if (path) {
    const i = PROJECT_PAGES.findIndex((p) => p.href === path)
    return { previous: PROJECT_PAGES[i - 1], next: PROJECT_PAGES[i + 1] }
  }
  const project = projectForRoute(route)
  return project && !isLongRead(route.path) ? neighbours(project.id) : null
}

export function ProjectPager({ route }: { route: Route }) {
  const pages = pagerNeighbours(route)
  if (!pages) return null
  const { previous, next } = pages
  const link = (p: PagerLink | undefined, dir: 'previous' | 'next') =>
    p ? (
      <a
        className={`pager-${dir}`}
        href={p.href}
        rel={dir === 'previous' ? 'prev' : 'next'}
      >
        <small>
          {dir === 'previous'
            ? l('Previous project', 'Föregående projekt')
            : l('Next project', 'Nästa projekt')}
        </small>
        <span>{b(p.title)}</span>
      </a>
    ) : (
      <span />
    )
  return (
    <nav
      className="project-pager ds-container"
      aria-label={l('More projects', 'Fler projekt')}
    >
      {link(previous, 'previous')}
      {link(next, 'next')}
    </nav>
  )
}
