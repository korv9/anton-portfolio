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
    'I’m a junior software developer specializing in data and AI. I’m looking for opportunities in software development, data engineering and applied AI. I have hands-on experience in data pipelines and analytics, and I especially enjoy clustering.',
  ),
  t(
    'Det här är min egen experimentella hemsida. Jag uppdaterar den med nya projekt, experiment och saker jag lär mig.',
    'This is my personal, experimental website. I’ll keep adding projects, experiments and things I learn along the way.',
  ),
]

export const CONTACT = t(
  'Hör gärna av dig med feedback eller idéer. Om du känner till en jobböppning inom mjukvaruutveckling, data eller AI blir jag särskilt glad att höra från dig.',
  'Please feel free to get in touch with feedback or ideas. If you know of a job opening in software development, data or AI, I’d especially love to hear from you.',
)
