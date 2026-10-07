/**
 * The politics product's navigation, told as a story in chapters: the overview, then who has
 * the power (parties, voters, votes), the money (budget, taxes), the debates, and the
 * decisions (studies, news), with Mer for exploring and sources. Every page asks one question
 * and ends with a link to the next. Every older, more detailed view lives as a deep dive
 * under one of them.
 */
export type ThemeKey =
  | 'lage'
  | 'budget'
  | 'skatter'
  | 'utredningar'
  | 'nyheter'
  | 'partier'
  | 'sakdebatter'
  | 'partiledare'
  | 'tal'
  | 'valjarna'
  | 'roster'
  | 'modell'
  | 'utforska'
  | 'kallor'

/** The chapter a theme belongs to in the sidebar. */
export type NavGroup =
  'main' | 'makten' | 'pengarna' | 'debatter' | 'besluten' | 'mer'

export type Theme = {
  key: ThemeKey
  path: string
  sv: string
  en: string
  group: NavGroup
  /** The one question the page answers, shown where the page before links to it. */
  question: { sv: string; en: string }
}

export const THEMES: Theme[] = [
  {
    key: 'lage',
    path: '#politik',
    sv: 'Översikt',
    en: 'Overview',
    group: 'main',
    question: {
      sv: 'Hur ser läget ut just nu?',
      en: 'Where do things stand right now?',
    },
  },
  {
    key: 'partier',
    path: '#politik-partier',
    sv: 'Partier',
    en: 'Parties',
    group: 'makten',
    question: {
      sv: 'Vilka partier har makten, och hur har den flyttat?',
      en: 'Which parties hold power, and how has it moved?',
    },
  },
  {
    key: 'valjarna',
    path: '#politik-valjarna',
    sv: 'Vad väljarna tycker',
    en: 'What voters think',
    group: 'makten',
    question: {
      sv: 'Vad tycker väljarna mellan valen?',
      en: 'What do voters think between elections?',
    },
  },
  {
    key: 'roster',
    path: '#politik-roster',
    sv: 'Hur partierna röstar',
    en: 'How the parties vote',
    group: 'makten',
    question: {
      sv: 'Hur röstar partierna när det gäller?',
      en: 'How do the parties vote when it counts?',
    },
  },
  {
    key: 'budget',
    path: '#politik-budget',
    sv: 'Budget',
    en: 'Budget',
    group: 'pengarna',
    question: {
      sv: 'Vad vill partierna göra med pengarna?',
      en: 'What do the parties want to do with the money?',
    },
  },
  {
    key: 'skatter',
    path: '#politik-skatter',
    sv: 'Skatter',
    en: 'Taxes',
    group: 'pengarna',
    question: {
      sv: 'Var kommer pengarna ifrån?',
      en: 'Where does the money come from?',
    },
  },
  {
    key: 'sakdebatter',
    path: '#politik-sakdebatter',
    sv: 'Sakdebatter',
    en: 'Issue debates',
    group: 'debatter',
    question: {
      sv: 'Vem tar mest plats i riksdagens debatter?',
      en: 'Who takes up most room in the Riksdag debates?',
    },
  },
  {
    key: 'partiledare',
    path: '#politik-partiledardebatter',
    sv: 'Partiledardebatter',
    en: 'Party-leader debates',
    group: 'debatter',
    question: {
      sv: 'Vem går i clinch med vem när partiledarna möts?',
      en: 'Who takes on whom when the party leaders meet?',
    },
  },
  {
    key: 'tal',
    path: '#politik-tal',
    sv: 'Vad de pratar om',
    en: 'What they talk about',
    group: 'debatter',
    question: {
      sv: 'Vad pratar politikerna om, och hur har det ändrats?',
      en: 'What do politicians talk about, and how has it changed?',
    },
  },
  {
    key: 'utredningar',
    path: '#politik-utredningar',
    sv: 'Utredningar (SOU)',
    en: 'Studies (SOU)',
    group: 'besluten',
    question: {
      sv: 'Hur blir en utredning en lag?',
      en: 'How does a study become a law?',
    },
  },
  {
    key: 'nyheter',
    path: '#politik-nyheter',
    sv: 'Nyheter',
    en: 'News',
    group: 'besluten',
    question: {
      sv: 'Vad skriver medierna om partierna just nu?',
      en: 'What are the media saying about the parties now?',
    },
  },
  {
    key: 'modell',
    path: '#politik-modell',
    sv: 'Modellen',
    en: 'The model',
    group: 'mer',
    question: {
      sv: 'Kan en modell lära sig hur ett parti röstar?',
      en: 'Can a model learn how a party votes?',
    },
  },
  {
    key: 'utforska',
    path: '#politik-utforska',
    sv: 'Utforska själv',
    en: 'Explore for yourself',
    group: 'mer',
    question: {
      sv: 'Vill du gräva själv?',
      en: 'Want to dig in yourself?',
    },
  },
  {
    key: 'kallor',
    path: '#politik-kallor',
    sv: 'Källor och metod',
    en: 'Sources and method',
    group: 'mer',
    question: {
      sv: 'Var kommer datan ifrån, och hur är den byggd?',
      en: 'Where does the data come from, and how is it built?',
    },
  },
]

export const NAV_GROUPS: {
  key: NavGroup
  sv: string
  en: string
  /** The chapter's number in the story; none for the overview and Mer. */
  n?: number
}[] = [
  { key: 'main', sv: '', en: '' },
  { key: 'makten', sv: 'Makten', en: 'Power', n: 1 },
  { key: 'pengarna', sv: 'Pengarna', en: 'The money', n: 2 },
  { key: 'debatter', sv: 'Debatter', en: 'Debates', n: 3 },
  { key: 'besluten', sv: 'Besluten', en: 'Decisions', n: 4 },
  { key: 'mer', sv: 'Mer', en: 'More' },
]

/** The page after this one in the story, and the one before. */
export function neighbours(key: ThemeKey) {
  const i = THEMES.findIndex((t) => t.key === key)
  return { previous: THEMES[i - 1], next: THEMES[i + 1] }
}

/** The chapter a theme belongs to. */
export const chapterOf = (theme: Theme) =>
  NAV_GROUPS.find((g) => g.key === theme.group)!

/**
 * Views inside a theme that are not in the navigation: one debate, and the budget builder.
 * The theme they belong to is highlighted.
 */
export function subViewOf(
  path: string,
  params: URLSearchParams,
): ThemeKey | null {
  if (path === '#politik-debatt')
    return params.get('typ') === 'partiledare' ? 'partiledare' : 'sakdebatter'
  if (path === '#politik-budget-detalj') return 'budget'
  return null
}

export type DeepDive = {
  /** The theme it belongs to, highlighted in the navigation. */
  parent: ThemeKey
  sv: string
  en: string
  /** One plain sentence on what it holds. */
  aboutSv: string
  aboutEn: string
}

/** Every detailed view, by address. Order within a theme is the order in "Utforska själv". */
export const DEEP_DIVES: Record<string, DeepDive> = {
  '#politik-mandat': {
    parent: 'lage',
    sv: 'Räkna mandat själv',
    en: 'Count the seats yourself',
    aboutSv:
      'Klicka ihop valfria partier och se om de når 175 mandat, med hela valresultatet.',
    aboutEn:
      'Add up any parties against the 175 needed, with the full election result.',
  },
  '#politik-sok': {
    parent: 'sakdebatter',
    sv: 'Sök i anförandena',
    en: 'Search the speeches',
    aboutSv:
      'Filtrera på parti, riksmöte och debattyp, sök talare och rubriker och läs hela anföranden.',
    aboutEn:
      'Filter by party, parliamentary year and debate type, search speakers and titles, and read whole speeches.',
  },
}

/** The tool an address opens, if it is one. */
export function deepDiveOf(
  path: string,
): { key: string; dive: DeepDive } | null {
  return DEEP_DIVES[path] ? { key: path, dive: DEEP_DIVES[path] } : null
}

export const themeByPath = (path: string) => THEMES.find((t) => t.path === path)
