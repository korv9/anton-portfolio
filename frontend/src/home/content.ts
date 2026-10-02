/**
 * The start page's words, in one place. Every fact comes from Anton's three CVs
 * (public/cv/*.pdf: Data Engineer, Data Scientist / Applied AI, Python / AI Platform) or the
 * project catalogue; nothing here is a number that is not in those sources.
 */
export type Bilingual = { sv: string; en: string }
const t = (sv: string, en: string): Bilingual => ({ sv, en })

/** The three CVs, one per kind of role, so a recruiter opens the one that fits. */
export const CVS: { role: Bilingual; focus: Bilingual; file: string }[] = [
  {
    role: t(
      'Data Engineer / Analytics Engineer',
      'Data Engineer / Analytics Engineer',
    ),
    focus: t(
      'Pipelines, lakehouse, dbt, Power BI',
      'Pipelines, lakehouse, dbt, Power BI',
    ),
    file: 'cv/Anton_Ernstsson_CV_Data_Engineer.pdf',
  },
  {
    role: t('Data Scientist / Applied AI', 'Data Scientist / Applied AI'),
    focus: t(
      'ML, NLP, klustring, modellutvärdering',
      'ML, NLP, clustering, model evaluation',
    ),
    file: 'cv/Anton_Ernstsson_CV_Data_Scientist_Applied_AI.pdf',
  },
  {
    role: t(
      'Python-utvecklare / AI-plattform',
      'Python Developer / AI Platform',
    ),
    focus: t('FastAPI, API:er, RAG, CI/CD', 'FastAPI, APIs, RAG, CI/CD'),
    file: 'cv/Anton_Ernstsson_CV_Python_Backend_AI_Platform.pdf',
  },
]

/** Who Anton is, in two short sentences. */
export const PITCH = t(
  'Utvecklare i Stockholm som bygger hela vägen från rådata till färdig produkt: pipelines, datamodeller, webbapplikationer och AI. Söker en junior roll inom mjukvaruutveckling, data engineering eller tillämpad AI.',
  'Developer in Stockholm who builds the whole path from raw data to a finished product: pipelines, data models, web applications and AI. Looking for a junior role in software development, data engineering or applied AI.',
)

/** The education, shown with the experience. */
export const EDUCATION = {
  org: 'JENSEN YH',
  role: t('AI-utvecklare', 'AI Developer'),
  period: t('2024–2026', '2024–2026'),
  short: t(
    'Yrkeshögskola, 400 YH-poäng, två år på heltid. Examen juni 2026.',
    'Higher vocational education, 400 credits, two years full time. Graduated June 2026.',
  ),
}

export const EXPERIENCE: {
  org: string
  role: Bilingual
  kind: Bilingual
  period: Bilingual
  /** What it was, in one line: the start page shows only this. */
  short: Bilingual
  did: Bilingual[]
  tech: string[]
}[] = [
  {
    org: 'Avtalat',
    role: t('Analytics Engineer', 'Analytics Engineer'),
    kind: t('LIA-praktik', 'LIA internship'),
    period: t('jan–jun 2026', 'Jan–Jun 2026'),
    short: t(
      'NLP-klustring av 21 000+ incidenter (examensarbete), Power BI-modeller och Databricks-pipelines.',
      'NLP clustering of 21,000+ incidents (degree project), Power BI models and Databricks pipelines.',
    ),
    did: [
      t(
        'Byggde en GDPR-anpassad NLP-lösning som klustrade 21 000+ produktionsincidenter och hittade 72 möjliga oregistrerade problemposter (examensarbete).',
        'Built a GDPR-compliant NLP solution that clustered 21,000+ production incidents and identified 72 potential unregistered problem records (degree project).',
      ),
      t(
        'Byggde Power BI-rapporter och semantiska modeller med DirectQuery och DAX, som ersatte manuell rapportering med självbetjäning.',
        'Built Power BI reports and semantic models with DirectQuery and DAX, replacing manual reporting with self-service analytics.',
      ),
      t(
        'Byggde ut en Freshservice-pipeline i Azure Databricks med PySpark och Spark SQL för fler instanser och analyser.',
        'Extended a Freshservice ETL pipeline in Azure Databricks with PySpark and Spark SQL for more instances and analytical use cases.',
      ),
    ],
    tech: [
      'Azure Databricks',
      'PySpark',
      'Spark SQL',
      'Power BI',
      'DAX',
      'sentence-transformers',
      'HDBSCAN',
      'MLflow',
    ],
  },
  {
    org: 'Fora',
    role: t('Data Engineer', 'Data Engineer'),
    kind: t('LIA-praktik', 'LIA internship'),
    period: t('nov 2025–jan 2026', 'Nov 2025–Jan 2026'),
    short: t(
      'Lakehouse-pipelines i Azure Databricks: 80 000+ poster från REST-API, stjärnschema i Gold-lagret.',
      'Lakehouse pipelines in Azure Databricks: 80,000+ records from a REST API, a star schema in Gold.',
    ),
    did: [
      t(
        'Byggde pipelines i Python, PySpark och Spark SQL som läser in 80 000+ Freshservice-poster från ett REST-API till ett lakehouse i Azure Databricks.',
        'Built Python, PySpark and Spark SQL pipelines ingesting 80,000+ Freshservice records from a REST API into an Azure Databricks lakehouse.',
      ),
      t(
        'Inkrementell bearbetning i Bronze, Silver och Gold med validering, skydd mot NULL-överskrivning och felhantering.',
        'Incremental Bronze, Silver and Gold processing with validation, NULL-overwrite protection and error handling.',
      ),
      t(
        'Modellerade ett stjärnschema i Gold-lagret med hashade surrogatnycklar för semantiska modeller och ITSM-rapportering, i en reglerad pensions- och försäkringsmiljö.',
        'Modelled a Gold-layer star schema with hashed surrogate keys for semantic models and ITSM reporting, in a regulated pension and insurance environment.',
      ),
    ],
    tech: [
      'Python',
      'PySpark',
      'Spark SQL',
      'Azure Databricks',
      'Delta Lake',
      'REST API',
    ],
  },
  {
    org: 'Delicato',
    role: t('Maskinoperatör', 'Machine Operator'),
    kind: t('Tidigare erfarenhet', 'Earlier experience'),
    period: t('2022–2025', '2022–2025'),
    short: t(
      'Produktion, kvalitetskontroll och felsökning; vice ordförande i fackklubben.',
      'Production, quality control and troubleshooting; union club vice-chair.',
    ),
    did: [
      t(
        'Produktion, kvalitetskontroll och teknisk felsökning. Vice ordförande i den lokala fackklubben.',
        'Production, quality control and technical troubleshooting. Vice-chair of the local union club.',
      ),
    ],
    tech: [],
  },
]

/** The tech stack by what it is used for: one line on the use, then the tools, most used first. */
export const STACK: { group: Bilingual; use: Bilingual; items: string[] }[] = [
  {
    group: t('Data engineering', 'Data engineering'),
    use: t(
      'Hämta data från API:er och filer och göra den pålitlig i lager: Bronze, Silver, Gold.',
      'Pulling data from APIs and files and making it reliable in layers: Bronze, Silver, Gold.',
    ),
    items: [
      'Python',
      'SQL',
      'PySpark',
      'Azure Databricks',
      'Delta Lake',
      'dbt Core',
      'DuckDB',
      'REST API',
    ],
  },
  {
    group: t('Modellering och BI', 'Modelling and BI'),
    use: t(
      'Stjärnscheman och semantiska modeller som rapporter och dashboards byggs på.',
      'Star schemas and semantic models that reports and dashboards are built on.',
    ),
    items: ['Stjärnschema', 'Power BI', 'DAX', 'DirectQuery', 'pandas'],
  },
  {
    group: t('Maskininlärning och AI', 'Machine learning and AI'),
    use: t(
      'Klustra och klassificera text, bygga RAG-lösningar och utvärdera modeller.',
      'Clustering and classifying text, building RAG solutions and evaluating models.',
    ),
    items: [
      'scikit-learn',
      'XGBoost',
      'sentence-transformers',
      'HDBSCAN',
      'RAG',
      'LLM-API:er',
      'TensorFlow',
      'MLflow',
    ],
  },
  {
    group: t('Backend och webb', 'Backend and web'),
    use: t(
      'API:er och gränssnitt ovanpå datan, som den här sajten.',
      'APIs and interfaces on top of the data, like this site.',
    ),
    items: ['FastAPI', 'PostgreSQL', 'SQLAlchemy', 'React', 'TypeScript'],
  },
  {
    group: t('Kvalitet och drift', 'Quality and delivery'),
    use: t(
      'Tester, datavalidering och automatiska körningar, så att siffrorna går att lita på.',
      'Tests, data validation and automated runs, so the numbers can be trusted.',
    ),
    items: [
      'pytest',
      'Datavalidering',
      'Git',
      'GitHub Actions',
      'Azure DevOps',
      'Docker Compose',
      'GDPR',
    ],
  },
]

export type Project = {
  id: string
  title: Bilingual
  kind: Bilingual
  summary: Bilingual
  /** What it shows, in one line: the result. */
  result: Bilingual
  tech: string[]
  /** Where the project opens: a page on this site, or its repository. Empty: no public page. */
  href: string
  /** Source code; several repositories for a project split into parts. */
  code?: string | string[]
  /** AI and machine learning, or data engineering and software. */
  area: 'ai' | 'data'
  /** A group project: say so, and what was his part. */
  team?: Bilingual
}

/** The flagship: the largest and most complete project. */
export const FLAGSHIP: Project = {
  id: 'politics',
  title: t('Political Observatory', 'Political Observatory'),
  kind: t(
    'Dataprodukt · uppdateras från källorna',
    'Data product · refreshed from the sources',
  ),
  summary: t(
    'Val, opinion, voteringar, budgetförslag, tal och nyheter från riksdagen, SCB, Valmyndigheten och Regeringskansliet, samlade i en produkt: inläsning, testade dbt-modeller, Parquet och en webbplats där varje fråga besvaras med en graf.',
    'Elections, polls, roll calls, budget proposals, speeches and news from the Riksdag, SCB, Valmyndigheten and the Government Offices in one product: ingestion, tested dbt models, Parquet and a site where each question is answered with one chart.',
  ),
  result: t(
    'Voteringar sedan 1993/94 och tal, budget och opinion går att följa parti för parti, med källan ett klick bort.',
    'Roll calls since 1993/94, speeches, budgets and polls can be followed party by party, with the source one click away.',
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
  code: 'https://github.com/korv9/anton-portfolio',
  area: 'data',
}

export const PROJECTS: Project[] = [
  {
    id: 'tallman',
    area: 'ai',
    title: t('taLLMan', 'taLLMan'),
    kind: t('RAG med källkontroll', 'RAG with source checking'),
    summary: t(
      'En chatt om riksdagen som svarar i påståenden, vart och ett kontrollerat mot sina källor.',
      'A chat about the Riksdag that answers in claims, each checked against its sources.',
    ),
    result: t(
      'Varje påstående får en etikett (belagt, beräknat, tolkning …) och hela spåret kan granskas.',
      'Every claim gets a label (supported, computed, interpretation …) and the whole trace can be reviewed.',
    ),
    tech: ['TypeScript', 'BM25', 'Claude API', 'Workers AI', 'Vectorize'],
    href: '#tallman',
    code: 'https://github.com/korv9/anton-portfolio/tree/main/frontend/src/tallman',
  },
  {
    id: 'thesis',
    area: 'ai',
    title: t(
      'NLP-klustring av IT-incidenter',
      'NLP clustering of IT incidents',
    ),
    kind: t('Examensarbete · Avtalat', 'Degree project · Avtalat'),
    summary: t(
      'Oövervakad NLP-pipeline på 21 000+ riktiga produktionsincidenter, med datakvalitet enligt ISO/IEC 25012 och intervjuer med verksamheten.',
      'Unsupervised NLP pipeline on 21,000+ real production incidents, with ISO/IEC 25012 data quality and stakeholder interviews.',
    ),
    result: t(
      '72 möjliga problemposter; bättre klusterkvalitet än K-means.',
      '72 potential problem records; better cluster quality than K-means.',
    ),
    tech: [
      'Python',
      'sentence-transformers',
      'UMAP',
      'HDBSCAN',
      'MLflow',
      'Databricks',
    ],
    href: '#thesis',
  },
  {
    id: 'jobs',
    area: 'data',
    title: t('Arbetsmarknaden i jobbannonser', 'The job market in job ads'),
    kind: t('Analytics engineering', 'Analytics engineering'),
    summary: t(
      'Pipeline för svenska jobbannonser: Python för API och arkiv, dbt Core för SQL, tester och dokumentation.',
      'Pipeline for Swedish job ads: Python for API and archive ingestion, dbt Core for SQL, tests and documentation.',
    ),
    result: t(
      'Stjärnschema med inkrementell faktatabell, tester för korn, referensintegritet och fullständiga månader, CI i GitHub Actions.',
      'Star schema with an incremental fact table, tests for grain, referential integrity and complete months, CI in GitHub Actions.',
    ),
    tech: ['Python', 'SQL', 'dbt Core', 'DuckDB', 'GitHub Actions'],
    href: '#jobb',
    code: 'https://github.com/korv9/swedish-job-market-analytics',
  },
  {
    id: 'welfare',
    area: 'data',
    title: t('Hur mår Sverige?', 'How is Sweden doing?'),
    kind: t('Datalager och analys', 'Data warehouse and analysis'),
    summary: t(
      'Fem offentliga källor (SCB, Försäkringskassan, Folkhälsomyndigheten, ESS, Kolada) i en testad dbt-stjärnmodell med gemensamma nycklar.',
      'Five public sources (SCB, Försäkringskassan, the Public Health Agency, ESS, Kolada) in a tested dbt star schema with shared keys.',
    ),
    result: t(
      'Län och kommuner sida vid sida, med en statussida för varje källa och körning.',
      'Counties and municipalities side by side, with a status page for every source and run.',
    ),
    tech: ['dbt', 'DuckDB', 'Stjärnschema', 'Parquet'],
    href: '#sweden',
    code: 'https://github.com/korv9/anton-portfolio/tree/main/platform',
  },
  {
    id: 'drugcomb',
    area: 'ai',
    title: t('Förutsäga läkemedelssynergi', 'Drug synergy prediction'),
    kind: t('Multimodal maskininlärning', 'Multimodal machine learning'),
    summary: t(
      'Molekylfingeravtryck, RNA-uttryck och cellinjedata kombinerade för att förutsäga synergi, med skydd mot dataläckage.',
      'Drug fingerprints, RNA expression and cell-line data combined to predict synergy, with leakage prevention.',
    ),
    result: t(
      'Ensemblemetoder och djupinlärning jämförda under fyra sätt att dela upp datan.',
      'Ensemble methods and deep learning compared under four cross-validation strategies.',
    ),
    tech: ['Python', 'scikit-learn', 'LightGBM', 'TensorFlow', 'DuckDB'],
    href: '#drugcomb',
    code: 'https://github.com/korv9/DrugComb-Synergy-Prediction',
  },
  {
    id: 'homie',
    area: 'data',
    title: t('Homie API', 'Homie API'),
    kind: t('Python-backend · pågående', 'Python backend · in progress'),
    summary: t(
      'FastAPI- och PostgreSQL-tjänst med autentisering, migreringar och ett OpenAPI-kontrakt för en separat frontend.',
      'FastAPI and PostgreSQL service with authentication, migrations and an OpenAPI contract for a separate frontend.',
    ),
    result: t(
      'pytest, Ruff, GitHub Actions, Dockerfile i flera steg och Docker Compose.',
      'pytest, Ruff, GitHub Actions, a multi-stage Dockerfile and Docker Compose.',
    ),
    tech: ['FastAPI', 'PostgreSQL', 'SQLAlchemy', 'Alembic', 'Docker Compose'],
    href: '#homie',
    code: 'https://github.com/korv9/homie-api',
  },
  {
    id: 'rag',
    area: 'ai',
    title: t('RAG-baserad studieassistent', 'RAG learning assistant'),
    kind: t('Tillämpad generativ AI', 'Applied generative AI'),
    summary: t(
      'Flask-backend som läser in dokument, skapar inbäddningar och ger förankrade svar, semantisk sökning och quiz.',
      'Flask backend ingesting documents, creating embeddings and giving grounded answers, semantic search and quizzes.',
    ),
    result: t(
      'Integrerad med Vertex AI, Google Cloud Storage och ett React-gränssnitt.',
      'Integrated with Vertex AI, Google Cloud Storage and a React interface.',
    ),
    tech: ['Python', 'Flask', 'Vertex AI', 'RAG', 'React'],
    // The repository is not public, so the tile links nowhere.
    href: '',
  },
  {
    id: 'mimii',
    area: 'ai',
    title: t(
      'Avvikelser i industripumpar',
      'Industrial pump anomaly detection',
    ),
    kind: t('Djupinlärning på MIMII', 'Deep learning on MIMII'),
    summary: t(
      'Pumpljud omvandlade till mel-spektrogram och en CNN-klassificerare för att hitta avvikande ljud.',
      'Pump audio turned into Mel spectrograms and a CNN classifier to detect anomalous sounds.',
    ),
    result: t(
      'Utvärderad med ROC-AUC och förväxlingsmatris; överanpassning styrd med dropout och L2.',
      'Evaluated with ROC-AUC and a confusion matrix; overfitting controlled with dropout and L2.',
    ),
    tech: ['Python', 'TensorFlow', 'Keras', 'CNN', 'librosa'],
    href: 'https://github.com/korv9/MIMII-pump-diagnostics',
    code: 'https://github.com/korv9/MIMII-pump-diagnostics',
  },
  {
    id: 'in1',
    area: 'ai',
    title: t(
      'in1: en app för många AI-modeller',
      'in1: one app for many AI models',
    ),
    kind: t(
      'Fullstack med AI-API:er · grupprojekt',
      'Full stack with AI APIs · group project',
    ),
    summary: t(
      'En plattform där användaren väljer vilken AI-modell som passar uppgiften, med OpenAI, Gemini och Hugging Face bakom samma gränssnitt, promptvy och prenumerationer.',
      'A platform where the user picks the AI model that fits the task, with OpenAI, Gemini and Hugging Face behind one interface, a prompt view and subscriptions.',
    ),
    result: t(
      'Jag byggde datamodellen och prenumerationerna: modeller och relationer i MySQL, CRUD-endpoints i Flask, kopplingen i React och Cypress-tester för inloggning och prenumeration.',
      'I built the data model and subscriptions: models and relations in MySQL, CRUD endpoints in Flask, the React wiring and Cypress tests for login and subscription.',
    ),
    tech: [
      'Flask',
      'MySQL',
      'React',
      'Vite',
      'OpenAI',
      'Gemini',
      'Hugging Face',
      'Cypress',
    ],
    href: 'https://github.com/leiyese/in1-backend',
    code: [
      'https://github.com/leiyese/in1-backend',
      'https://github.com/leiyese/in1-frontend',
    ],
    team: t(
      'Grupprojekt med tre utvecklare',
      'Group project with three developers',
    ),
  },
]

/**
 * The start page in one place: the hero, the work it shows, and the short About. Every fact is
 * from the CVs or a project page on the site; the start page is generated from this.
 */
export const HERO = {
  roles: t(
    'Data Engineer · Analytics Engineer · Tillämpad AI',
    'Data Engineer · Analytics Engineer · Applied AI',
  ),
  line: t(
    'Jag bygger dataprodukter, analyssystem och AI-tillämpningar: från pipelines och datamodeller till interaktiv analys och gränssnittet ovanpå.',
    'I build data products, analytics systems and AI applications: from pipelines and data models to interactive analysis and the interface on top.',
  ),
}

export type WorkItem = {
  slug: string
  title: Bilingual
  kind: Bilingual
  description: Bilingual
  /** The problem it solves, in one line (selected work). */
  problem?: Bilingual
  /** Three to five, the ones that matter for this project. */
  tech: string[]
  /** One static preview from the project itself; none: the snippet draws its own figure. */
  image?: { src: string; alt: Bilingual; width: number; height: number }
  href: string
  cta: Bilingual
  code?: string
  /** Selected work gets a large snippet; other work a small card. */
  featured: boolean
}

export const WORK: WorkItem[] = [
  {
    slug: 'politics',
    title: t('Political Observatory', 'Political Observatory'),
    kind: t(
      'Politisk analys · dataprodukt',
      'Political analytics · data product',
    ),
    description: t(
      'Interaktiv analys av riksdagens voteringar, debatter och budgetar, från offentliga källor till testade modeller och en graf per fråga.',
      'Interactive analysis of the Riksdag’s votes, debates and budgets, from public sources to tested models and one chart per question.',
    ),
    problem: t(
      'Politisk data ligger utspridd hos flera myndigheter och är svår att jämföra parti för parti.',
      'Political data is spread across agencies and hard to compare party by party.',
    ),
    tech: ['Python', 'dbt', 'DuckDB', 'Parquet', 'React'],
    image: {
      src: 'previews/politics.webp',
      alt: t(
        'Heatmap över röstlikhet: andelen voteringar där två riksdagspartier hade samma ståndpunkt, parti mot parti, från 26 till 100 procent.',
        'Heatmap of voting similarity: the share of roll calls where two Riksdag parties took the same position, party against party, from 26 to 100 per cent.',
      ),
      width: 1200,
      height: 800,
    },
    href: '#politik',
    cta: t('Utforska Political Observatory', 'Explore Political Observatory'),
    code: 'https://github.com/korv9/anton-portfolio',
    featured: true,
  },
  {
    slug: 'welfare',
    title: t('Hur mår Sverige?', 'How is Sweden doing?'),
    kind: t(
      'Analytics engineering · datalager',
      'Analytics engineering · data warehouse',
    ),
    description: t(
      'Fem offentliga källor i en testad dbt-stjärnmodell, så att län och kommuner kan jämföras sida vid sida.',
      'Five public sources in a tested dbt star schema, so counties and municipalities can be compared side by side.',
    ),
    problem: t(
      'SCB, Försäkringskassan, Folkhälsomyndigheten, ESS och Kolada använder olika nycklar och nivåer.',
      'SCB, Försäkringskassan, the Public Health Agency, ESS and Kolada use different keys and levels.',
    ),
    tech: ['dbt', 'DuckDB', 'SQL', 'Star schema', 'Parquet'],
    image: {
      src: 'previews/welfare.webp',
      alt: t(
        'Arbetslöshet 2005–2025 i nio län, ett litet linjediagram per län mot snittet för alla län, på samma axel.',
        'Unemployment 2005–2025 in nine counties, one small line chart per county against the average of all counties, on the same axis.',
      ),
      width: 1200,
      height: 800,
    },
    href: '#sweden',
    cta: t('Utforska datalagret', 'Explore the warehouse'),
    code: 'https://github.com/korv9/anton-portfolio/tree/main/platform',
    featured: true,
  },
  {
    slug: 'thesis',
    title: t('Mönster i IT-incidenter', 'Patterns in IT incidents'),
    kind: t(
      'Examensarbete · Avtalat · 2026',
      'Degree project · Avtalat · 2026',
    ),
    description: t(
      'Oövervakad NLP på 21 000+ riktiga produktionsincidenter: liknande incidenter grupperas så att verksamheten kan granska dem som möjliga problemposter.',
      'Unsupervised NLP on 21,000+ real production incidents: similar incidents are grouped so the business can review them as possible problem records.',
    ),
    problem: t(
      'Återkommande fel gömmer sig i tusentals fritextincidenter som ingen hinner läsa.',
      'Recurring faults hide in thousands of free-text incidents nobody has time to read.',
    ),
    tech: ['Python', 'sentence-transformers', 'UMAP', 'HDBSCAN', 'Databricks'],
    href: '#thesis',
    cta: t('Läs fallstudien', 'View case study'),
    featured: true,
  },
  {
    slug: 'drugcomb',
    title: t('Läkemedelssynergi', 'Drug synergy prediction'),
    kind: t('Maskininlärning', 'Machine learning'),
    description: t(
      'Molekylfingeravtryck, RNA-uttryck och cellinjedata kombinerade för att förutsäga synergi, med skydd mot dataläckage.',
      'Fingerprints, RNA expression and cell-line data combined to predict synergy, with leakage prevention.',
    ),
    tech: ['Python', 'scikit-learn', 'LightGBM', 'TensorFlow'],
    href: '#drugcomb',
    cta: t('Öppna projektet', 'Open project'),
    code: 'https://github.com/korv9/DrugComb-Synergy-Prediction',
    featured: false,
  },
  {
    slug: 'homie',
    title: t('Homie API', 'Homie API'),
    kind: t('Python-backend · pågående', 'Python backend · in progress'),
    description: t(
      'FastAPI- och PostgreSQL-tjänst med autentisering, migreringar och ett OpenAPI-kontrakt.',
      'FastAPI and PostgreSQL service with authentication, migrations and an OpenAPI contract.',
    ),
    tech: ['FastAPI', 'PostgreSQL', 'SQLAlchemy', 'Docker Compose'],
    href: '#homie',
    cta: t('Öppna projektet', 'Open project'),
    code: 'https://github.com/korv9/homie-api',
    featured: false,
  },
]

/** The degree project in three steps, with the figures from its case study. */
export const THESIS_STEPS: { title: Bilingual; body: Bilingual }[] = [
  {
    title: t('Datakvalitet först', 'Data quality first'),
    body: t(
      'Utvalda dimensioner i ISO/IEC 25012 bedömdes, och personuppgifter maskerades med Presidio, innan någon modell kördes.',
      'Selected ISO/IEC 25012 dimensions were assessed, and personal data masked with Presidio, before any model ran.',
    ),
  },
  {
    title: t('Text blir grupper', 'Text becomes groups'),
    body: t(
      'Flerspråkiga meningsinbäddningar, UMAP ned till 10 dimensioner och HDBSCAN hittade 121 kluster.',
      'Multilingual sentence embeddings, UMAP down to 10 dimensions and HDBSCAN found 121 clusters.',
    ),
  },
  {
    title: t('Grupper blir granskning', 'Groups become review'),
    body: t(
      '72 kluster saknade koppling till en befintlig problempost: kandidater för granskning, inte bevisade grundorsaker.',
      '72 clusters lacked a link to an existing problem record: candidates for review, not proven root causes.',
    ),
  },
]

/** Silhouette per method, as reported in the case study. */
export const THESIS_SILHOUETTE = [
  { method: 'HDBSCAN', value: 0.706 },
  { method: 'K-means', value: 0.534 },
]

/** About, short: what kind of work, not every tool. */
export const ABOUT: Bilingual[] = [
  t(
    'Jag bygger data- och AI-produkter hela vägen: hämtar data från källan, gör den pålitlig med tester och modeller, och bygger gränssnittet där någon faktiskt använder den.',
    'I build data and AI products end to end: pulling data from the source, making it reliable with tests and models, and building the interface where someone actually uses it.',
  ),
  t(
    'Det jag gillar mest är att göra komplex data begriplig, att en fråga ska kunna besvaras med en graf och källan ett klick bort.',
    'What I like most is making complex data understandable: a question answered with one chart, and the source one click away.',
  ),
  t(
    'Jag har praktiserat som data engineer på Fora och analytics engineer på Avtalat, och tog examen som AI-utvecklare vid JENSEN YH i juni 2026.',
    'I have interned as a data engineer at Fora and an analytics engineer at Avtalat, and graduated as an AI developer from JENSEN YH in June 2026.',
  ),
]
