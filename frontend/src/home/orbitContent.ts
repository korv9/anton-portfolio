/**
 * The start page's words, in one place. Facts come from the CV
 * (public/Anton_Ernstsson_CV_Data_Engineer.pdf) and the project catalogue; nothing here is a
 * number that is not in those sources.
 */
export type Bilingual = { sv: string; en: string }
const t = (sv: string, en: string): Bilingual => ({ sv, en })

export const EXPERIENCE: {
  org: string
  role: Bilingual
  period: Bilingual
  did: Bilingual[]
  effect: Bilingual
  tech: string[]
}[] = [
  {
    org: 'Avtalat',
    role: t(
      'Analytics Engineer · LIA-praktik',
      'Analytics Engineer · LIA internship',
    ),
    period: t('jan–jun 2026', 'Jan–Jun 2026'),
    did: [
      t(
        'Byggde ut en ETL-pipeline för Freshservice i Azure Databricks så att den klarar fler instanser och fler analyser.',
        'Extended a Freshservice ETL pipeline in Azure Databricks to support more instances and analytical use cases.',
      ),
      t(
        'Byggde Power BI-rapporter och semantiska modeller med DirectQuery och DAX.',
        'Built Power BI reports and semantic models with DirectQuery and DAX.',
      ),
      t(
        'Gjorde en reproducerbar NLP-analys av över 21 000 incidenter, med bedömning av datakvalitet, GDPR och anonymisering.',
        'Developed a reproducible NLP analysis of 21,000+ incidents, assessing data quality with attention to GDPR and anonymisation.',
      ),
    ],
    effect: t(
      'Manuell rapportering ersattes av självbetjäning: verksamheten kan själv ta fram sina siffror.',
      'Manual reporting was replaced with self-service analytics: the business can get its own numbers.',
    ),
    tech: [
      'Azure Databricks',
      'PySpark',
      'Spark SQL',
      'Power BI',
      'DAX',
      'NLP',
    ],
  },
  {
    org: 'Fora',
    role: t('Data Engineer · LIA-praktik', 'Data Engineer · LIA internship'),
    period: t('nov 2025–jan 2026', 'Nov 2025–Jan 2026'),
    did: [
      t(
        'Byggde pipelines i Python, PySpark och Spark SQL som läser in över 80 000 Freshservice-poster från ett REST-API till ett lakehouse i Azure Databricks.',
        'Built Python, PySpark and Spark SQL pipelines ingesting 80,000+ Freshservice records from a REST API into an Azure Databricks lakehouse.',
      ),
      t(
        'Införde inkrementell bearbetning i Bronze-, Silver- och Gold-lager med validering, skydd mot att NULL skriver över data och felhantering.',
        'Implemented incremental Bronze, Silver and Gold processing with validation, NULL-overwrite protection and error handling.',
      ),
    ],
    effect: t(
      'En stjärnmodell i Gold-lagret med hashade surrogatnycklar blev grunden för semantiska modeller och rapportering av IT-ärenden.',
      'A Gold-layer star schema with hashed surrogate keys became the basis for semantic models and IT service reporting.',
    ),
    tech: [
      'Python',
      'PySpark',
      'Spark SQL',
      'Azure Databricks',
      'Delta Lake',
      'REST API',
    ],
  },
]

export const EDUCATION = t(
  'AI-utvecklare, JENSEN Yrkeshögskola, 2024–2026 (400 YH-poäng). Dessförinnan maskinoperatör på Delicato 2022–2025.',
  'AI Developer, JENSEN Yrkeshögskola, 2024–2026 (400 YH credits). Before that, machine operator at Delicato 2022–2025.',
)

export const SKILLS: { group: Bilingual; top: string[]; more: string[] }[] = [
  {
    group: t('Data engineering', 'Data engineering'),
    top: ['Python', 'SQL', 'PySpark', 'Databricks', 'dbt Core'],
    more: [
      'Spark SQL',
      'Delta Lake',
      'DuckDB',
      'ETL/ELT',
      'REST API',
      'Lakehouse',
      'Medallion',
      'Stjärnschema',
      'Inkrementella pipelines',
    ],
  },
  {
    group: t('Analytics och BI', 'Analytics and BI'),
    top: ['Power BI', 'DAX', 'Semantiska modeller'],
    more: ['DirectQuery', 'pandas', 'KPI-utveckling', 'Parquet'],
  },
  {
    group: t('AI och maskininlärning', 'AI and machine learning'),
    top: ['NLP', 'sentence-transformers', 'Klustring'],
    more: ['UMAP', 'HDBSCAN', 'MLflow', 'LightGBM', 'Modellutvärdering', 'RAG'],
  },
  {
    group: t('Frontend och fullstack', 'Frontend and full stack'),
    top: ['React', 'TypeScript', 'FastAPI'],
    more: [
      'PostgreSQL',
      'SQLAlchemy',
      'Alembic',
      'Flask',
      'Vite',
      'Tillgänglighet (WCAG)',
    ],
  },
  {
    group: t('Cloud och verktyg', 'Cloud and tools'),
    top: ['Azure', 'Git', 'GitHub Actions'],
    more: [
      'Azure DevOps',
      'CI/CD',
      'pytest',
      'DQX',
      'Docker Compose',
      'Cloudflare R2',
    ],
  },
]

export type Project = {
  id: string
  title: Bilingual
  problem: Bilingual
  built: Bilingual
  result: Bilingual
  tech: string[]
  href: string
  hrefLabel: Bilingual
  code?: string
}

export const FEATURED: Project[] = [
  {
    id: 'politics',
    title: t('Svensk politik i siffror', 'Swedish politics in numbers'),
    problem: t(
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
    tech: ['Python', 'dbt', 'DuckDB', 'Parquet', 'React', 'TypeScript', 'NLP'],
    href: '#politik',
    hrefLabel: t('Öppna produkten', 'Open the product'),
    code: 'https://github.com/korv9/anton-portfolio',
  },
  {
    id: 'jobs',
    title: t('Arbetsmarknaden i jobbannonser', 'The job market in job ads'),
    problem: t(
      'Hur förändras efterfrågan på olika yrken, och vilka kompetenser efterfrågas?',
      'How does demand for occupations change, and which skills are asked for?',
    ),
    built: t(
      'En pipeline som läser JobTechs annonsarkiv sedan 2020 och bygger en stjärnmodell med tester för korn, referensintegritet och fullständiga månader.',
      'A pipeline reading JobTech’s ad archive since 2020 into a star schema tested for grain, referential integrity and complete months.',
    ),
    result: t(
      'Annonser per yrke, län och anställningsvillkor över tid, med tydliga definitioner och nedladdningsbara tabeller.',
      'Ads by occupation, county and conditions over time, with clear definitions and downloadable tables.',
    ),
    tech: ['Python', 'dbt Core', 'DuckDB', 'GitHub Actions'],
    href: '#job-market',
    hrefLabel: t('Se analysen', 'See the analysis'),
    code: 'https://github.com/korv9/swedish-job-market-analytics',
  },
  {
    id: 'welfare',
    title: t('Hur mår Sverige?', 'How is Sweden doing?'),
    problem: t(
      'Följs jobb, sjukskrivningar, hälsa och förtroende åt i olika delar av landet?',
      'Do jobs, sick leave, health and trust move together across Sweden?',
    ),
    built: t(
      'Fem offentliga källor – SCB, Försäkringskassan, Folkhälsomyndigheten, European Social Survey och Kolada – i en testad dbt-stjärnmodell med gemensamma nycklar för region, period, kön och ålder.',
      'Five public sources – SCB, Försäkringskassan, the Public Health Agency, the European Social Survey and Kolada – in a tested dbt star schema with shared keys for region, period, sex and age.',
    ),
    result: t(
      'Län och kommuner kan jämföras sida vid sida i webbläsaren, med en statussida för varje källa och körning.',
      'Counties and municipalities side by side in the browser, with a status page for every source and run.',
    ),
    tech: ['dbt', 'DuckDB', 'Stjärnschema', 'Parquet'],
    href: '#sweden',
    hrefLabel: t('Se analysen', 'See the analysis'),
  },
  {
    id: 'drugcomb',
    title: t(
      'DrugComb: förutsäga läkemedelssynergi',
      'DrugComb: predicting drug synergy',
    ),
    problem: t(
      'Fungerar en modell som förutsäger synergi mellan läkemedel även på par, läkemedel och cellinjer den inte sett?',
      'Does a model predicting drug synergy still work on pairs, drugs and cell lines it has not seen?',
    ),
    built: t(
      'Matchning av läkemedel och cellinjer, ett DuckDB-lager och utvärdering med fyra olika sätt att dela upp datan.',
      'Drug and cell-line entity resolution, a DuckDB warehouse and evaluation under four cross-validation strategies.',
    ),
    result: t(
      'Resultaten redovisas per uppdelning, så att det syns hur mycket träffsäkerheten sjunker på okänd data.',
      'Results are reported per split, showing how much accuracy drops on unfamiliar data.',
    ),
    tech: ['Python', 'DuckDB', 'LightGBM', 'Modellutvärdering'],
    href: '#drugcomb',
    hrefLabel: t('Se resultaten', 'See the results'),
    code: 'https://github.com/korv9/DrugComb-Synergy-Prediction',
  },
]

export const MORE_PROJECTS: {
  title: Bilingual
  about: Bilingual
  href: string
}[] = [
  {
    title: t(
      'Examensarbete: NLP-klustring av IT-ärenden',
      'Degree project: NLP clustering of IT incidents',
    ),
    about: t(
      'Datakvalitet enligt ISO/IEC 25012, inbäddningar och klustring för att hitta granskningskandidater.',
      'Data quality to ISO/IEC 25012, embeddings and clustering to find review candidates.',
    ),
    href: '#thesis',
  },
  {
    title: t('Allegoria / RFC-drift', 'Allegoria / RFC drift'),
    about: t(
      'Vad händer med innebörden när ett krav går från MUST till SHOULD? Pågående.',
      'What changes when a requirement goes from MUST to SHOULD? In progress.',
    ),
    href: '#rfc-drift',
  },
  {
    title: t('Homie API', 'Homie API'),
    about: t(
      'FastAPI och PostgreSQL med autentisering och ett tydligt API-kontrakt. Pågående.',
      'FastAPI and PostgreSQL with authentication and an explicit API contract. In progress.',
    ),
    href: '#homie',
  },
  {
    title: t('RAG-baserad studieassistent', 'RAG learning assistant'),
    about: t(
      'Studieprojekt: inläsning av kursmaterial, sökning, chatt och quizgenerering.',
      'Study project: course-material ingestion, retrieval, chat and quiz generation.',
    ),
    href: 'https://github.com/theazero/anton-portfolio',
  },
  {
    title: t('Pumpdiagnostik (MIMII)', 'Pump diagnostics (MIMII)'),
    about: t(
      'Studieprojekt: ljudklassificering med mel-spektrogram och ett faltningsnätverk.',
      'Study project: audio classification with Mel spectrograms and a convolutional network.',
    ),
    href: 'https://github.com/theazero/anton-portfolio',
  },
  {
    title: t('in1 · AI Playground', 'in1 · AI Playground'),
    about: t(
      'Studieprojekt: flera språkmodeller, modulär API-routning, autentisering och promptloggning.',
      'Study project: multiple language models, modular API routing, authentication and prompt tracking.',
    ),
    href: 'https://github.com/theazero/anton-portfolio',
  },
]
