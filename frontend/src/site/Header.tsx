/**
 * The site frame around a page, besides the sidebar (site/Sidebar.tsx): the page's title for the
 * tab, the breadcrumb on project pages and the previous / next project. Project lists come from
 * projects/projectRegistry.ts.
 */
import { l } from '../i18n'
import type { Route } from '../router'
import {
  neighbours,
  projectForRoute,
  type Bilingual,
  type ProjectEntry,
} from '../projects/projectRegistry'

const b = (text: Bilingual) => l(text.en, text.sv)

/**
 * Where a project page sits: "Projects / <project>", from the registry. The pages under the
 * hood (Data Constellation, the data platform, quality, Idea Lineage) say so instead.
 */
const TECHNICAL: Partial<Record<Route['page'], Bilingual>> = {
  constellation: { en: 'Data Constellation', sv: 'Data Constellation' },
  catalogue: { en: 'Data catalogue', sv: 'Datakatalog' },
  lineage: { en: 'Idea Lineage', sv: 'Idea Lineage' },
  datamodel: { en: 'Data model', sv: 'Datamodell' },
  er: { en: 'ER diagram', sv: 'ER-diagram' },
  quality: { en: 'Quality and validity', sv: 'Kvalitet och validitet' },
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
  if (route.page === 'home') return null
  return (
    <nav
      className="project-context ds-container"
      aria-label={l('Breadcrumb', 'Brödsmulor')}
    >
      <ol>
        <li>
          <a href="#projekt">{l('Projects', 'Projekt')}</a>
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
              <a href="#under-huven">{l('Under the hood', 'Under huven')}</a>
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
export function ProjectPager({ route }: { route: Route }) {
  const project = projectForRoute(route)
  if (!project?.featured) return null
  const { previous, next } = neighbours(project.id)
  const link = (p: ProjectEntry | undefined, dir: 'previous' | 'next') =>
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
