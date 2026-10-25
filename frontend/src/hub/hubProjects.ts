/**
 * The projects in the hub (#projects), in three parts: what runs on the data platform, the
 * experiments and the other projects. The texts come from the project pages, the registry and
 * the start page's earlier project list; `domain` ties a project to its path in the flow.
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
  /** The subject in architecture/graph.json the project is built from (the flow marks its path). */
  domain?: string
}

export type HubGroup = {
  /** The group's address in the hub is #projects-<id>. */
  id: string
  title: Bilingual
  part: 'platform' | 'experiments' | 'other'
  items: HubItem[]
}

export const PARTS: { id: HubGroup['part']; title: Bilingual }[] = [
  {
    id: 'platform',
    title: t('Körs på dataplattformen', 'Running on the data platform'),
  },
  { id: 'experiments', title: t('Experiment', 'Experiments') },
  { id: 'other', title: t('Övriga projekt', 'Other projects') },
]

const registry = (id: string, domain?: string): HubItem => {
  const p = PROJECTS.find((entry) => entry.id === id)!
  return {
    id,
    title: p.title,
    text: p.summary,
    href: p.href,
    domain,
  }
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
    part: 'platform',
    items: [
      {
        id: 'jobs',
        title: t('Arbetsförmedla', 'Arbetsförmedla'),
        text: t(
          'Mitt cv matchat flera gånger om dagen mot aktuella Data/IT-annonser från JobTech. Varje klass säger varför, med annonsens mening och cv-raden bakom. Det stöder mitt beslut; det uppskattar inte chansen att bli anställd.',
          'My CV matched several times a day with current Data/IT ads from JobTech. Each class says why, with the ad sentence and the CV line behind it. It supports my decision; it does not estimate a chance of being hired.',
        ),
        href: '#jobs',
        domain: 'jobs',
      },
    ],
  },
  {
    id: 'replik',
    title: t('Replik', 'Replik'),
    part: 'platform',
    items: [registry('replik')],
  },
  {
    id: 'aiclock',
    title: t('När kommer en lag fram?', 'When does a law arrive?'),
    part: 'platform',
    items: [registry('ai-act-clock')],
  },
  {
    id: 'sweden',
    title: t('SWEDEN', 'SWEDEN'),
    part: 'platform',
    items: [
      {
        id: 'sweden',
        title: t('SWEDEN', 'SWEDEN'),
        text: t(
          'Utvald forskningsplattform: forskningsprodukter om det svenska samhället',
          'Featured research platform: research products on Swedish society',
        ),
        href: '#sweden',
      },
    ],
  },
  {
    id: 'trace',
    title: t('Diagramflöde och spårning', 'Chart feed and trace'),
    part: 'platform',
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
    title: t('Allegora', 'Allegora'),
    part: 'platform',
    items: [registry('ask-the-law')],
  },
  {
    id: 'clusters',
    title: t('Klusterbilder', 'Cluster Visuals'),
    part: 'platform',
    items: [
      {
        id: 'cluster-visuals',
        title: t('Klusterbilder', 'Cluster Visuals'),
        text: t(
          'Alla klustringar på sajten på en sida: Symbollabbet, Filosofilabbet, platsannonser och riksdagsdebatter.',
          'Every clustering on the site on one page: the Symbol Lab, the Philosophy Lab, job ads and Riksdag debates.',
        ),
        href: '#cluster-visuals',
      },
    ],
  },
  {
    id: 'platform',
    title: t('Dataplattformen', 'The data platform'),
    part: 'platform',
    items: [
      {
        id: 'platform',
        title: t('Dataplattformen', 'The data platform'),
        text: t(
          'Offentliga data hämtas på schema, byggs och testas med dbt i brons, silver och guld och släpps till Cloudflare R2.',
          'Public data fetched on a schedule, built and tested with dbt in bronze, silver and gold, and released to Cloudflare R2.',
        ),
        href: '#projects-platform',
      },
    ],
  },
  {
    id: 'research',
    title: t('Experiment', 'Experiments'),
    part: 'experiments',
    items: [
      registry('philosophy-atlas', 'philosophy'),
      registry('symbolic-atlas', 'symbolic'),
      registry('concept-constellation', 'concepts'),
    ],
  },
  {
    id: 'other',
    title: t('Övriga projekt', 'Other projects'),
    part: 'other',
    items: [
      registry('thesis'),
      registry('drugcomb'),
      registry('homie'),
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
