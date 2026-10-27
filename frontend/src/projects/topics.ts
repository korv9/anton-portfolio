import type { Bilingual } from './projectRegistry'
const t = (sv: string, en: string): Bilingual => ({ sv, en })
export type Topic = {
  title: Bilingual
  href: string
  links?: { href: string; label: Bilingual }[]
}
const link = (href: string, sv: string, en: string) => ({
  href,
  label: t(sv, en),
})
export const PROJECT_TOPICS: Record<string, Topic[]> = {
  'symbolic-atlas': [
    {
      title: t('Fynd och lärdomar', 'Findings and lessons'),
      href: '#symbolic-findings',
    },
    { title: t('Utforska symboler', 'Explore symbols'), href: '#symbolic-map' },
    {
      title: t('Böcker och traditioner', 'Books and traditions'),
      href: '#symbolic-corpus',
    },
    {
      title: t('Experiment och metod', 'Experiments and method'),
      href: '#symbolic-experiments',
      links: [
        link('#symbolic-experiments', 'Experiment', 'Experiments'),
        link('#symbolic-method', 'Metod', 'Method'),
      ],
    },
  ],
  'philosophy-atlas': [
    {
      title: t('Idéer och textgrupper', 'Ideas and text groups'),
      href: '#philosophy-groups',
    },
    {
      title: t('Filosofiska spänningar', 'Philosophical tensions'),
      href: '#philosophy-tensions',
    },
    {
      title: t('Verk och tänkare', 'Works and thinkers'),
      href: '#philosophy-works',
    },
    {
      title: t('Experiment och metod', 'Experiments and method'),
      href: '#philosophy-method',
    },
  ],
  'concept-constellation': [
    {
      title: t('Följ ett begrepp', 'Follow a concept'),
      href: '#concept-journey',
    },
    {
      title: t('Jämför begrepp', 'Compare concepts'),
      href: '#concepts-profiles',
    },
    {
      title: t('Samband mellan begrepp', 'Concept relationships'),
      href: '#concept-constellation',
    },
    {
      title: t('Urval och metod', 'Selection and method'),
      href: '#concepts-method',
    },
  ],
  drugcomb: [
    {
      title: t('Resultat och generalisering', 'Results and generalisation'),
      href: '#drugcomb',
    },
    {
      title: t('Utforska kombinationer', 'Explore combinations'),
      href: '#drugcomb-model',
    },
    {
      title: t('Data och biologisk kontext', 'Data and biological context'),
      href: '#drugcomb-cells',
    },
    {
      title: t('Modeller och utvärdering', 'Models and evaluation'),
      href: '#drugcomb-method',
    },
  ],
  thesis: [
    { title: t('Kluster', 'Clusters'), href: '#thesis?section=quality' },
    { title: t('Datakvalitet', 'Data quality'), href: '#thesis?section=data' },
    {
      title: t('Ifyllda fält per år', 'Fields per year'),
      href: '#thesis?section=years',
    },
  ],
}
