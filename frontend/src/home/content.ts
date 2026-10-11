/**
 * The CVs and the short About. Every fact comes from Anton's three CVs (public/cv/*.pdf: Data
 * Engineer, Data Scientist / Applied AI, Python / AI Platform). Projects live in
 * projects/projectRegistry.ts; experience and skills in home/orbitContent.ts.
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

/** About, short: what kind of work, not every tool. Experience and education are shown below it. */
export const ABOUT: Bilingual[] = [
  t(
    'Jag är en junior data engineer med praktisk erfarenhet av datapipelines och analys. Jag fokuserar på data och AI och gillar särskilt klustring.',
    'I’m a junior data engineer with hands-on experience in data pipelines and analytics. I focus on data and AI, and I especially enjoy clustering.',
  ),
  t(
    'Det här är min egen experimentella hemsida. Jag uppdaterar den med nya projekt, experiment och saker jag lär mig.',
    'This is my personal, experimental website. I’ll keep adding projects, experiments and things I learn along the way.',
  ),
]
