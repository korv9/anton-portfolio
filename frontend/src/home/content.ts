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

/** About, short: what kind of work, not every tool. Experience and education are shown beside it. */
export const ABOUT: Bilingual[] = [
  t(
    'Jag bygger data- och AI-produkter hela vägen: hämtar data från källan, gör den pålitlig med tester och modeller, och bygger gränssnittet där någon faktiskt använder den.',
    'I build data and AI products end to end: pulling data from the source, making it reliable with tests and models, and building the interface where someone actually uses it.',
  ),
  t(
    'I praktiken har jag byggt pipelines i produktion, från insamling och bearbetning av data till att göra den användbar för rapportering och analys, och arbetat nära beställare för att förstå vad de behöver och ge dem pålitlig data.',
    'In practice I have built production pipelines, from collecting and processing data to making it useful for reporting and analysis, and worked closely with stakeholders to understand their needs and give them reliable data.',
  ),
  t(
    'Det jag gillar mest är att göra komplex data begriplig, att en fråga ska kunna besvaras med en graf och källan ett klick bort.',
    'What I like most is making complex data understandable: a question answered with one chart, and the source one click away.',
  ),
  t(
    'Svenska (modersmål), engelska (flytande).',
    'Swedish (native), English (fluent).',
  ),
]
