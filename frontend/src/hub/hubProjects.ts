/**
 * The projects in the hub (#projekt), grouped as its sidebar shows them. The texts come from the
 * project pages, the registry and the start page's earlier project list.
 */
import { MEANING } from '../router'
import { PROJECTS, type Bilingual } from '../projects/projectRegistry'

const t = (sv: string, en: string): Bilingual => ({ sv, en })

export type HubItem = {
  id: string
  title: Bilingual
  text: Bilingual
  /** Where the item opens: a page on this site, or a repository on GitHub. */
  href: string
}

export type HubGroup = {
  /** The group's address in the hub is #projekt-<id>. */
  id: string
  title: Bilingual
  items: HubItem[]
}

const registry = (id: string): HubItem => {
  const p = PROJECTS.find((entry) => entry.id === id)!
  return { id, title: p.title, text: p.summary, href: p.href }
}

const repo = (name: string, title: Bilingual, text: Bilingual): HubItem => ({
  id: name,
  title,
  text,
  href: `https://github.com/korv9/${name}`,
})

const JOBS_TEXT = t(
  'Mitt cv matchat varje timme mot aktuella Data/IT-annonser från JobTech. Varje klass säger varför, med annonsens mening och cv-raden bakom. Det stöder mitt beslut; det uppskattar inte chansen att bli anställd.',
  'My CV matched every hour with current Data/IT ads from JobTech. Each class says why, with the ad sentence and the CV line behind it. It supports my decision; it does not estimate a chance of being hired.',
)

const PLATFORM_TEXT = t(
  'Sidan körs på en dataplattform som jag har byggt själv. Varje dag hämtar den öppna data från Sverige och EU, modellerar och testar den i dbt och DuckDB och publicerar versionerade releaser till Cloudflare R2.',
  'This site runs on a data platform I built on my own. Every day it collects Swedish and EU public data, models and tests it in dbt and DuckDB, and publishes versioned releases to Cloudflare R2.',
)

const SWEDEN_TEXT = t(
  'Utvald forskningsplattform: fem forskningsprodukter om det svenska samhället',
  'Featured research platform: five research products on Swedish society',
)

export const HUB_GROUPS: HubGroup[] = [
  {
    id: 'jobs',
    title: t('Jobbsök', 'Job search'),
    items: [
      {
        id: 'jobs',
        title: t('Jobbassistenten', 'The job assistant'),
        text: JOBS_TEXT,
        href: '#jobs',
      },
    ],
  },
  {
    id: 'platform',
    title: t('Dataplattformen', 'The data platform'),
    items: [
      {
        id: 'platform',
        title: t('Dataplattformen', 'The data platform'),
        text: PLATFORM_TEXT,
        href: '#tech-pipeline',
      },
    ],
  },
  {
    id: 'sweden',
    title: t('SWEDEN', 'SWEDEN'),
    items: [
      {
        id: 'sweden',
        title: t('SWEDEN', 'SWEDEN'),
        text: SWEDEN_TEXT,
        href: '#sweden',
      },
      {
        id: 'meaning',
        title: t('What does it even mean?', 'What does it even mean?'),
        text: t(
          'Ett flöde med alla diagram som plattformens publicerade data räcker till. Varje diagram visar vilken fil och källa det bygger på.',
          'A feed of every chart the platform’s published data supports. Each chart shows the file and the source it is built from.',
        ),
        href: MEANING,
      },
    ],
  },
  {
    id: 'research',
    title: t('Forskning och textlabb', 'Research and text lab'),
    items: [
      registry('ask-the-law'),
      registry('philosophy-atlas'),
      registry('symbolic-atlas'),
      registry('concept-constellation'),
    ],
  },
  {
    id: 'other',
    title: t('Övriga projekt', 'Other projects'),
    items: [
      registry('drugcomb'),
      registry('homie'),
      registry('thesis'),
      repo(
        'swedish-job-market-analytics',
        t('Analys av svenska arbetsmarknaden', 'Swedish job market analytics'),
        t(
          'En dbt-pipeline som gör fyra års platsannonser från Arbetsförmedlingen till trender för yrken, kompetenser och regioner.',
          'A dbt pipeline that turns four years of Arbetsförmedlingen job ads into role, skill and region trends.',
        ),
      ),
      registry('diva-lakehouse'),
    ],
  },
]
