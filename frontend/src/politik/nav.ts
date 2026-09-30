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
  '#now-seats': {
    parent: 'lage',
    sv: 'Räkna mandat själv',
    en: 'Count the seats yourself',
    aboutSv:
      'Klicka ihop valfria partier och se om de når 175 mandat, med hela valresultatet.',
    aboutEn:
      'Add up any parties against the 175 needed, with the full election result.',
  },
  '#now-government': {
    parent: 'lage',
    sv: 'Regeringen och regeringsbildningen',
    en: 'The government and forming one',
    aboutSv:
      'Vem som styr, med vilket stöd, och de senaste nyheterna om regeringsbildningen.',
    aboutEn:
      'Who governs, with whose support, and the latest on forming a government.',
  },
  '#now-news': {
    parent: 'nyheter',
    sv: 'Politiska nyheter',
    en: 'Political news',
    aboutSv:
      'Rubriker från SVT, Ekot och Regeringskansliet, märkta med de partier de nämner.',
    aboutEn:
      'Headlines from SVT, Ekot and the Government Offices, tagged by party.',
  },
  '#now-decisions': {
    parent: 'lage',
    sv: 'De senaste besluten',
    en: 'The latest decisions',
    aboutSv: 'Riksdagens senaste beslut och hur varje parti röstade.',
    aboutEn: 'The Riksdag’s latest decisions and how each party voted.',
  },
  '#now-issues': {
    parent: 'lage',
    sv: 'Sakfrågor',
    en: 'Issues',
    aboutSv: 'Varje sakfråga: beslut, röster, kostnad och hur det går.',
    aboutEn: 'Each issue: decisions, votes, cost and outcomes.',
  },
  '#now-laws': {
    parent: 'lage',
    sv: 'Lagtexter',
    en: 'Laws',
    aboutSv: 'Läs lagarna direkt på sidan.',
    aboutEn: 'Read the laws on the page.',
  },
  '#now-studies': {
    parent: 'utredningar',
    sv: 'Utredningar',
    en: 'Government studies',
    aboutSv: 'Statliga utredningar och vilka lagar de ledde till.',
    aboutEn: 'Government studies and the laws they led to.',
  },
  '#now-history': {
    parent: 'valjarna',
    sv: 'Valresultat och opinion sedan 1973',
    en: 'Elections and polls since 1973',
    aboutSv: 'Alla riksdagsval och SCB:s mätningar, parti för parti.',
    aboutEn: 'Every Riksdag election and SCB survey, party by party.',
  },
  '#now-votes': {
    parent: 'roster',
    sv: 'Rösthistorik sedan 1993',
    en: 'Voting record since 1993',
    aboutSv:
      'Närvaro, enighet och hur ofta partierna röstat med regeringen, riksmöte för riksmöte.',
    aboutEn:
      'Attendance, unity and voting with the government, session by session.',
  },
  '#politics': {
    parent: 'roster',
    sv: 'Voteringar i detalj',
    en: 'Roll calls in detail',
    aboutSv: 'Varje votering med förslag, utskott och källdokument.',
    aboutEn:
      'Every roll call with its proposal, committee and source documents.',
  },
  '#politics-votes': {
    parent: 'roster',
    sv: 'Varje ledamots röst',
    en: 'Every member’s vote',
    aboutSv: 'Sök fram en ledamot och se hur den röstat.',
    aboutEn: 'Find a member and see how they voted.',
  },
  '#politics-laws': {
    parent: 'roster',
    sv: 'Lagar och ändringar',
    en: 'Laws and amendments',
    aboutSv: 'Hur lagtexter ändrats, bestämmelse för bestämmelse.',
    aboutEn: 'How legal texts changed, provision by provision.',
  },
  '#budget-proposals': {
    parent: 'budget',
    sv: 'Budgetförslagen',
    en: 'The budget proposals',
    aboutSv: 'Regeringens och partiernas förslag per utgiftsområde och år.',
    aboutEn: 'The government’s and parties’ proposals by area and year.',
  },
  '#budget-comparison': {
    parent: 'budget',
    sv: 'Budgetförslagen',
    en: 'The budget proposals',
    aboutSv: 'Regeringens och partiernas förslag per utgiftsområde och år.',
    aboutEn: 'The government’s and parties’ proposals by area and year.',
  },
  '#budget-explore': {
    parent: 'budget',
    sv: 'Jämför budget och debatt',
    en: 'Compare budget and debate',
    aboutSv:
      'Hur mycket partierna pratar om ett område jämfört med vad de vill lägga på det.',
    aboutEn:
      'How much parties talk about an area compared with what they propose for it.',
  },
  '#budget-outturn': {
    parent: 'budget',
    sv: 'Budget och utfall',
    en: 'Budget and outturn',
    aboutSv: 'Vad som budgeterades och vad som faktiskt användes.',
    aboutEn: 'What was budgeted and what was actually spent.',
  },
  '#taxes': {
    parent: 'skatter',
    sv: 'Skatter',
    en: 'Taxes',
    aboutSv:
      'Vad Sverige tar in i skatt, skattebeslut och en räknare för din egen skatt.',
    aboutEn: 'What Sweden collects, tax decisions and a calculator for yours.',
  },
  '#debates': {
    parent: 'partiledare',
    sv: 'Språkkartan över partiledardebatter',
    en: 'Language map of party-leader debates',
    aboutSv: 'Liknande politiska tal hamnar nära varandra på en karta (UMAP).',
    aboutEn: 'Similar political speeches sit close together on a map (UMAP).',
  },
  '#data-explorer': {
    parent: 'sakdebatter',
    sv: 'Sök bland talen',
    en: 'Search the speeches',
    aboutSv: 'Hitta en politiker, läs hela anföranden och följ debatten.',
    aboutEn: 'Find a politician, read full speeches and follow the debate.',
  },
  '#parties': {
    parent: 'partier',
    sv: 'Partierna',
    en: 'The parties',
    aboutSv: 'En sida per parti med historik, röster, budget och nyheter.',
    aboutEn: 'A page per party with history, votes, budget and news.',
  },
  '#now-depth': {
    parent: 'utforska',
    sv: 'Hela underlaget',
    en: 'The full records',
    aboutSv: 'Länkar till alla underlag.',
    aboutEn: 'Links to all records.',
  },
  '#raw-data': {
    parent: 'kallor',
    sv: 'Tabeller och rådata',
    en: 'Tables and raw data',
    aboutSv: 'Bläddra i tabellerna, filtrera och ladda ned.',
    aboutEn: 'Browse the tables, filter and download.',
  },
}

/** The deep dive an address belongs to; prefixed families (#taxes-…, #parties-…) included. */
export function deepDiveOf(
  path: string,
): { key: string; dive: DeepDive } | null {
  if (DEEP_DIVES[path]) return { key: path, dive: DEEP_DIVES[path] }
  if (path.startsWith('#taxes-'))
    return { key: '#taxes', dive: DEEP_DIVES['#taxes'] }
  if (path.startsWith('#parties-'))
    return { key: '#parties', dive: DEEP_DIVES['#parties'] }
  if (path.startsWith('#issue-'))
    return { key: '#now-issues', dive: DEEP_DIVES['#now-issues'] }
  return null
}

export const themeByPath = (path: string) => THEMES.find((t) => t.path === path)
