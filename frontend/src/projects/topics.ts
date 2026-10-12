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
  politics: [
    {
      title: t('Regering och riksdag', 'Government and parliament'),
      href: '#politik-partier',
      links: [
        link('#politik-partier', 'Partier och mandat', 'Parties and seats'),
        link('#politik-roster', 'Voteringar', 'Roll calls'),
        link('#politik-mandat', 'Mandatkalkylator', 'Seat calculator'),
        link('#politik-modell', 'Röstningsmodell', 'Voting model'),
      ],
    },
    {
      title: t('Budget och skatter', 'Budget and taxes'),
      href: '#politik-budget',
      links: [
        link('#politik-budget', 'Budget', 'Budget'),
        link('#politik-skatter', 'Skatter', 'Taxes'),
      ],
    },
    {
      title: t('Debatter och språk', 'Debates and language'),
      href: '#politik-sakdebatter',
      links: [
        link('#politik-sakdebatter', 'Sakdebatter', 'Issue debates'),
        link(
          '#politik-partiledardebatter',
          'Partiledardebatter',
          'Party leader debates',
        ),
        link('#politik-tal', 'Ämnesfokus', 'Topic focus'),
        link('#politik-sok', 'Läs anföranden', 'Read speeches'),
      ],
    },
    {
      title: t('Väljare och opinion', 'Voters and opinion'),
      href: '#politik-valjarna',
    },
    {
      title: t('Utredningar och lagstiftning', 'Studies and legislation'),
      href: '#politik-utredningar',
    },
  ],
  jobs: [
    {
      title: t('Efterfrågan över tid', 'Demand over time'),
      href: '#jobb-trender',
    },
    {
      title: t('Yrken och kompetenser', 'Occupations and skills'),
      href: '#jobb-yrken',
    },
    {
      title: t('Regional arbetsmarknad', 'Regional labour market'),
      href: '#jobb-lan',
    },
    {
      title: t('Anställningsvillkor', 'Employment conditions'),
      href: '#jobb-villkor',
    },
    {
      title: t('IT och dataroller', 'IT and data roles'),
      href: '#job-market-tech',
      links: [
        link('#job-market-tech', 'IT-rapport', 'IT report'),
        link('#jobb-kluster', 'Annonsgrupper', 'Ad clusters'),
      ],
    },
  ],
  welfare: [
    {
      title: t('Arbete och arbetslöshet', 'Work and unemployment'),
      href: '#sweden-work',
    },
    { title: t('Sjukfrånvaro', 'Sick leave'), href: '#sweden-sick-leave' },
    {
      title: t('Mående och livskvalitet', 'Mental health and quality of life'),
      href: '#sweden-mental-health',
    },
    {
      title: t('Regionala skillnader', 'Regional differences'),
      href: '#sweden-counties',
    },
  ],
  'ai-act': [
    {
      title: t('Vad gäller och när?', 'What applies and when?'),
      href: '#ai-act-today',
      links: [
        link('#ai-act-today', 'I dag', 'Today'),
        link('#ai-act-timeline', 'Tidslinje', 'Timeline'),
      ],
    },
    {
      title: t('Roller och skyldigheter', 'Roles and obligations'),
      href: '#ai-act-roles',
      links: [
        link('#ai-act-roles', 'Roller', 'Roles'),
        link('#ai-act-obligations', 'Skyldigheter', 'Obligations'),
      ],
    },
    {
      title: t('Risk och användning', 'Risk and use'),
      href: '#ai-act-risk',
      links: [
        link('#ai-act-risk', 'Riskkategorier', 'Risk categories'),
        link('#ai-act-startups', 'Navigator', 'Navigator'),
      ],
    },
    {
      title: t('Förändringar i lagen', 'Changes to the law'),
      href: '#ai-act-changes',
    },
    {
      title: t('Samhälle och arbetsliv', 'Society and work'),
      href: '#ai-act-signals',
      links: [
        link('#ai-act-signals', 'Tidsjämförelse', 'Timeline comparison'),
        link('#ai-act-politics', 'Riksdagen', 'Parliament'),
        link('#ai-act-jobs', 'Jobbannonser', 'Job ads'),
      ],
    },
  ],
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
      href: '#drugcomb?section=results',
    },
    {
      title: t('Utforska kombinationer', 'Explore combinations'),
      href: '#drugcomb?section=explore',
    },
    {
      title: t('Data och biologisk kontext', 'Data and biological context'),
      href: '#drugcomb?section=context',
    },
    {
      title: t('Modeller och utvärdering', 'Models and evaluation'),
      href: '#drugcomb?section=method',
    },
  ],
  thesis: [
    {
      title: t('Data och arbetsflöde', 'Data and workflow'),
      href: '#thesis?section=workflow',
    },
    {
      title: t('Datakvalitet', 'Data quality'),
      href: '#thesis?section=quality',
    },
    {
      title: t('Utvärdering', 'Evaluation'),
      href: '#thesis?section=evaluation',
    },
    {
      title: t('Metod och begränsningar', 'Method and limitations'),
      href: '#thesis?section=depth',
    },
  ],
}
