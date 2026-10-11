/**
 * The start page's words, in one place. Facts come from the CV
 * (public/Anton_Ernstsson_CV_Data_Engineer.pdf) and the project catalogue; nothing here is a
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
      'Problemet: IT-supporten löser incidenter en och en, så återkommande fel löses om och om igen utan att någon hittar rotorsaken.',
      'The problem: IT support solves incidents one at a time, so recurring faults are fixed again and again without anyone finding the root cause.',
    ),
    t(
      'Syftet: att låta NLP läsa tusentals gamla ärenden och hitta återkommande fel som aldrig registrerats som problem, och visa hur dokumentationen begränsar det.',
      'The aim: to let NLP read thousands of old tickets and find recurring faults never registered as problems, and to show how documentation limits that.',
    ),
    t(
      'Nyttan: en lista med 72 möjliga problemärenden, där 12 grupper med 650 ärenden är redo att utredas. Ett fel hade hanterats i tre år utan problemärende.',
      'The value: a list of 72 candidate problem records, of which 12 groups with 650 tickets are ready to investigate. One fault had been handled for three years without one.',
    ),
    t(
      'Lärdomen: det som begränsar är dokumentationen, inte AI:n. Rotorsaken skrevs in i 12–13 % av ärendena, och där den fanns blev grupperingen tydligt bättre.',
      'The lesson: documentation is the limit, not the AI. The root cause was recorded in 12–13% of tickets, and where it was, the grouping was clearly better.',
    ),
    t(
      'Så gjordes det: 19 847 anonymiserade ärenden grupperades med sentence-transformers, UMAP och HDBSCAN, 32 % bättre än K-means, inom GDPR:s ramar.',
      'How: 19,847 anonymised tickets were grouped with sentence-transformers, UMAP and HDBSCAN, 32% better than K-means, within GDPR.',
    ),
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
