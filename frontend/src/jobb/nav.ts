/** The job-market product's themes, shared by its navigation and the site's contents menu. */
export type JobsTheme =
  | 'lage'
  | 'trender'
  | 'yrken'
  | 'lan'
  | 'villkor'
  | 'kluster'
  | 'utforska'
  | 'kallor'

export const JOB_THEMES: {
  key: JobsTheme
  path: string
  sv: string
  en: string
}[] = [
  { key: 'lage', path: '#jobb', sv: 'Läget just nu', en: 'Where things stand' },
  {
    key: 'trender',
    path: '#jobb-trender',
    sv: 'Hur utvecklas annonserna?',
    en: 'How are ads developing?',
  },
  {
    key: 'yrken',
    path: '#jobb-yrken',
    sv: 'Vilka yrken växer?',
    en: 'Which occupations grow?',
  },
  {
    key: 'lan',
    path: '#jobb-lan',
    sv: 'Var finns jobben?',
    en: 'Where are the jobs?',
  },
  {
    key: 'villkor',
    path: '#jobb-villkor',
    sv: 'Vilka villkor?',
    en: 'On what terms?',
  },
  {
    key: 'kluster',
    path: '#jobb-kluster',
    sv: 'Vilka grupper bildar annonserna?',
    en: 'What groups do the ads form?',
  },
  {
    key: 'utforska',
    path: '#jobb-utforska',
    sv: 'Utforska själv',
    en: 'Explore for yourself',
  },
  {
    key: 'kallor',
    path: '#jobb-kallor',
    sv: 'Källor och metod',
    en: 'Sources and method',
  },
]
