/**
 * The start page's words, in one place. Facts come from the CV
 * (public/cv/Anton_Ernstsson_CV_final.pdf) and the project catalogue; nothing here is a
 * number that is not in those sources.
 */
export type Bilingual = { sv: string; en: string }
const t = (sv: string, en: string): Bilingual => ({ sv, en })

export const EXPERIENCE: {
  role: string
  org: string
  kind: Bilingual
  period: Bilingual
  did: Bilingual[]
  tech: string[]
}[] = [
  {
    role: 'Analytics Engineer',
    org: 'Avtalat',
    kind: t('LIA-praktik', 'LIA internship'),
    period: t('jan 2026 – jun 2026', 'Jan 2026 – Jun 2026'),
    did: [
      t(
        'Byggde ut en ETL-pipeline för Freshservice i Azure Databricks med PySpark och Spark SQL, så att den klarar fler instanser och fler analyser.',
        'Extended a Freshservice ETL pipeline in Azure Databricks using PySpark and Spark SQL, supporting additional instances and analytical use cases.',
      ),
      t(
        'Byggde Power BI-rapporter och semantiska modeller med DirectQuery och DAX, som ersatte manuell rapportering med självbetjäning.',
        'Built Power BI reports and semantic models with DirectQuery and DAX, replacing manual reporting with self-service analytics.',
      ),
      t(
        'Gjorde en reproducerbar NLP-analys av över 21 000 incidenter och bedömde datakvaliteten med hänsyn till GDPR och anonymisering.',
        'Developed a reproducible NLP analysis of 21,000+ incidents and assessed data quality with attention to GDPR and anonymisation.',
      ),
    ],
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
    role: 'Data Engineer',
    org: 'Fora AB',
    kind: t('LIA-praktik', 'LIA internship'),
    period: t('nov 2025 – jan 2026', 'Nov 2025 – Jan 2026'),
    did: [
      t(
        'Byggde pipelines i Python, PySpark och Spark SQL som läser in över 80 000 Freshservice-poster från ett REST-API till ett lakehouse i Azure Databricks.',
        'Built Python, PySpark and Spark SQL pipelines ingesting 80,000+ Freshservice records from a REST API into an Azure Databricks lakehouse.',
      ),
      t(
        'Införde inkrementell bearbetning i Bronze-, Silver- och Gold-lager med validering, skydd mot att NULL skriver över data och felhantering.',
        'Implemented incremental Bronze, Silver and Gold processing with validation, NULL-overwrite protection and error handling.',
      ),
      t(
        'Modellerade en stjärnmodell i Gold-lagret med hashade surrogatnycklar för semantiska modeller och ITSM-rapportering.',
        'Modelled a Gold-layer star schema with hashed surrogate keys for semantic models and ITSM reporting.',
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
]

/** The degree project's key points, from the thesis (AIDEV24S, spring 2026). */
export const THESIS = {
  title: t(
    'Examensarbete: NLP-klustring av ITSM-data',
    'Degree project: NLP clustering of ITSM data',
  ),
  kind: t('Fallstudie, vår 2026', 'Case study, spring 2026'),
  points: [
    t(
      'Grupperade personuppgiftsmaskerade Freshservice-incidenter och fann att 72 av 121 grupper saknade koppling till registrerade problem. Arbetet lyfte fram 12 grupper med 650 ärenden för fortsatt utredning och beskrev liknande symptom som återkommit över flera år. Grupperna kräver verksamhetens granskning.',
      'Clustered PII-masked Freshservice incidents and found that 72 of 121 groups had no link to a registered problem. Highlighted 12 groups with 650 tickets for further investigation and described similar symptoms recurring over several years. The groups need operational review.',
    ),
    t(
      'Mätte datakvaliteten i 21 633 incidentposter från Fora AB med fem dimensioner ur ISO/IEC 25012: fullständighet, exakthet, konsistens, unikhet och spårbarhet.',
      'Measured data quality in 21,633 incident records from Fora AB using five ISO/IEC 25012 dimensions: completeness, accuracy, consistency, uniqueness and traceability.',
    ),
    t(
      'Fann att giltiga och ifyllda systemfält kunde sakna användbart innehåll. Rotorsaksfältet var ifyllt i bara 4,2 % och problemkoppling fanns i 5,1 % av kvalitetsunderlaget. Arbetet pekade ut dokumentationsluckor och processmognad som en huvudbegränsning för analysen.',
      'Found that valid, populated system fields could still lack useful content. Root-cause notes were present in only 4.2% and problem links in 5.1% of the quality dataset. The thesis identified documentation gaps and process maturity as a main constraint on the analysis.',
    ),
    t(
      'Jämförde HDBSCAN med K-means och kontrollerade grupperna mot befintliga problemkopplingar. HDBSCAN gav cirka 32 % högre silhuettvärde, beräknat på olika delmängder. Namnmaskering skapade också falska likheter som behövde granskas.',
      'Compared HDBSCAN with K-means and checked the groups against existing problem links. HDBSCAN produced about 32% higher silhouette, calculated on different subsets. Name masking also created false similarities that needed review.',
    ),
  ],
  tech: [
    'Python',
    'Azure Databricks',
    'sentence-transformers',
    'UMAP',
    'HDBSCAN',
    'MLflow',
  ],
}

/** Earlier work outside the field, as the CV lists it. */
export const ADDITIONAL = {
  role: t('Maskinoperatör', 'Machine Operator'),
  org: 'Delicato AB',
  period: '2022 – 2025',
  text: t(
    'Produktion, kvalitetskontroll och teknisk felsökning. Vice ordförande i den lokala fackklubben.',
    'Production, quality control and technical troubleshooting. Vice-chair of the local union club.',
  ),
}

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
    period: '2024 – 2026',
    note: t(
      'Tvåårig yrkeshögskoleutbildning som kombinerar fullstackutveckling med tillämpad AI. Utbildningen omfattade frontend och backend, Pythonprogrammering, databaser och webbapplikationer samt datautvinning, maskininlärning och deep learning. Examen juni 2026.',
      'Two-year vocational programme combining fullstack development with applied AI. Covered frontend and backend development, Python programming, databases and web applications, as well as data mining, machine learning and deep learning. Graduated June 2026.',
    ),
  },
]
