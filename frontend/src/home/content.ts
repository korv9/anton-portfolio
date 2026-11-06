/**
 * The short About and the platform beside it. The current CV lives at public/cv/Anton_Ernstsson_CV_final.pdf. Projects live in
 * projects/projectRegistry.ts; experience and skills in home/orbitContent.ts.
 */
type Bilingual = { sv: string; en: string }
const t = (sv: string, en: string): Bilingual => ({ sv, en })

/** About, three short paragraphs: who I am, why the site exists and what I am looking for. */
export const ABOUT: Bilingual[] = [
  t(
    'Hej, jag heter Anton, välkommen till min sida! Jag är junior utvecklare med praktikerfarenhet som dataingenjör inom försäkringsbranschen, där jag arbetade med intern ITSM-data.',
    "Hi, I'm Anton, welcome to my page! I'm a junior developer with internship experience as a data engineer in the insurance industry, where I worked with internal ITSM data.",
  ),
  t(
    'Jag byggde sajten för att visa vem jag är och vad jag gör, och för att ha en egen produkt som faktiskt är i drift.',
    'I built this site to show who I am and what I do, and to have a product of my own that is actually running.',
  ),
  t(
    'Jag söker roller inom data, AI och mjukvaruutveckling. Om du tror att jag passar i en annan roll, hör gärna av dig.',
    "I'm looking for roles in data, AI and software engineering. If you think I'd fit a role outside those, don't hesitate to get in touch.",
  ),
]

/** Beside About: the platform the projects run on, and the way to them. */
export const PLATFORM = {
  title: t('Plattform och projekt', 'Platform and projects'),
  paragraphs: [
    t(
      'Jag byggde sajten för att visa mina projekt som levande demos som går att prova, i stället för att bara länka till repon på GitHub.',
      'I built this site to show my projects as live demos you can try, instead of only linking to repositories on GitHub.',
    ),
    t(
      'Allt körs på en egen dataplattform, byggd så att ett nytt projekt kan ansluta till samma pipeline utan att börja om. Jag lägger regelbundet till nya projekt och fortsätter att förbättra dem som redan finns.',
      'Everything runs on one data platform of my own, built so a new project can join the same pipeline without starting over. I add new projects regularly and keep polishing the ones already here.',
    ),
    t(
      'En del är experiment, som klustringslabben, där jag prövar en metod på riktig data och visar vad den gav.',
      'Some are experiments, such as the clustering labs, where I try a method on real data and show what came of it.',
    ),
  ],
  link: t('Se plattformen och projekten', 'See the platform and projects'),
}
