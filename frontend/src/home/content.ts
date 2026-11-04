/**
 * The short About and the selected work. The current CV lives at public/cv/Anton_Ernstsson_CV_final.pdf. Projects live in
 * projects/projectRegistry.ts; experience and skills in home/orbitContent.ts.
 */
type Bilingual = { sv: string; en: string }
const t = (sv: string, en: string): Bilingual => ({ sv, en })

/** About, one paragraph: what kind of work and what I am looking for. */
export const ABOUT: Bilingual[] = [
  t(
    'Jag heter Anton Ernstsson och är junior mjukvaruutvecklare inom data och AI. Jag bygger dataplattformar och analyserna ovanpå dem: pipelines i Databricks och dbt, klustring och NLP i Python, och React-sidorna som visar resultaten. Den här sajten körs på en egen plattform, byggd på svensk och europeisk öppen data. Jag söker en roll inom mjukvaruutveckling, data eller AI.',
    "I'm Anton Ernstsson, a junior software developer in data and AI. I build data platforms and the analyses on top of them: pipelines in Databricks and dbt, clustering and NLP in Python, and the React pages that show the results. This site runs on a platform of my own, built from Swedish and EU public data. I'm looking for a role in software development, data or AI.",
  ),
]

/** Selected work on the start page: a title, one line and the page it opens. */
export const SELECTED: { title: string; href: string; line: Bilingual }[] = [
  {
    title: 'Replik',
    href: '#replik',
    line: t(
      '33 år av riksdagsdebatter och voteringar, lästa av en maskin.',
      '33 years of Riksdag debates and roll calls, read by machine.',
    ),
  },
  {
    title: 'SWEDEN Lab',
    href: '#sweden',
    line: t(
      'Sex frågor om Sverige, besvarade med öppna data.',
      'Six questions about Sweden, answered with public data.',
    ),
  },
  {
    title: 'ITSM Clustering',
    href: '#thesis',
    line: t(
      '16 811 supportärenden klustrade för att hitta felen som återkommer.',
      '16,811 support tickets clustered to find the faults that keep coming back.',
    ),
  },
]
