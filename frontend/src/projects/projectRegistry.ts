/**
 * Every project on the site, once. The header's project menu, the start page's selected work,
 * the projects page, the footer, the breadcrumb on a project page and its previous / next links
 * are all generated from this list, so a project's name, order, category and address live here
 * only.
 *
 * Flagship projects carry a number and are listed in their order; the rest are other work.
 * Every flagship is described in the same grammar: question, what was built, result, key tech.
 * Facts come from the CVs and the project pages; nothing here is new.
 */
import type { Page, Route } from '../router'

export type Bilingual = { sv: string; en: string }
const t = (sv: string, en: string): Bilingual => ({ sv, en })

export type ProjectStatus = 'live' | 'experimental' | 'in-progress' | 'study'

export type ProjectNavItem = { href: string; label: Bilingual }

export type ProjectEntry = {
  id: string
  /** '01'–'06' for flagship projects, in display order. */
  number?: string
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
  featured: boolean
  /**
   * On the start page: the project's one question, its finding in a sentence a recruiter
   * understands without the method, and the few tools that prove it (secondary). Only
   * projects with this field appear there, in registry order.
   */
  home?: { question: Bilingual; finding: Bilingual; tech: string[] }
  /** Exploratory research: listed under Research & experiments, apart from other work. */
  research?: boolean
  code?: string | string[]
  /** A group project: say so. */
  team?: Bilingual
  /** The pages of the site that belong to this project (for the breadcrumb and active state). */
  pages?: Page[]
  /** Addresses of this project that the router gives a page shared with others. */
  paths?: (path: string) => boolean
  /** The project's own navigation, shown inside the project only. */
  nav?: ProjectNavItem[]
}

export const PROJECTS: ProjectEntry[] = [
  {
    id: 'politics',
    number: '01',
    title: t('Svensk politik i siffror', 'Swedish politics in numbers'),
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
    featured: true,
    home: {
      question: t(
        'Vad skiljer partierna åt i praktiken?',
        'What separates the parties in practice?',
      ),
      finding: t(
        'Voteringar sedan 1993/94, budgetmotioner, tal och val visar var partierna faktiskt skiljer sig, med källan ett klick bort.',
        'Roll calls since 1993/94, budget motions, speeches and elections show where the parties actually differ, with the source one click away.',
      ),
      tech: ['Python', 'dbt', 'DuckDB', 'React'],
    },
    code: 'https://github.com/korv9/anton-portfolio',
    pages: ['politik'],
  },
  {
    id: 'ai-act',
    number: '02',
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
    featured: true,
    home: {
      question: t(
        'Vad gäller nu, för vem och när?',
        'What applies now, to whom, and when?',
      ),
      finding: t(
        'Varje skyldighet länkar tillbaka till artikeln som anger den, och systemet följer de officiella ändringarna över tid.',
        'Every obligation links back to the article that defines it, and the system tracks official changes over time.',
      ),
      tech: ['Python', 'dbt', 'DuckDB', 'NLP'],
    },
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/ai-act.md',
    pages: ['aiact'],
    nav: [
      { href: '#ai-act', label: t('Översikt', 'Overview') },
      {
        href: '#ai-act-today',
        label: t('Vad gäller i dag?', 'What applies today?'),
      },
      {
        href: '#ai-act-roles',
        label: t('Vem berörs?', 'Who does it apply to?'),
      },
      {
        href: '#ai-act-startups',
        label: t('Startup-navigator', 'Startup navigator'),
      },
      { href: '#ai-act-timeline', label: t('Tidslinje', 'Timeline') },
      { href: '#ai-act-obligations', label: t('Skyldigheter', 'Obligations') },
      { href: '#ai-act-risk', label: t('Riskklasser', 'Risk classes') },
      { href: '#ai-act-changes', label: t('Ändringar', 'Changes') },
      { href: '#ai-act-politics', label: t('I riksdagen', 'In the Riksdag') },
      { href: '#ai-act-jobs', label: t('I jobbannonserna', 'In job ads') },
      {
        href: '#ai-act-signals',
        label: t('Tidslinje: lag, politik, jobb', 'Law, politics, jobs'),
      },
      { href: '#ai-act-sources', label: t('Källor', 'Sources') },
    ],
  },
  {
    id: 'jobs',
    number: '03',
    title: t('Arbetsmarknaden i jobbannonser', 'The job market in job ads'),
    descriptor: t(
      'Data engineering, maskininlärning',
      'Data engineering, machine learning',
    ),
    summary: t(
      'Den svenska arbetsmarknaden genom öppna jobbdata, språkmodeller och klustring.',
      'The Swedish job market through open job data, language models and clustering.',
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
    featured: true,
    home: {
      question: t(
        'Hur förändras efterfrågan på arbetskraft?',
        'How is demand for labour changing?',
      ),
      finding: t(
        'Nästan fem miljoner annonser sedan 2020, jämförda med samma månader året innan, och en klustring som visar grupper bortom yrkestitlarna.',
        'Nearly five million ads since 2020, compared with the same months a year earlier, and a clustering that finds groups beyond job titles.',
      ),
      tech: ['Python', 'dbt', 'DuckDB', 'GitHub Actions'],
    },
    code: 'https://github.com/korv9/swedish-job-market-analytics',
    pages: ['jobs'],
  },
  {
    id: 'symbolic-atlas',
    number: '04',
    title: t('Symbolic Atlas', 'Symbolic Atlas'),
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
      'Tio fria böcker, symbolord i sitt sammanhang, meningsinbäddningar, UMAP och HDBSCAN, byggt i dbt och DuckDB, med experiment som skiljer symbol från bok.',
      'Ten public-domain books, symbol words in context, sentence embeddings, UMAP and HDBSCAN, built in dbt and DuckDB, with experiments separating symbol from book.',
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
    featured: true,
    home: {
      question: t(
        'Återkommer symboliska sammanhang i olika berättelser och traditioner?',
        'Do symbolic contexts recur across stories and traditions?',
      ),
      finding: t(
        'Den första modellen grupperade böckerna starkare än den symboliska meningen; fyra versioner senare finns en mindre men verklig struktur över böckerna.',
        'The first model clustered books more strongly than symbolic meaning; four versions later a smaller but real cross-book structure remains.',
      ),
      tech: ['Python', 'NLP', 'UMAP', 'HDBSCAN'],
    },
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/symbolic-atlas.md',
    pages: ['symbolic'],
    nav: [
      { href: '#symbolic-atlas', label: t('Atlas', 'Atlas') },
      { href: '#symbolic-findings', label: t('Fynd', 'Findings') },
      { href: '#symbolic-experiments', label: t('Experiment', 'Experiments') },
      { href: '#symbolic-method', label: t('Metod', 'Method') },
    ],
  },
  {
    id: 'welfare',
    number: '05',
    title: t('Hur mår Sverige?', 'How is Sweden doing?'),
    descriptor: t('dbt, offentliga data', 'dbt, public data'),
    summary: t(
      'Jobb, hälsa och förtroende i Sverige, utforskade genom fem offentliga datakällor.',
      'Jobs, health and trust across Sweden, explored through five public data sources.',
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
    featured: true,
    home: {
      question: t(
        'Hur går det för Sverige, län för län?',
        'How is Sweden doing, county by county?',
      ),
      finding: t(
        'Arbetslöshet, sjukskrivning och psykisk påfrestning från fem öppna källor på samma axel; mönstren är beskrivande, inte orsaker.',
        'Unemployment, sick leave and mental strain from five public sources on one axis; the patterns are descriptive, not causes.',
      ),
      tech: ['dbt', 'DuckDB', 'Star schema', 'Parquet'],
    },
    code: 'https://github.com/korv9/anton-portfolio/tree/main/platform',
    pages: ['welfare'],
  },
  {
    id: 'thesis',
    number: '06',
    title: t(
      'Examensarbete: NLP-klustring av IT-incidenter',
      'Degree project: NLP clustering of IT incidents',
    ),
    descriptor: t('NLP, klustring, Avtalat', 'NLP, clustering, Avtalat'),
    summary: t(
      'Hitta grupper av relaterade incidenter i IT-servicedata för manuell granskning.',
      'Finding groups of related incidents in IT service data for manual review.',
    ),
    question: t(
      'Liknande incidenter kan dela ett problem innan någon kopplar ihop dem.',
      'Similar incidents may share a problem before anyone links them.',
    ),
    built: t(
      'Ett reproducerbart flöde för datakvalitet enligt ISO/IEC 25012, anonymisering, inbäddningar och klustring i Azure Databricks, på 21 000+ riktiga produktionsincidenter.',
      'A reproducible workflow for ISO/IEC 25012 data quality, anonymisation, embeddings and clustering in Azure Databricks, on 21,000+ real production incidents.',
    ),
    result: t(
      '72 möjliga problemposter och bättre klusterkvalitet än K-means. Interna källposter är inte offentliga.',
      '72 potential problem records and better cluster quality than K-means. Internal source records are not public.',
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
    featured: true,
    pages: ['thesis'],
  },
  {
    id: 'philosophy-atlas',
    title: t('Philosophy Atlas', 'Philosophy Atlas'),
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
    featured: false,
    research: true,
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/philosophy-atlas.md',
    pages: ['philosophy'],
    nav: [
      { href: '#philosophy-atlas', label: t('Karta', 'Map') },
      { href: '#philosophy-groups', label: t('Grupper', 'Groups') },
      { href: '#philosophy-tensions', label: t('Spänningar', 'Tensions') },
      { href: '#philosophy-works', label: t('Korpus', 'Corpus') },
      { href: '#philosophy-method', label: t('Metod', 'Method') },
    ],
  },
  {
    id: 'concept-constellation',
    title: t('Concept Constellation', 'Concept Constellation'),
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
      finding: t(
        'Korpusarna är väldigt olika, så projektet jämför dem genom redaktionellt valda begrepp i stället för att låtsas att de hör hemma i ett naturligt kluster.',
        'The corpora are very different, so the project compares them through editorially chosen concepts rather than pretending they belong in one natural cluster.',
      ),
      tech: ['Python', 'NLP', 'dbt', 'DuckDB'],
    },
    tech: ['Python', 'Sentence Transformers', 'dbt', 'DuckDB', 'React'],
    href: '#concept-journey',
    category: 'ai',
    status: 'experimental',
    featured: false,
    research: true,
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/concept-constellation.md',
    pages: ['concepts'],
    nav: [
      {
        href: '#concept-journey',
        label: t('Följ en idé', 'Follow an idea'),
      },
      {
        href: '#concept-constellation',
        label: t('Konstellation', 'Constellation'),
      },
      { href: '#concepts-profiles', label: t('Profiler', 'Profiles') },
      { href: '#concepts-method', label: t('Metod', 'Method') },
    ],
  },
  {
    id: 'drugcomb',
    title: t(
      'DrugComb: förutsäga läkemedelssynergi',
      'DrugComb: predicting drug synergy',
    ),
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
    featured: false,
    code: 'https://github.com/korv9/DrugComb-Synergy-Prediction',
    pages: ['drugcomb'],
  },

  {
    id: 'allegoria',
    title: t('Allegoria / RFC-drift', 'Allegoria / RFC drift'),
    descriptor: t('NLP, pågående', 'NLP, in progress'),
    summary: t(
      'Vad händer med innebörden när ett krav går från MUST till SHOULD?',
      'What changes when a requirement goes from MUST to SHOULD?',
    ),
    question: t(
      'Vad händer med innebörden när ett krav går från MUST till SHOULD?',
      'What changes when a requirement goes from MUST to SHOULD?',
    ),
    built: t('Pågående.', 'In progress.'),
    result: t('Pågående.', 'In progress.'),
    tech: ['Python', 'NLP'],
    href: '#rfc-drift',
    category: 'ai',
    status: 'in-progress',
    featured: false,
    research: true,
    pages: ['allegoria'],
  },
  {
    id: 'diva',
    title: t('Uppsatser i DiVA', 'Theses in DiVA'),
    descriptor: t('Ämnesklustring', 'Topic clustering'),
    summary: t(
      'Svenska studentuppsatser från DiVA i ämneskluster, varje kluster namngivet av sina egna ord.',
      'Swedish student theses from DiVA in topic clusters, each cluster named by its own words.',
    ),
    question: t(
      'Vilka ämnen skriver svenska studenter om, och hur grupperar de sig?',
      'What do Swedish students write about, and how do the topics group?',
    ),
    built: t(
      'Inläsning via OAI-PMH, TF-IDF, SVD och K-means med klassbaserad TF-IDF för klustrens ord.',
      'Harvesting through OAI-PMH, TF-IDF, SVD and K-means with class-based TF-IDF for the clusters’ words.',
    ),
    result: t(
      'En karta över uppsatserna per kluster när inläsningen har körts.',
      'A map of the theses by cluster once the harvest has run.',
    ),
    tech: ['Python', 'OAI-PMH', 'scikit-learn', 'GitHub Actions'],
    href: '#diva',
    category: 'ai',
    status: 'experimental',
    featured: false,
    pages: ['diva'],
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
    featured: false,
    code: 'https://github.com/korv9/homie-api',
    pages: ['homie'],
  },
  {
    id: 'rag',
    title: t('RAG-baserad studieassistent', 'RAG learning assistant'),
    descriptor: t(
      'Tillämpad generativ AI, studieprojekt',
      'Applied generative AI, study project',
    ),
    summary: t(
      'Flask-backend som läser in dokument, skapar inbäddningar och ger förankrade svar, semantisk sökning och quiz.',
      'Flask backend ingesting documents, creating embeddings and giving grounded answers, semantic search and quizzes.',
    ),
    question: t(
      'Hjälp att studera ur eget kursmaterial.',
      'Help studying from one’s own course material.',
    ),
    built: t(
      'Inläsning av dokument, inbäddningar, förankrade svar, semantisk sökning och quiz.',
      'Document ingestion, embeddings, grounded answers, semantic search and quizzes.',
    ),
    result: t(
      'Integrerad med Vertex AI, Google Cloud Storage och ett React-gränssnitt.',
      'Integrated with Vertex AI, Google Cloud Storage and a React interface.',
    ),
    tech: ['Python', 'Flask', 'Vertex AI', 'RAG', 'React'],
    // The repository is not public, so the project links nowhere.
    href: '',
    category: 'ai',
    status: 'study',
    featured: false,
  },
  {
    id: 'mimii',
    title: t(
      'Avvikelser i industripumpar',
      'Industrial pump anomaly detection',
    ),
    descriptor: t(
      'Djupinlärning på MIMII, studieprojekt',
      'Deep learning on MIMII, study project',
    ),
    summary: t(
      'Pumpljud omvandlade till mel-spektrogram och en CNN-klassificerare för att hitta avvikande ljud.',
      'Pump audio turned into Mel spectrograms and a CNN classifier to detect anomalous sounds.',
    ),
    question: t(
      'Kan avvikande pumpljud hittas automatiskt?',
      'Can anomalous pump sounds be found automatically?',
    ),
    built: t(
      'Mel-spektrogram och en CNN-klassificerare.',
      'Mel spectrograms and a CNN classifier.',
    ),
    result: t(
      'Utvärderad med ROC-AUC och förväxlingsmatris; överanpassning styrd med dropout och L2.',
      'Evaluated with ROC-AUC and a confusion matrix; overfitting controlled with dropout and L2.',
    ),
    tech: ['Python', 'TensorFlow', 'Keras', 'CNN', 'librosa'],
    href: 'https://github.com/korv9/MIMII-pump-diagnostics',
    category: 'ai',
    status: 'study',
    featured: false,
    code: 'https://github.com/korv9/MIMII-pump-diagnostics',
  },
]

/**
 * The site sidebar's groups, in reading order. Titles, addresses and views come from the entries
 * above; only the grouping and order live here.
 */
export const SIDEBAR_GROUPS: {
  id: string
  label: Bilingual
  projects: string[]
}[] = [
  {
    id: 'experience',
    label: t('Erfarenhet', 'Experience'),
    projects: ['thesis'],
  },
  {
    id: 'projects',
    label: t('Projekt', 'Projects'),
    projects: ['politics', 'ai-act', 'jobs', 'welfare', 'symbolic-atlas'],
  },
  {
    id: 'more',
    label: t('Fler projekt', 'More projects'),
    projects: [
      'philosophy-atlas',
      'concept-constellation',
      'drugcomb',
      'diva',
      'homie',
      'allegoria',
      'rag',
      'mimii',
    ],
  },
]

/** The platform pages under the projects: the data platform the projects share. */
export const PLATFORM_PAGES: {
  id: string
  title: Bilingual
  href: string
  pages: Page[]
}[] = [
  {
    id: 'quality',
    title: t('Datakvalitet', 'Data quality'),
    href: '#quality',
    pages: ['quality'],
  },
  {
    id: 'datamodel',
    title: t('Datamodell och ER', 'Data model and ER'),
    href: '#data-model',
    pages: ['datamodel', 'er'],
  },
  {
    id: 'architecture',
    title: t('Arkitektur', 'Architecture'),
    href: '#data-constellation',
    pages: ['constellation'],
  },
  {
    id: 'catalogue',
    title: t('Datakatalog', 'Data catalogue'),
    href: '#data-catalogue',
    pages: ['catalogue'],
  },
  {
    id: 'lineage',
    title: t('Idea Lineage', 'Idea Lineage'),
    href: '#idea-lineage',
    pages: ['lineage'],
  },
]

/** The flagship projects, in their numbered order. */
export const FLAGSHIPS = PROJECTS.filter((p) => p.featured).sort((a, b) =>
  (a.number ?? '').localeCompare(b.number ?? ''),
)

/** The start page's selected work: projects with a recruiter line, in registry order. */
export const HOME_PROJECTS = PROJECTS.filter((p) => p.home)

/** The project a route belongs to, if any. */
export function projectForRoute(
  route: Pick<Route, 'page' | 'path'>,
): ProjectEntry | undefined {
  return PROJECTS.find(
    (p) => p.pages?.includes(route.page) || (p.paths && p.paths(route.path)),
  )
}

/** The flagship before and after this one; none at either end (the list does not wrap). */
export function neighbours(id: string): {
  previous?: ProjectEntry
  next?: ProjectEntry
} {
  const i = FLAGSHIPS.findIndex((p) => p.id === id)
  if (i < 0) return {}
  return { previous: FLAGSHIPS[i - 1], next: FLAGSHIPS[i + 1] }
}
