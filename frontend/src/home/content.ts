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

/** The four facts a recruiter should see first. */
export const FACTS: { value: string; label: Bilingual }[] = [
  {
    value: '2',
    label: t(
      'LIA-praktiker med data: Avtalat och Fora',
      'data internships: Avtalat and Fora',
    ),
  },
  {
    value: '80 000+',
    label: t(
      'poster in i ett lakehouse i Azure Databricks (Fora)',
      'records into an Azure Databricks lakehouse (Fora)',
    ),
  },
  {
    value: '21 000+',
    label: t(
      'incidenter analyserade med NLP, 72 möjliga problemposter (Avtalat)',
      'incidents analysed with NLP, 72 potential problem records (Avtalat)',
    ),
  },
  {
    value: '2026',
    label: t(
      'examen som AI-utvecklare, JENSEN (400 YH-poäng)',
      'graduated AI Developer, JENSEN (400 YH credits)',
    ),
  },
]

export const EXPERIENCE: {
  org: string
  role: Bilingual
  kind: Bilingual
  period: Bilingual
  did: Bilingual[]
  tech: string[]
}[] = [
  {
    org: 'Avtalat',
    role: t('Analytics Engineer', 'Analytics Engineer'),
    kind: t('LIA-praktik', 'LIA internship'),
    period: t('jan–jun 2026', 'Jan–Jun 2026'),
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
    did: [
      t(
        'Produktion, kvalitetskontroll och teknisk felsökning. Vice ordförande i den lokala fackklubben.',
        'Production, quality control and technical troubleshooting. Vice-chair of the local union club.',
      ),
    ],
    tech: [],
  },
]

export const EDUCATION = {
  title: t(
    'AI-utvecklare, JENSEN Yrkeshögskola',
    'AI Developer, JENSEN Yrkeshögskola',
  ),
  period: '2024–2026',
  about: t(
    'Yrkeshögskoleutbildning, 400 YH-poäng, två år på heltid. Examen juni 2026.',
    'Higher Vocational Education, 400 credits, two years full-time. Graduated June 2026.',
  ),
}

export const LANGUAGES = t(
  'Svenska (modersmål) · Engelska (flytande)',
  'Swedish (native) · English (fluent)',
)

/** Skills by function, most used first; everything is shown, nothing hidden behind a toggle. */
export const SKILLS: { group: Bilingual; items: string[] }[] = [
  {
    group: t('Data engineering', 'Data engineering'),
    items: [
      'Python',
      'SQL',
      'PySpark',
      'Spark SQL',
      'Azure Databricks',
      'Delta Lake',
      'dbt Core',
      'DuckDB',
      'ETL/ELT',
      'REST API',
    ],
  },
  {
    group: t('Modellering och arkitektur', 'Modelling and architecture'),
    items: [
      'Lakehouse',
      'Medallion',
      'Stjärnschema',
      'Inkrementella pipelines',
      'Semantiska modeller',
    ],
  },
  {
    group: t('Analys och BI', 'Analytics and BI'),
    items: [
      'Power BI',
      'DAX',
      'DirectQuery',
      'pandas',
      'KPI-utveckling',
      'Statistisk analys',
    ],
  },
  {
    group: t('Maskininlärning och AI', 'Machine learning and AI'),
    items: [
      'scikit-learn',
      'XGBoost',
      'NLP',
      'sentence-transformers',
      'UMAP',
      'HDBSCAN',
      'RAG',
      'LLM-API:er',
      'TensorFlow',
      'MLflow',
    ],
  },
  {
    group: t('Backend och frontend', 'Backend and frontend'),
    items: [
      'FastAPI',
      'Flask',
      'PostgreSQL',
      'SQLAlchemy',
      'Alembic',
      'Pydantic',
      'React',
      'TypeScript',
    ],
  },
  {
    group: t('Kvalitet och leverans', 'Quality and delivery'),
    items: [
      'pytest',
      'Datavalidering',
      'DQX',
      'Git',
      'GitHub Actions',
      'Azure DevOps',
      'CI/CD',
      'Docker Compose',
      'GDPR och anonymisering',
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
  href: string
  code?: string
}

/** The flagship: the largest and most complete project. */
export const FLAGSHIP: Project = {
  id: 'politics',
  title: t('Svensk politik i siffror', 'Swedish politics in numbers'),
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
}

export const PROJECTS: Project[] = [
  {
    id: 'thesis',
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
    href: '#job-market',
    code: 'https://github.com/korv9/swedish-job-market-analytics',
  },
  {
    id: 'welfare',
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
  },
  {
    id: 'drugcomb',
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
    id: 'allegoria',
    title: t(
      'Semantisk drift i svensk lagstiftning',
      'Semantic drift in Swedish legislation',
    ),
    kind: t('Lakehouse och AI-utvärdering', 'Lakehouse and AI evaluation'),
    summary: t(
      '50 källdokument från riksdagens API omvandlade till 1 952 strukturerade bestämmelser med oföränderliga ögonblicksbilder och spårbarhet.',
      '50 source documents from the Riksdag API transformed into 1,952 structured provisions with immutable snapshots and traceability.',
    ),
    result: t(
      'Ett reproducerbart ramverk som mäter hur innebörden förskjuts vid upprepade LLM-omskrivningar.',
      'A reproducible framework measuring meaning shifts across repeated LLM transformations.',
    ),
    tech: [
      'Python',
      'PySpark',
      'Delta Lake',
      'Unity Catalog',
      'DuckDB',
      'pytest',
    ],
    href: '#rfc-drift',
    code: 'https://github.com/korv9/allegoria',
  },
  {
    id: 'homie',
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
    href: 'https://github.com/theazero/anton-portfolio',
  },
  {
    id: 'mimii',
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
    tech: ['Python', 'TensorFlow', 'CNN', 'librosa'],
    href: 'https://github.com/theazero/anton-portfolio',
  },
]
