/**
 * The short About. The current CV lives at public/cv/Anton_Ernstsson_CV_final.pdf. Projects live in
 * projects/projectRegistry.ts; experience and skills in home/orbitContent.ts.
 */
export type Bilingual = { sv: string; en: string }
const t = (sv: string, en: string): Bilingual => ({ sv, en })

/** About, short: what kind of work, not every tool. Experience and education are shown below it. */
export const ABOUT: Bilingual[] = [
  t(
    'Jag är en junior mjukvaruutvecklare med inriktning mot data och AI. Jag söker jobb inom mjukvaruutveckling, data engineering och tillämpad AI. Jag har praktisk erfarenhet av datapipelines och analys och gillar särskilt klustring.',
    'I’m a junior software developer with a focus on data and AI. I’ve worked with data pipelines and analytics, and I especially enjoy clustering. For my degree project, I used it to group similar IT support tickets and investigate recurring faults. I’m now looking for a role in software development, data engineering or applied AI.',
  ),
  t(
    'Det här är min egen experimentella hemsida. Jag uppdaterar den med nya projekt, experiment och saker jag lär mig.',
    'This site is also where I try things out. I use it to share my projects and experiments, and keep adding things as I learn.',
  ),
]

export const CONTACT = t(
  'Hör gärna av dig med feedback eller idéer. Om du känner till en jobböppning inom mjukvaruutveckling, data eller AI blir jag särskilt glad att höra från dig.',
  'Have feedback on something here, an idea to discuss or a job opportunity in mind? Feel free to get in touch.',
)
