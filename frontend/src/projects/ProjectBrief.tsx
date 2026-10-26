import { l } from '../i18n'
import type { Route } from '../router'
import { HUB_GROUPS, PARTS } from '../hub/hubProjects'
import { BRIEFS } from './briefs'
import { PROJECTS, projectForRoute, type Bilingual } from './projectRegistry'

const b = (text: Bilingual) => l(text.en, text.sv)

/** Project pages in the order #projects lists them, each with the title its card shows. */
export const PROJECT_PAGES: { href: string; title: Bilingual }[] = (() => {
  const items = PARTS.flatMap((part) =>
    HUB_GROUPS.filter((g) => g.part === part.id).flatMap((g) => g.items),
  )
  const listed = items.filter((item) => item.href in BRIEFS)
  const rest = Object.keys(BRIEFS)
    .filter((href) => !listed.some((item) => item.href === href))
    .map((href) => ({
      href,
      title: PROJECTS.find((p) => p.href === href)?.title ?? {
        en: href,
        sv: href,
      },
    }))
  return [...listed, ...rest]
    .filter((page, i, all) => all.findIndex((p) => p.href === page.href) === i)
    .map(({ href, title }) => ({ href, title }))
})()

/** The project page a route belongs to: its own path, or its registry project's page. */
export function briefPath(route: Pick<Route, 'page' | 'path'>) {
  if (route.path in BRIEFS) return route.path
  const href = projectForRoute(route)?.href
  return href && href in BRIEFS ? href : undefined
}

/** The shared close of a project page, shown on its overview only. */
export default function ProjectBrief({ route }: { route: Route }) {
  const brief = BRIEFS[route.path]
  if (!brief || route.params.has('section')) return null
  const id = `brief-${route.path.slice(1)}`
  return (
    <section
      className="project-brief ds-container"
      id={id}
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`} className="visually-hidden">
        {l('About the project', 'Om projektet')}
      </h2>
      <div className="brief-part">
        <h3>{l('The question', 'Frågan')}</h3>
        <p className="brief-lead">{b(brief.question)}</p>
      </div>
      <div className="brief-part">
        <h3>{l('What I built', 'Vad jag byggde')}</h3>
        <dl className="brief-built">
          {brief.built.map((item) => (
            <div key={item.title.en}>
              <dt>{b(item.title)}</dt>
              <dd>{b(item.text)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="brief-part">
        <h3>{l('What it shows', 'Vad det visar')}</h3>
        <ul className="brief-shows">
          {brief.shows.map((item) => (
            <li key={item.value + item.text.en}>
              <b>{item.value}</b>
              <span>{b(item.text)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="brief-part">
        <h3>{l('How it works', 'Så fungerar det')}</h3>
        <ol className="brief-how">
          {brief.how.map((item) => (
            <li key={item.step.en}>
              <b>{b(item.step)}</b>
              <span>{b(item.text)}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="brief-part brief-foot">
        <div>
          <h3>{l('Tech', 'Teknik')}</h3>
          <p>{brief.tech.join(' · ')}</p>
        </div>
        <div>
          <h3>{l('Honest limits', 'Ärliga begränsningar')}</h3>
          <p>{b(brief.limits)}</p>
        </div>
        {brief.code && (
          <a href={brief.code} target="_blank" rel="noreferrer">
            {l('Code on GitHub', 'Koden på GitHub')} ↗
          </a>
        )}
      </div>
    </section>
  )
}
