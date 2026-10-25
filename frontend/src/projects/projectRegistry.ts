/** Project names, descriptions and menu order shared by every site entry point. */
import type { Page, Route } from '../router'

export type Bilingual = { sv: string; en: string }
const t = (sv: string, en: string): Bilingual => ({ sv, en })

export type ProjectStatus = 'live' | 'experimental' | 'in-progress' | 'study'

export type ProjectEntry = {
  id: string
  title: Bilingual
  /** A few words under the title in menus: the kind of work. */
  descriptor: Bilingual
  /** One sentence: what the project is. */
  summary: Bilingual
  /** The question or problem it starts from. */
  question: Bilingual
  /** What was built. */
  built: Bilingual
  /** What it shows or achieved. */
  result: Bilingual
  tech: string[]
  /** Where it opens: a page on this site, an outside repository, or '' for no public page. */
  href: string
  category: 'ai' | 'data'
  status: ProjectStatus
  /**
   * Optional plain-language question and finding, kept alongside the technical description.
   */
  home?: { question: Bilingual }
  /** Exploratory research: listed under Research & experiments, apart from other work. */
  research?: boolean
  code?: string | string[]
  /** A group project: say so. */
  team?: Bilingual
  /** The pages of the site that belong to this project (for the breadcrumb and active state). */
  pages?: Page[]
  /** Addresses of this project that the router gives a page shared with others. */
  paths?: (path: string) => boolean
}

export const PROJECTS: ProjectEntry[] = [
  {
    id: 'replik',
    title: t('Replik', 'Replik'),
    descriptor: t(
      'Riksdagsdata, NLP och voteringar',
      'Riksdag data, NLP and roll calls',
    ),
    summary: t(
      '33 år av partiledardebatter och voteringar i riksdagen, lästa av en maskin: vad partierna talar om, vem som sätter dagordningen och vilka som röstar ihop.',
      '33 years of Riksdag party-leader debates and roll calls, read by machine: what the parties talk about, who sets the agenda, and who votes together.',
    ),
    question: t(
      'Vad talar Sveriges partier om när de möts, och betyder att tala lika att rösta lika?',
      'What do Sweden’s parties talk about when they face each other, and does talking alike mean voting alike?',
    ),
    built: t(
      '108 partiledardebatter 1993–2026 delade i 33 023 inlägg, inbäddade och klustrade i 33 ämnen (UMAP och HDBSCAN, konsensus över 12 frön); 23 024 voteringar över 33 riksmöten; en klassificerare med maskerade partinamn och personvis uppdelning.',
      '108 party-leader debates 1993–2026 split into 33,023 passages, embedded and clustered into 33 topics (UMAP and HDBSCAN, consensus over 12 seeds); 23,024 roll calls over 33 sessions; a classifier with party names masked and a person-grouped split.',
    ),
    result: t(
      'SD ägde migrationsfrågan på 2010-talet; energin tog över debatterna 2022; partiernas språk blev lättare att skilja åt 2006. Att tala lika säger inget om att rösta lika.',
      'SD owned migration in the 2010s; energy took over the debates in 2022; party language became easier to tell apart in 2006. Talking alike says nothing about voting alike.',
    ),
    tech: [
      'Python',
      'dbt',
      'sentence-transformers',
      'UMAP',
      'HDBSCAN',
      'scikit-learn',
      'React',
    ],
    href: '#replik',
    category: 'data',
    status: 'live',
    pages: ['replik'],
  },
  {
    id: 'symbolic-atlas',
    title: t('Symbol Lab', 'Symbol Lab'),
    descriptor: t('NLP, oövervakad inlärning', 'NLP, unsupervised learning'),
    summary: t(
      'En oövervakad utforskning av återkommande symboliska sammanhang i mytologi, folksagor och litteratur.',
      'An unsupervised exploration of recurring symbolic contexts in mythology, folklore and literature.',
    ),
    question: t(
      'Kan symbolisk mening träda fram ur datan utan att kategorierna bestäms först?',
      'Can symbolic meaning emerge from the data without defining the categories first?',
    ),
    built: t(
      'Fria böcker indexeras efter symbolförekomster. Sentence Transformers skapar inbäddningar; UMAP och HDBSCAN projicerar och klustrar dem. dbt och DuckDB organiserar datan, med bokcentrerade experiment som jämför delat språk och bokspecifika mönster.',
      'Public-domain books indexed by symbol occurrence. Sentence Transformers embeds the texts, UMAP projects them and HDBSCAN forms clusters. dbt and DuckDB organize the data; book-centred experiments compare shared language with book-specific patterns.',
    ),
    result: t(
      'En interaktiv karta med numrerade kluster; experimenten visar att klustren följer böckerna mer än symbolerna och hur mycket det går att minska.',
      'An interactive map with numbered clusters; the experiments show the clusters follow books more than symbols, and how far that can be reduced.',
    ),
    tech: [
      'Python',
      'NLP',
      'Sentence Transformers',
      'UMAP',
      'HDBSCAN',
      'dbt',
      'DuckDB',
    ],
    href: '#symbolic-atlas',
    category: 'ai',
    status: 'experimental',
    home: {
      question: t(
        'Återkommer symboliska sammanhang i olika berättelser och traditioner?',
        'Do symbolic contexts recur across stories and traditions?',
      ),
    },
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/symbolic-atlas.md',
    pages: ['symbolic'],
  },
  {
    id: 'thesis',
    title: t('IT Incident Clustering', 'IT Incident Clustering'),
    descriptor: t('NLP, fallstudie hos Fora AB', 'NLP, case study at Fora AB'),
    summary: t(
      'Anton grupperade liknande IT-supportärenden för att ge IT-teamet ett underlag för utredning av återkommande fel.',
      'I grouped similar IT support tickets to help the IT team investigate recurring faults.',
    ),
    question: t(
      'Hur hittar IT-teamet återkommande fel bland tusentals enskilda supportärenden?',
      'How can the IT team find recurring faults among thousands of individual support tickets?',
    ),
    built: t(
      'Datakvalitetsanalys av 21 633 incidentposter och ett NLP-flöde i Azure Databricks. Den rensade korpusen hade 19 847 unika incidenter; den valda klustringen använde 16 811.',
      'Data quality analysis of 21,633 incident records and an NLP pipeline in Azure Databricks. The cleaned corpus had 19,847 unique incidents; the selected clustering run used 16,811.',
    ),
    result: t(
      '121 grupper av liknande ärenden, varav 72 saknade befintlig problemkoppling. De är granskningskandidater, inte bevisade rotorsaker. Källärendena är privata.',
      '121 groups of similar tickets, of which 72 lacked an existing problem link. They are review candidates, not proven root causes. Source tickets are private.',
    ),
    tech: [
      'Python',
      'Databricks',
      'sentence-transformers',
      'UMAP',
      'HDBSCAN',
      'MLflow',
    ],
    href: '#thesis',
    category: 'ai',
    status: 'live',
    pages: ['thesis'],
  },
  {
    id: 'philosophy-atlas',
    title: t('Philosophy Lab', 'Philosophy Lab'),
    descriptor: t('NLP, semantisk utforskning', 'NLP, semantic exploration'),
    summary: t(
      'En semantisk atlas över fri filosofi med inbäddningar och klustring, korrigerad för varje verks egen röst.',
      'A semantic atlas of public-domain philosophy using embeddings and clustering, corrected for each work’s own voice.',
    ),
    question: t(
      'Hur organiserar återkommande moraliska och filosofiska spänningar texter över tänkare och traditioner?',
      'How do recurring moral and philosophical tensions organise texts across thinkers and traditions?',
    ),
    built: t(
      'Tretton verk från Platon till Nietzsche, rensade från översättares inledningar och noter, indelade i passager, inbäddade med en flerspråkig modell, kartlagda med UMAP och HDBSCAN och lästa genom spänningar som frihet ↔ kontroll.',
      'Thirteen works from Plato to Nietzsche, stripped of translators’ introductions and notes, cut into passages, embedded with a multilingual model, mapped with UMAP and HDBSCAN and read through tensions such as freedom ↔ control.',
    ),
    result: t(
      'Den råa kartan följer verken mer än idéerna; centrering per verk ökar antalet tvärgående grupper från 6 till 19. Varje grupp visas med sina mest utmärkande ord.',
      'The raw map follows the works more than the ideas; centring per work raises the groups across works from 6 to 19. Each group is shown by its most distinctive words.',
    ),
    tech: [
      'Python',
      'Sentence Transformers',
      'UMAP',
      'HDBSCAN',
      'dbt',
      'DuckDB',
    ],
    href: '#philosophy-atlas',
    category: 'ai',
    status: 'experimental',
    research: true,
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/philosophy-atlas.md',
    pages: ['philosophy'],
  },
  {
    id: 'concept-constellation',
    title: t('Concept Lab', 'Concept Lab'),
    descriptor: t('NLP, betydelseatlas', 'NLP, meaning atlas'),
    summary: t(
      'Samma idéer genom myter, filosofi, riksdagstal och AI-förordningen, med en modell och redaktionellt valda begrepp.',
      'The same ideas across myth, philosophy, Riksdag speeches and the AI Act, with one model and editorially chosen concepts.',
    ),
    question: t(
      'Var dyker samma idéer upp när de rör sig från berättelser till filosofi, politik och lag?',
      'Where do the same ideas appear as they move from stories to philosophy, politics and law?',
    ),
    built: t(
      'Ett balanserat urval ur fyra korpusar med full härkomst, inbäddat med en flerspråkig modell och läst mot 28 begrepp med ankarmeningar på svenska och engelska; varje relation har en uttalad typ.',
      'A balanced sample of four corpora with full provenance, embedded with one multilingual model and read against 28 concepts with anchor sentences in Swedish and English; every relation has a stated type.',
    ),
    result: t(
      'Korpusarna skiljer sig mer än deras ämnen (93 % av grannarna i samma korpus, delvis en språkeffekt eftersom riksdagen är den enda svenska), så de jämförs bara genom begreppen: död och natur i myterna, omsorg och ansvar i riksdagen, säkerhet och transparens i lagen.',
      'The corpora differ more than their subjects do (93 % of neighbours in the same corpus, partly a language effect since the Riksdag is the only Swedish one), so they are compared only through the concepts: death and nature in myth, care and responsibility in the Riksdag, safety and transparency in the law.',
    ),
    home: {
      question: t(
        'Var dyker samma idéer upp i berättelser, filosofi, politik och lag?',
        'Where do the same ideas appear across stories, philosophy, politics and law?',
      ),
    },
    tech: ['Python', 'Sentence Transformers', 'dbt', 'DuckDB', 'React'],
    href: '#concepts-profiles',
    category: 'ai',
    status: 'experimental',
    research: true,
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/concept-constellation.md',
    pages: ['concepts'],
  },
  {
    id: 'ask-the-law',
    title: t('Allegora', 'Allegora'),
    descriptor: t(
      'Workers AI, sökning med kontrollerade citat',
      'Workers AI, search with checked quotes',
    ),
    summary: t(
      'Frågor över ett urval av svenska lagar och EU:s AI-förordning, besvarade med citat som kontrolleras ord för ord mot lagtexten.',
      'Questions over a selection of Swedish statutes and the EU AI Act, answered with quotes checked word for word against the legal text.',
    ),
    question: t(
      'Kan en språkmodell svara på frågor om lagtext utan att hitta på citat, på en gratisplan?',
      'Can a language model answer questions on legal text without inventing quotes, on a free plan?',
    ),
    built: t(
      'Paragrafer inbäddade offline med bge-m3 och komprimerade till int8; sökningen körs i webbläsaren. En Cloudflare Worker bäddar in frågan, kontrollerar att de skickade paragraferna är publicerad lagtext och låter en modell svara med citat.',
      'Paragraphs embedded offline with bge-m3 and compressed to int8; the search runs in the browser. A Cloudflare Worker embeds the question, checks that the passages sent are published legal text, and has a model answer with quotes.',
    ),
    result: t(
      'Varje citat i ett svar kontrolleras mot sin paragraf innan svaret visas. Ett svar som inte klarar kontrollen visas inte, bara de hittade paragraferna.',
      'Every quote in an answer is checked against its paragraph before the answer is shown. An answer that fails the check is withheld, and only the paragraphs found are shown.',
    ),
    tech: ['Cloudflare Workers AI', 'bge-m3', 'TypeScript', 'React', 'Python'],
    href: '#fraga-lagen',
    category: 'ai',
    status: 'experimental',
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/workers-ai.md',
    pages: ['lawqa'],
  },
  {
    id: 'drugcomb',
    title: t('Drug Synergy Lab', 'Drug Synergy Lab'),
    descriptor: t('Multimodal maskininlärning', 'Multimodal machine learning'),
    summary: t(
      'Molekylfingeravtryck, RNA-uttryck och cellinjedata kombinerade för att förutsäga synergi, med skydd mot dataläckage.',
      'Drug fingerprints, RNA expression and cell-line data combined to predict synergy, with leakage prevention.',
    ),
    question: t(
      'Fungerar en modell som förutsäger synergi mellan läkemedel även på par, läkemedel och cellinjer den inte sett?',
      'Does a model predicting drug synergy still work on pairs, drugs and cell lines it has not seen?',
    ),
    built: t(
      'Matchning av läkemedel och cellinjer, ett DuckDB-lager och utvärdering med fyra olika sätt att dela upp datan.',
      'Drug and cell-line entity resolution, a DuckDB warehouse and evaluation under four cross-validation strategies.',
    ),
    result: t(
      'LightGBM mot enkla baslinjer, utvärderad på par, läkemedel och cellinjer som modellen inte sett.',
      'LightGBM against simple baselines, evaluated on pairs, drugs and cell lines the model has not seen.',
    ),
    tech: ['Python', 'scikit-learn', 'LightGBM', 'DuckDB'],
    href: '#drugcomb',
    category: 'ai',
    status: 'live',
    code: 'https://github.com/korv9/DrugComb-Synergy-Prediction',
    pages: ['drugcomb'],
  },

  {
    id: 'platform',
    title: t('Dataplattformen', 'The data platform'),
    descriptor: t(
      'dbt, DuckDB, GitHub Actions, R2',
      'dbt, DuckDB, GitHub Actions, R2',
    ),
    summary: t(
      'Offentlig data hämtas på schema, byggs och testas med dbt i bronze, silver och gold och släpps till Cloudflare R2 när alla kontroller har gått igenom. Samma mönster finns i Microsoft Fabric för DiVA.',
      'Public data fetched on a schedule, built and tested with dbt in bronze, silver and gold, and released to Cloudflare R2 once every check has passed. The same pattern runs on Microsoft Fabric for DiVA.',
    ),
    question: t(
      'Hur håller man många offentliga källor färska utan att publicera en felaktig siffra?',
      'How do you keep many public sources fresh without publishing a wrong number?',
    ),
    built: t(
      'Python-hämtning med proveniens, dbt-modeller med kontrakt och tester, schemalagda körningar i GitHub Actions och releaser till R2.',
      'Python ingestion with provenance, dbt models with contracts and tests, scheduled runs in GitHub Actions and releases to R2.',
    ),
    result: t(
      'Levande körstatus, 30 dagars körhistorik med orsaken till varje röd körning och incidentrapporter.',
      'Live run status, 30 days of run history with the cause of each red run, and incident reports.',
    ),
    tech: [
      'dbt',
      'DuckDB',
      'Python',
      'GitHub Actions',
      'Cloudflare R2',
      'Microsoft Fabric',
    ],
    href: '#projects-platform',
    code: [
      'https://github.com/korv9/anton-portfolio',
      'https://github.com/korv9/diva-fabric-lakehouse',
    ],
    category: 'data',
    status: 'live',
  },
  {
    id: 'homie',
    title: t('Homie API', 'Homie API'),
    descriptor: t(
      'Python-backend, kontrakt först',
      'Python backend, contract first',
    ),
    summary: t(
      'FastAPI- och PostgreSQL-tjänst med autentisering, migreringar och ett OpenAPI-kontrakt för en separat frontend.',
      'FastAPI and PostgreSQL service with authentication, migrations and an OpenAPI contract for a separate frontend.',
    ),
    question: t(
      'Ett backend-API som en separat frontend kan lita på.',
      'A backend API a separate frontend can rely on.',
    ),
    built: t(
      'FastAPI- och PostgreSQL-tjänst med autentisering, migreringar och ett OpenAPI-kontrakt.',
      'FastAPI and PostgreSQL service with authentication, migrations and an OpenAPI contract.',
    ),
    result: t(
      '16 operationer i OpenAPI-kontraktet, 4 byggda; testerna går igenom i CI mot PostgreSQL 16.',
      '16 operations in the OpenAPI contract, 4 built; the tests pass in CI against PostgreSQL 16.',
    ),
    tech: ['FastAPI', 'PostgreSQL', 'SQLAlchemy', 'Alembic', 'Docker Compose'],
    href: '#homie',
    category: 'data',
    status: 'in-progress',
    code: 'https://github.com/korv9/homie-api',
    pages: ['homie'],
  },
]

export const PROJECT_GROUPS = [
  {
    label: 'Labs',
    ids: [
      'symbolic-atlas',
      'philosophy-atlas',
      'concept-constellation',
      'ask-the-law',
      'drugcomb',
      'replik',
    ],
  },
  { label: 'Engineering', ids: ['thesis', 'homie', 'platform'] },
]

/** Public project listings; the thesis remains available through Education and its URL. */
export const LISTED_PROJECTS = ['Engineering', 'Labs'].flatMap((label) =>
  PROJECT_GROUPS.find((group) => group.label === label)!
    .ids.filter((id) => id !== 'thesis')
    .map((id) => PROJECTS.find((project) => project.id === id)!),
)

/** The project a route belongs to, if any. */
export function projectForRoute(
  route: Pick<Route, 'page' | 'path'>,
): ProjectEntry | undefined {
  return (
    PROJECTS.find((p) => p.paths?.(route.path)) ??
    PROJECTS.find((p) => p.pages?.includes(route.page))
  )
}

/** Previous and next project in menu order, without wrapping. */
export function neighbours(id: string): {
  previous?: ProjectEntry
  next?: ProjectEntry
} {
  const ordered = PROJECT_GROUPS.flatMap((group) => group.ids).map((id) =>
    PROJECTS.find((p) => p.id === id)!,
  )
  const i = ordered.findIndex((p) => p.id === id)
  if (i < 0) return {}
  return { previous: ordered[i - 1], next: ordered[i + 1] }
}
