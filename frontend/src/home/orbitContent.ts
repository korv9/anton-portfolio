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

/** Education, as the CV states it. */
export const EDUCATION: {
  title: Bilingual
  school: string
  period: string
  note: Bilingual
}[] = [
  {
    title: t('AI-utvecklare', 'AI Developer'),
    school: 'JENSEN Yrkeshögskola',
    period: '2024–2026',
    note: t(
      '400 YH-poäng, examen juni 2026',
      '400 YH credits, graduated June 2026',
    ),
  },
]

/** Earlier work, not in the target field: one line. */
export const EARLIER = t(
  'Dessförinnan maskinoperatör på Delicato 2022–2025.',
  'Before that, machine operator at Delicato 2022–2025.',
)

/**
 * The start page's short stack: the target role's tools first, in a few groups. Every tool is
 * in the CVs; the full list (SKILLS) stays one click away. Web is education and projects, not
 * professional work, and says so.
 */
export const CORE_STACK: {
  group: Bilingual
  tools: (string | Bilingual)[]
  note?: Bilingual
}[] = [
  {
    group: t('Data', 'Data'),
    tools: ['Python', 'SQL', 'PySpark', 'dbt', 'DuckDB'],
  },
  {
    group: t('Plattform', 'Platform'),
    tools: ['Databricks', 'Azure', 'Lakehouse', 'CI/CD'],
  },
  {
    group: t('Analys', 'Analytics'),
    tools: ['Power BI', 'DAX', t('Datamodellering', 'Data modelling')],
  },
  {
    group: t('AI / ML', 'AI / ML'),
    tools: [
      'scikit-learn',
      'TensorFlow',
      'Embeddings',
      t('Klustring', 'Clustering'),
    ],
  },
  {
    group: t('Webb', 'Web'),
    tools: ['React', 'TypeScript'],
    note: t('utbildning och projekt', 'education and projects'),
  },
]

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
