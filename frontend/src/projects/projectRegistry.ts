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
    id: 'politics',
    title: t('Political Observatory', 'Political Observatory'),
    descriptor: t(
      'Öppna data, analytics engineering',
      'Public data, analytics engineering',
    ),
    summary: t(
      'Ett öppet dataprojekt om riksdagen, politikerna och hur Sverige röstar.',
      'An open data project exploring parliamentary data, politicians and how Sweden votes.',
    ),
    question: t(
      'Det är svårt att följa vad politikerna säger, vad de vill lägga pengar på och hur de sedan röstar. Uppgifterna finns, men utspridda i olika källor och format.',
      'It is hard to follow what politicians say, what they want to spend on and how they then vote. The data exists, but spread over sources and formats.',
    ),
    built: t(
      'En sammanhållen produkt ovanpå öppna data från riksdagen, SCB, Valmyndigheten och Regeringskansliet: inläsning, testade dbt-modeller och en webbplats där varje fråga besvaras med en graf.',
      'One product on open data from the Riksdag, SCB, Valmyndigheten and the Government Offices: ingestion, tested dbt models and a site where each question is answered with one chart.',
    ),
    result: t(
      'Voteringar sedan 1993/94, anföranden, budgetförslag, opinionsmätningar och valresultat går att följa parti för parti, med källan ett klick bort.',
      'Roll calls since 1993/94, speeches, budget proposals, polls and election results can be followed party by party, with the source one click away.',
    ),
    tech: [
      'Python',
      'dbt',
      'DuckDB',
      'Parquet',
      'Cloudflare R2',
      'React',
      'TypeScript',
      'NLP',
    ],
    href: '#politik',
    category: 'data',
    status: 'live',
    home: {
      question: t(
        'Vad skiljer partierna åt i praktiken?',
        'What separates the parties in practice?',
      ),
    },
    code: 'https://github.com/korv9/anton-portfolio',
    pages: ['politik'],
  },
  {
    id: 'ai-act',
    title: t('EU AI Act Observatory', 'EU AI Act Observatory'),
    descriptor: t(
      'Juridisk datamodellering, officiella källor',
      'Legal data modelling, official sources',
    ),
    summary: t(
      'Vad EU:s AI-förordning faktiskt innebär för den som bygger eller använder AI, byggt på officiella EU-källor.',
      'What the EU AI Act actually means for organisations building or deploying AI, built from official EU sources.',
    ),
    question: t(
      'Vad innebär EU AI Act faktiskt för organisationer som bygger eller använder AI?',
      'What does the EU AI Act actually mean for organisations building or deploying AI?',
    ),
    built: t(
      'En källspårbar karta över artiklar, skyldigheter, aktörer, tillämpningsdatum och ändringar: lagtexten hämtas från EU:s publikationsbyrå på engelska och svenska, versioneras, tolkas till artiklar i dbt och jämförs mellan 2024 års text och den gällande konsoliderade texten.',
      'A source-traceable map of articles, obligations, actors, application dates and regulatory changes: the text is fetched from the EU Publications Office in English and Swedish, versioned, parsed into articles in dbt and compared between the 2024 text and the current consolidated text.',
    ),
    result: t(
      'Vad som gäller i dag och härnäst, vem som ska göra vad med lagtexten ett klick bort, en navigator för startups och en ändringslogg; ett test kontrollerar att varje citat finns ordagrant i lagen.',
      'What applies today and next, who must do what with the legal text one click away, a startup navigator and a changelog; a test checks that every quote appears verbatim in the Act.',
    ),
    tech: [
      'Python',
      'dbt',
      'DuckDB',
      'Legal data modelling',
      'NLP',
      'Source traceability',
      'React',
    ],
    href: '#ai-act',
    category: 'data',
    status: 'live',
    home: {
      question: t(
        'Vad gäller nu, för vem och när?',
        'What applies now, to whom, and when?',
      ),
    },
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/ai-act.md',
    pages: ['aiact'],
  },
  {
    id: 'sfs',
    title: t('Svensk författningssamling', 'Swedish Statute Book'),
    descriptor: t('Dataprodukt, öppna data', 'Data product, public data'),
    summary: t(
      'Varje författning i Riksdagens SFS-lista, gällande eller upphävd, hämtad som text och delad i paragrafer.',
      'Every statute in the Riksdag’s SFS list, in force or repealed, fetched as text and split into paragraphs.',
    ),
    question: t(
      'Hur stor är svensk lag, och hur mycket av den går att läsa paragraf för paragraf?',
      'How large is Swedish law, and how much of it can be read paragraph by paragraph?',
    ),
    built: t(
      'En hämtning av hela SFS-listan och varje text från Riksdagens öppna data, råkopior i R2 och dbt-modeller från brons till guld som sorterar varje dokument efter typ, daterar upphävandet och delar texten i paragrafer.',
      'A fetch of the whole SFS list and every text from the Riksdag’s open data, raw copies in R2, and dbt models from bronze to gold that sort each document by kind, date its repeal and split the text into paragraphs.',
    ),
    result: t(
      'Lagboken räknad efter typ, utfärdandeår och upphävande, med de största gällande lagarna och längden på varje stycke. Fråga lagen söker fortfarande i 40 utvalda lagar, inte i hela samlingen.',
      'The statute book counted by kind, year of issue and repeal, with the largest laws in force and the length of every passage. Ask the law still searches 40 selected laws, not the whole collection.',
    ),
    tech: ['Python', 'dbt', 'DuckDB', 'Cloudflare R2', 'React', 'TypeScript'],
    href: '#lagboken',
    category: 'data',
    status: 'live',
    home: {
      question: t('Hur stor är svensk lag?', 'How large is Swedish law?'),
    },
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/workers-ai.md',
    pages: ['sfs'],
  },
  {
    id: 'jobs',
    title: t('Labour Market Observatory', 'Labour Market Observatory'),
    descriptor: t(
      'Data engineering, maskininlärning',
      'Data engineering, machine learning',
    ),
    summary: t(
      'Den svenska arbetsmarknaden genom öppna jobbdata, språkmodeller och klustring.',
      'I use open job data, language models and clustering to explore the Swedish job market.',
    ),
    question: t(
      'Hur förändras efterfrågan på olika yrken, och vilka kompetenser efterfrågas?',
      'How does demand for occupations change, and which skills are asked for?',
    ),
    built: t(
      'En pipeline som läser JobTechs annonsarkiv sedan 2020 och bygger en stjärnmodell med tester för korn, referensintegritet och fullständiga månader, plus semantisk klustring av IT-annonser.',
      'A pipeline reading JobTech’s ad archive since 2020 into a star schema tested for grain, referential integrity and complete months, plus semantic clustering of IT ads.',
    ),
    result: t(
      'Annonser per yrke, län och anställningsvillkor över tid, med tydliga definitioner och nedladdningsbara tabeller.',
      'Ads by occupation, county and conditions over time, with clear definitions and downloadable tables.',
    ),
    tech: ['Python', 'dbt Core', 'DuckDB', 'UMAP', 'HDBSCAN', 'GitHub Actions'],
    href: '#jobb',
    category: 'data',
    status: 'live',
    home: {
      question: t(
        'Hur förändras efterfrågan på arbetskraft?',
        'How is demand for labour changing?',
      ),
    },
    code: 'https://github.com/korv9/swedish-job-market-analytics',
    pages: ['jobs'],
  },
  {
    id: 'symbolic-atlas',
    title: t('Symbol Lab', 'Symbol Lab'),
    descriptor: t('NLP, oövervakad inlärning', 'NLP, unsupervised learning'),
    summary: t(
      'En oövervakad utforskning av återkommande symbolisk mening i mytologi, folksagor och litteratur.',
      'An unsupervised exploration of recurring symbolic meaning in mythology, folklore and literature.',
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
    id: 'welfare',
    title: t('Wellbeing Observatory', 'Wellbeing Observatory'),
    descriptor: t('dbt, offentliga data', 'dbt, public data'),
    summary: t(
      'Arbetslöshet, sjukfrånvaro och självrapporterat mående i Sverige, efter period och geografi.',
      'Unemployment, sick leave and self-reported wellbeing in Sweden, by period and geography.',
    ),
    question: t(
      'Följs jobb, sjukskrivningar, hälsa och förtroende åt i olika delar av landet?',
      'Do jobs, sick leave, health and trust move together across Sweden?',
    ),
    built: t(
      'Fem offentliga källor (SCB, Försäkringskassan, Folkhälsomyndigheten, European Social Survey och Kolada) i en testad dbt-stjärnmodell med gemensamma nycklar för region, period, kön och ålder.',
      'Five public sources (SCB, Försäkringskassan, the Public Health Agency, the European Social Survey and Kolada) in a tested dbt star schema with shared keys for region, period, sex and age.',
    ),
    result: t(
      'Län och kommuner kan jämföras sida vid sida i webbläsaren, med en statussida för varje källa och körning.',
      'Counties and municipalities side by side in the browser, with a status page for every source and run.',
    ),
    tech: ['dbt', 'DuckDB', 'Star schema', 'Parquet'],
    href: '#sweden',
    category: 'data',
    status: 'live',
    home: {
      question: t(
        'Hur går det för Sverige, län för län?',
        'How is Sweden doing, county by county?',
      ),
    },
    code: 'https://github.com/korv9/anton-portfolio/tree/main/platform',
    pages: ['welfare'],
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
      'En semantisk atlas över fri filosofi med inbäddningar, klustring och mänskligt granskade begrepp.',
      'A semantic atlas of public-domain philosophy using embeddings, clustering and human-reviewed concepts.',
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
      'Den råa kartan följer verken mer än idéerna; centrering per verk ökar antalet tvärgående grupper från 6 till 19. Inga grupper namnges utan granskning.',
      'The raw map follows the works more than the ideas; centring per work raises the groups across works from 6 to 19. No group is named without review.',
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
      'Korpusarna skiljer sig mer än deras ämnen (93 % av grannarna i samma korpus), så de jämförs bara genom begreppen: död och natur i myterna, omsorg och ansvar i riksdagen, säkerhet och transparens i lagen.',
      'The corpora differ more than their subjects do (93 % of neighbours in the same corpus), so they are compared only through the concepts: death and nature in myth, care and responsibility in the Riksdag, safety and transparency in the law.',
    ),
    home: {
      question: t(
        'Var dyker samma idéer upp i berättelser, filosofi, politik och lag?',
        'Where do the same ideas appear across stories, philosophy, politics and law?',
      ),
    },
    tech: ['Python', 'Sentence Transformers', 'dbt', 'DuckDB', 'React'],
    href: '#concept-journey',
    category: 'ai',
    status: 'experimental',
    research: true,
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/concept-constellation.md',
    pages: ['concepts'],
  },
  {
    id: 'ask-the-law',
    title: t('Fråga lagen', 'Ask the law'),
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
      'Ensemblemetoder och djupinlärning jämförda under fyra sätt att dela upp datan.',
      'Ensemble methods and deep learning compared under four cross-validation strategies.',
    ),
    tech: ['Python', 'scikit-learn', 'LightGBM', 'TensorFlow', 'DuckDB'],
    href: '#drugcomb',
    category: 'ai',
    status: 'live',
    code: 'https://github.com/korv9/DrugComb-Synergy-Prediction',
    pages: ['drugcomb'],
  },

  {
    id: 'diva-lakehouse',
    title: t('DiVA Thesis Lakehouse', 'DiVA Thesis Lakehouse'),
    descriptor: t('Lakehouse i Microsoft Fabric', 'Microsoft Fabric lakehouse'),
    summary: t(
      'Inkrementell inläsning av uppsatsmetadata från DiVA till Bronze, Silver och Gold, med PySpark, Delta MERGE och kvalitetskontroller före publicering.',
      'An incremental pipeline for DiVA thesis metadata, with Bronze, Silver and Gold layers, PySpark, Delta MERGE and quality checks before publishing.',
    ),
    question: t(
      'Hur läser man in metadata som ändras och raderas utan dubletter eller osäkra återkörningar?',
      'How do you ingest changing and deleted metadata without duplicates or unsafe reruns?',
    ),
    built: t(
      'En OAI-PMH-klient, spårbar rå XML, en Delta Lake-pipeline och genererade Fabric-notebooks.',
      'An OAI-PMH client, traceable raw XML, a Delta Lake pipeline and generated Fabric notebooks.',
    ),
    result: t(
      'Verifierad lokalt med Spark och Delta. Körning i Fabric och mot DiVA:s levande endpoint återstår att bekräfta.',
      'Verified locally with Spark and Delta. Execution in Fabric and against the live DiVA endpoint remains to be confirmed.',
    ),
    tech: ['Microsoft Fabric', 'PySpark', 'Delta Lake', 'OAI-PMH', 'Python'],
    href: '#diva-lakehouse',
    pages: ['lakehouse'],
    code: 'https://github.com/korv9/diva-fabric-lakehouse',
    category: 'data',
    status: 'study',
  },
  {
    id: 'homie',
    title: t('Homie API', 'Homie API'),
    descriptor: t('Python-backend, pågående', 'Python backend, in progress'),
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
      'pytest, Ruff, GitHub Actions, Dockerfile i flera steg och Docker Compose.',
      'pytest, Ruff, GitHub Actions, a multi-stage Dockerfile and Docker Compose.',
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
    label: 'Observatories',
    ids: ['politics', 'jobs', 'welfare', 'ai-act', 'sfs'],
  },
  {
    label: 'Labs',
    ids: [
      'symbolic-atlas',
      'philosophy-atlas',
      'concept-constellation',
      'ask-the-law',
      'drugcomb',
    ],
  },
  { label: 'Engineering', ids: ['thesis', 'homie', 'diva-lakehouse'] },
]

/** The project a route belongs to, if any. */
export function projectForRoute(
  route: Pick<Route, 'page' | 'path'>,
): ProjectEntry | undefined {
  return PROJECTS.find(
    (p) => p.pages?.includes(route.page) || (p.paths && p.paths(route.path)),
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
