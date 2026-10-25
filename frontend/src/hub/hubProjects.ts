/**
 * The projects in the hub (#projects), grouped as its sidebar shows them. The texts come from the
 * project pages, the registry and the start page's earlier project list. `domain` names the
 * subject in architecture/graph.json a project is built from and `fresh` its key in
 * meaning/freshness.ts; the hub reads both to show what each project runs on.
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
  domain?: string
  fresh?: string
  /** What the freshness line is about, when it is narrower than the project's data. */
  data?: Bilingual
  /** The project's own run in status/ingestion.json, if it has one. */
  run?: string
}

export type HubGroup = {
  /** The group's address in the hub is #projects-<id>. */
  id: string
  title: Bilingual
  items: HubItem[]
}

const registry = (id: string, domain?: string): HubItem => {
  const p = PROJECTS.find((entry) => entry.id === id)!
  return { id, title: p.title, text: p.summary, href: p.href, domain }
}

const repo = (name: string, title: Bilingual, text: Bilingual): HubItem => ({
  id: name,
  title,
  text,
  href: `https://github.com/korv9/${name}`,
})

export const HUB_GROUPS: HubGroup[] = [
  {
    id: 'jobs',
    title: t('Jobbsök', 'Job search'),
    items: [
      {
        id: 'jobs',
        title: t('Jobbassistenten', 'The job assistant'),
        text: t(
          'Mitt cv matchat varje timme mot aktuella Data/IT-annonser från JobTech. Varje klass säger varför, med annonsens mening och cv-raden bakom. Det stöder mitt beslut; det uppskattar inte chansen att bli anställd.',
          'My CV matched every hour with current Data/IT ads from JobTech. Each class says why, with the ad sentence and the CV line behind it. It supports my decision; it does not estimate a chance of being hired.',
        ),
        href: '#jobs',
        domain: 'jobs',
        fresh: 'jobs',
        data: t('annonsdatan', 'job ads data'),
        run: 'job_assistant',
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
        text: t(
          'Utvald forskningsplattform: forskningsprodukter om det svenska samhället',
          'Featured research platform: research products on Swedish society',
        ),
        href: '#sweden',
        fresh: 'sweden',
      },
    ],
  },
  {
    id: 'trace',
    title: t('Diagramflöde och spårning', 'Chart feed and trace'),
    items: [
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
    id: 'law',
    title: t('Fråga lagen', 'Ask the law'),
    items: [registry('ask-the-law')],
  },
  {
    id: 'research',
    title: t('Forskning och textlabb', 'Research and text lab'),
    items: [
      registry('philosophy-atlas', 'philosophy'),
      registry('symbolic-atlas', 'symbolic'),
      registry('concept-constellation', 'concepts'),
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
      repo(
        'diva-fabric-lakehouse',
        t('DiVA-lakehouse i Fabric', 'DiVA Fabric lakehouse'),
        t(
          'Ett inkrementellt lakehouse i Microsoft Fabric för metadata om uppsatser i DiVA, med karantän och kvalitetskontroller. Omkörningar ger inga dubbletter.',
          'An incremental Microsoft Fabric lakehouse for DiVA thesis metadata, with quarantine and quality gates. Re-runs add no duplicates.',
        ),
      ),
    ],
  },
]
