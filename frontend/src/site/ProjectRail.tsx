import { l } from '../i18n'
import { MEANING, type Route } from '../router'
import Signature from '../home/Signature'
import LanguageToggle from './LanguageToggle'
import './project-rail.css'

type Item = { href: string; en: string; sv: string; external?: boolean }

/** The index on every project page: Overview, then the feed, then each project by group. */
const GROUPS: { en: string; sv: string; items: Item[] }[] = [
  {
    en: 'Running on the data platform',
    sv: 'Körs på dataplattformen',
    items: [
      {
        href: MEANING,
        en: 'What does it even mean?',
        sv: 'What does it even mean?',
      },
      { href: '#jobs', en: 'Arbetsförmedla', sv: 'Arbetsförmedla' },
      { href: '#replik', en: 'Replik', sv: 'Replik' },
      {
        href: '#lag-ankomst',
        en: 'When does a law arrive?',
        sv: 'När kommer en lag fram?',
      },
      { href: '#sweden', en: 'SWEDEN', sv: 'SWEDEN' },
      { href: '#fraga-lagen', en: 'Allegora', sv: 'Allegora' },
      { href: '#cluster-visuals', en: 'Cluster Visuals', sv: 'Klusterbilder' },
      {
        href: '#projects-platform',
        en: 'The data platform',
        sv: 'Dataplattformen',
      },
    ],
  },
  {
    en: 'Experiments',
    sv: 'Experiment',
    items: [
      { href: '#philosophy-atlas', en: 'Philosophy Lab', sv: 'Philosophy Lab' },
      { href: '#symbolic-atlas', en: 'Symbol Lab', sv: 'Symbol Lab' },
      { href: '#concepts-profiles', en: 'Concept Lab', sv: 'Concept Lab' },
    ],
  },
  {
    en: 'Other projects',
    sv: 'Övriga projekt',
    items: [
      {
        href: '#thesis',
        en: 'IT Incident Clustering',
        sv: 'IT Incident Clustering',
      },
      { href: '#drugcomb', en: 'Drug Synergy Lab', sv: 'Drug Synergy Lab' },
      // A backend without a page of its own: like the hub, it opens the repository.
      {
        href: 'https://github.com/korv9/homie-api',
        en: 'Homie API',
        sv: 'Homie API',
        external: true,
      },
    ],
  },
]

/** The index entry a route belongs to; a report's tabs and a hub's sections light their page. */
function activeHref(route: Route) {
  const { page, path } = route
  if (page === 'projects')
    return path === '#projects-platform' ? path : '#projects'
  const byPage: Partial<Record<Route['page'], string>> = {
    meaning: MEANING,
    jobs: '#jobs',
    replik: '#replik',
    aiclock: '#lag-ankomst',
    sweden: '#sweden',
    lawqa: '#fraga-lagen',
    clusters: '#cluster-visuals',
    philosophy: '#philosophy-atlas',
    symbolic: '#symbolic-atlas',
    concepts: '#concepts-profiles',
    thesis: '#thesis',
    drugcomb: '#drugcomb',
  }
  return byPage[page]
}

/**
 * The projects start: a floating signature that leads home and an index on the left quarter,
 * shaded darker towards the edge with a little grain, so no page is a dead end.
 */
export default function ProjectRail({ route }: { route: Route }) {
  const active = activeHref(route)
  const link = (item: Item, overview = false) => (
    <a
      key={item.href}
      href={item.href}
      className={`rail-link${overview ? ' rail-overview' : ''}`}
      aria-current={item.href === active ? 'page' : undefined}
      {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {l(item.en, item.sv)}
      {item.external && ' ↗'}
    </a>
  )
  return (
    <>
      <div className="rail-shade" aria-hidden="true" />
      <a
        className="rail-signature"
        href="#start"
        aria-label={l('Anton Ernstsson, home', 'Anton Ernstsson, start')}
      >
        <Signature
          className="rail-signature-ink"
          gradientId="rail-signature-ink"
        />
      </a>
      <nav className="rail-tools" aria-label={l('Site', 'Webbplats')}>
        <a href="#om-mig">{l('About', 'Om mig')}</a>
        <a href="https://github.com/korv9" target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
        <LanguageToggle />
      </nav>
      <nav className="project-rail" aria-label={l('Projects', 'Projekt')}>
        {link({ href: '#projects', en: 'Overview', sv: 'Översikt' }, true)}
        {GROUPS.map((group) => (
          <div key={group.en} className="rail-group">
            <p className="rail-group-label">{l(group.en, group.sv)}</p>
            {group.items.map((item) => link(item))}
          </div>
        ))}
      </nav>
    </>
  )
}
