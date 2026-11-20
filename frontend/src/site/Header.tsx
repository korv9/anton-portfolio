/** Document titles from the project registry. */
import { l } from '../i18n'
import { type Route } from '../router'
import { projectForRoute, type Bilingual } from '../projects/projectRegistry'

const b = (text: Bilingual) => l(text.en, text.sv)

/** The pages outside the registry name themselves; the rest are "Under the hood". */
const TECHNICAL: Partial<Record<Route['page'], Bilingual>> = {
  clusters: { en: 'Cluster Visuals', sv: 'Klustervisualiseringar' },
  meaning: {
    en: 'What does it even mean?',
    sv: 'What does it even mean?',
  },
  projects: { en: 'Projects', sv: 'Projekt' },
  labs: { en: 'Labs', sv: 'Labb' },
  jobs: { en: 'Arbetsförmedla', sv: 'Arbetsförmedla' },
  sweden: { en: 'SWEDEN Lab', sv: 'SWEDEN Lab' },
}

/** The page's own name for the document title, or null on the homepage. */
export function pageTitle(route: Route): string | null {
  if (route.page === 'home') return null
  const project = projectForRoute(route)
  if (project) return b(project.title)
  const technical = TECHNICAL[route.page]
  return technical ? b(technical) : l('Under the hood', 'Under huven')
}
