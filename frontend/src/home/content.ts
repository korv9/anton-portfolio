/**
 * The short About. The current CV lives at public/cv/Anton_Ernstsson_CV_final.pdf. Projects live in
 * projects/projectRegistry.ts; experience and skills in home/orbitContent.ts.
 */
export type Bilingual = { sv: string; en: string }
const t = (sv: string, en: string): Bilingual => ({ sv, en })

/** About, short: what kind of work, not every tool. Experience and education are shown below it. */
export const ABOUT: Bilingual[] = [
  t(
    'Välkommen! Jag heter Anton Ernstsson och älskar att utforska data på kreativa sätt. Sidan är min portfolio och en översikt över min erfarenhet för rekryterare. Under ytan körs en dataplattform där jag testar projekt, tankar och idéer innan jag visar dem här.',
    'Welcome! I’m Anton Ernstsson, and I love exploring data in creative ways. This site is my portfolio and an overview of my experience for recruiters. Underneath it runs a data platform where I try out projects, thoughts and ideas before I show them here.',
  ),
  t(
    'Jag dras särskilt till samhällsfrågor, men trivs med att bygga datalösningar oavsett område och har erfarenhet av att leverera i produktion. Jag söker roller inom mjukvaruutveckling, data och AI.',
    'I’m especially drawn to social questions, but I enjoy building data solutions in any field and have experience delivering in production. I’m looking for roles in software development, data and AI.',
  ),
]

export const CONTACT = t(
  'Hör gärna av dig med feedback eller idéer. Om du känner till en jobböppning inom mjukvaruutveckling, data eller AI blir jag särskilt glad att höra från dig.',
  'Feedback or ideas are welcome. If you know of an opening in software development, data or AI, I’d especially like to hear from you.',
)

/** The platform, first of the two flagships. */
export const PLATFORM = {
  title: t('Dataplattformen', 'The data platform'),
  text: [
    t(
      'Sidan körs på en dataplattform som jag har byggt själv. Varje dag hämtar den öppna data från Sverige och EU, modellerar och testar den i dbt och DuckDB och publicerar versionerade releaser till Cloudflare R2.',
      'This site runs on a data platform I built on my own. Every day it collects Swedish and EU public data, models and tests it in dbt and DuckDB, and publishes versioned releases to Cloudflare R2.',
    ),
    t(
      'Diagrammen längre ned läser från samma releaser, och varje fil går att spåra till sin källa och sina tester.',
      'The charts further down read from the same releases, and every file can be traced to its source and its tests.',
    ),
  ],
  caseStudy: t('Fallstudie', 'Case study'),
  code: t('Koden på GitHub', 'Code on GitHub'),
}

/** The job assistant, the second flagship, until its live preview is published. */
export const JOB_ASSISTANT = {
  title: t('Jobbassistenten', 'The job assistant'),
  text: t(
    'Bygger på plattformens data om svenska platsannonser. Förhandsvisningen är inte publicerad än.',
    'Built on the platform’s data on Swedish job ads. The live preview is not published yet.',
  ),
}

/** The humanities and philosophy studies, grouped low on the page. */
export const RESEARCH = {
  title: t('Forskning', 'Research'),
  text: t(
    'Sidostudier i humaniora: inbäddningar och klustring på myter, filosofi och riksdagstal, med gränserna utskrivna.',
    'Side studies in the humanities: embeddings and clustering on myth, philosophy and Riksdag speeches, with their limits written down.',
  ),
}
