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
        'Extended a Freshservice ETL pipeline in Azure Databricks with PySpark and Spark SQL so it handles more instances and more analyses.',
      ),
      t(
        'Byggde Power BI-rapporter och semantiska modeller med DirectQuery och DAX, som ersatte manuell rapportering med självbetjäning.',
        'Built Power BI reports and semantic models with DirectQuery and DAX that replaced manual reporting with self-service.',
      ),
      t(
        'Gjorde en reproducerbar NLP-analys av över 21 000 incidenter och bedömde datakvaliteten med hänsyn till GDPR och anonymisering.',
        'Ran a reproducible NLP analysis of 21,000+ incidents and assessed data quality with GDPR and anonymisation in mind.',
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
        'Built Python, PySpark and Spark SQL pipelines that load 80,000+ Freshservice records from a REST API into an Azure Databricks lakehouse.',
      ),
      t(
        'Införde inkrementell bearbetning i Bronze-, Silver- och Gold-lager med validering, skydd mot att NULL skriver över data och felhantering.',
        'Set up incremental Bronze, Silver and Gold processing with validation, NULL-overwrite protection and error handling.',
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
    'Examensarbete: Hitta återkommande IT-problem med NLP',
    'Degree project: Finding recurring IT problems with NLP',
  ),
  kind: t('Fallstudie, vår 2026', 'Case study, spring 2026'),
  points: [
    t(
      'Undersökte hur NLP, klustring och oövervakad inlärning kunde hjälpa IT-team att koppla samman återkommande incidenter och identifiera mönster värda att undersöka.',
      'Explored how NLP, clustering and unsupervised learning could help IT teams connect recurring incidents and identify patterns worth investigating.',
    ),
    t(
      'Analyserade 21 633 incidentposter från Freshservice. Av 121 kluster saknade 72 koppling till ett registrerat problem. Lyfte fram 12 grupper med 650 ärenden för fortsatt granskning i verksamheten.',
      'Analysed 21,633 Freshservice incident records. Of 121 clusters, 72 had no link to a registered problem. Highlighted 12 groups containing 650 tickets for further operational review.',
    ),
    t(
      'Bedömde datakvaliteten med fem dimensioner ur ISO/IEC 25012. Fann att saknad rotorsaksdokumentation och få kopplingar mellan incidenter och problem begränsade analysen, vilket visade varför bättre dokumentation behövs för användbar AI.',
      'Assessed data quality using five ISO/IEC 25012 dimensions. Missing root-cause documentation and few links between incidents and problems limited the analysis. Useful AI here needs better documentation.',
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

/** Earlier studies outside the field, shown smaller than the main education. */
export const ADDITIONAL_EDUCATION = {
  title: t(
    'Socionomprogrammet med urban profil',
    'Social Work Programme (urban specialisation)',
  ),
  school: 'Södertörn University',
  period: '2021 – 2022',
  text: t(
    'Teorier i socialt arbete, välfärdspolitik och omsorg, offentlig och civil rätt, psykologi och professionell utveckling.',
    'Social work theory, welfare policy and social care, public and civil law, psychology and professional development.',
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
