import { currentLocale, setLocale, t, type Locale } from './i18n'
import { fetchData } from './dataSource'
import TimeSeriesChart from './charts/TimeSeriesChart'
import { yearSpan } from './charts/scales'
import AboutProfile, { StudyProjects } from './products/AboutProfile'
import ProductDirectory from './products/ProductDirectory'
import './products/products.css'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import './styles.css'
import './pages.css'

// Project pages load on navigation, so the start page ships none of their code. The politics
// explorer will later pull in a query engine; that must never reach the start-page bundle.
const RfcReport = lazy(() => import('./RfcReport'))
const DrugCombReport = lazy(() => import('./products/DrugCombReport'))
const HomieProject = lazy(() => import('./products/HomieProject'))
const DataExplorer = lazy(() => import('./products/DataExplorer'))
const ProjectDataDisclosure = lazy(
  () => import('./products/ProjectDataDisclosure'),
)
const SpeechBrowser = lazy(() => import('./politics/SpeechBrowser'))
const BudgetLab = lazy(() => import('./BudgetLab'))
const BudgetOutturn = lazy(() => import('./BudgetOutturn'))
const PoliticsLab = lazy(() => import('./politics/PoliticsLab'))

type UmapPoint = {
  chunk_id: string
  topic_id: number
  topic_label: string
  x: number
  y: number
  party: string
  speaker: string
  session: string
  speech_date: string
  excerpt: string
  source_url: string
  session_population: number
}
type Topic = {
  topic_id: number
  topic_label: string
  words: number
  word_share_pct: number
  is_unclustered: boolean
}
type MonthlyAd = {
  month: string
  role: string
  new_ads: number
  unique_employers: number
}
type Technology = {
  cohort: string
  technology: string
  ads_mentioning: number
  share_pct: number
}
type DebateOverview = {
  analyzed_speeches: number
  analyzed_segments: number
  first_date: string
  last_date: string
}
type JobKpis = {
  baseline_year: number
  comparison_year: number
  ads_total: number
  employers_unique: number
  software_baseline: number
  software_comparison: number
  software_change_pct: number
  junior_share_pct: number
  junior_software_baseline: number
  junior_software_comparison: number
  junior_software_change_pct: number
}

const topicColors = [
  '#087f7b',
  '#e45b39',
  '#7656a8',
  '#ca8b18',
  '#3679a6',
  '#be4774',
  '#5d7d3a',
  '#995a35',
]
const topicNames: Record<number, string> = {
  [-1]: 'Ungrouped',
  0: 'Business & economy',
  1: 'EMU & referendum',
  2: 'Women & men',
  3: 'Police & crime',
  4: 'Housing & rents',
  5: 'Climate, energy & EU',
  6: 'Migration',
  7: 'Sweden Democrats',
  8: 'Schools & teachers',
  9: 'Children & families',
  10: 'General debate',
  11: 'Euro & currency',
  12: 'Healthcare',
  13: 'Elder care & pensions',
  14: 'Taxes',
  15: 'Jobs & labour market',
  16: 'EU & Europe',
  17: 'UN & Afghanistan',
  18: 'Parties & politics',
  19: 'Tax & public spending',
  20: 'Russia & Ukraine',
  21: 'NATO & defence',
  22: 'Jobs & unemployment',
  23: 'Political responsibility',
  24: 'Sweden & the world',
}
const topicName = (id: number, fallback: string) =>
  t(topicNames[id] ?? fallback)

function formatNumber(value: number) {
  return new Intl.NumberFormat(
    currentLocale() === 'sv' ? 'sv-SE' : 'en-GB',
  ).format(value)
}
function formatSignedPercent(value: number) {
  return `${value < 0 ? '−' : '+'}${Math.abs(value).toLocaleString(currentLocale() === 'sv' ? 'sv-SE' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
async function fetchReport(url: string) {
  const response = await fetchData(url)
  if (!response.ok) throw new Error(`Report data unavailable: ${url}`)
  return response.json()
}

function JobsChart({ rows, role }: { rows: MonthlyAd[]; role: string }) {
  const points = rows
    .filter((row) => row.role === role)
    .map((row) => ({ date: row.month, value: row.new_ads }))
  const span = yearSpan(points.map((point) => point.date))
  const range = span ? `${span.first}–${span.last}` : ''
  return (
    <TimeSeriesChart
      points={points}
      label={
        currentLocale() === 'sv'
          ? `Nya annonser per månad för ${t(role)}, ${range}`
          : `New ads per month for ${role}, ${range}`
      }
      describe={(point) =>
        `${point.date.slice(0, 7)}: ${formatNumber(point.value)} ${t('ads')}`
      }
      formatTick={(value) => formatNumber(value)}
      scrollHint={t('Chart scrolls horizontally on small screens')}
    />
  )
}

function UmapChart({
  points,
  domainPoints,
  selected,
  onSelect,
  featuredTopics,
}: {
  points: UmapPoint[]
  domainPoints: UmapPoint[]
  selected: UmapPoint | null
  onSelect: (point: UmapPoint) => void
  featuredTopics: number[]
}) {
  const width = 900,
    height = 520,
    pad = 28
  const xs = domainPoints.map((point) => point.x),
    ys = domainPoints.map((point) => point.y)
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys)
  const scaleX = (value: number) =>
    pad + ((value - minX) / Math.max(maxX - minX, 1)) * (width - pad * 2)
  const scaleY = (value: number) =>
    height -
    pad -
    ((value - minY) / Math.max(maxY - minY, 1)) * (height - pad * 2)
  const color = (topic: number) => {
    if (topic === -1) return '#cbc9c1'
    const index = featuredTopics.indexOf(topic)
    return index >= 0 ? topicColors[index] : '#76817e'
  }
  return (
    <div className="umap-frame">
      <svg
        className="umap-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="umap-title umap-desc"
      >
        <title id="umap-title">{t('Language map of debate segments')}</title>
        <desc id="umap-desc">
          {t(
            'Each dot is a text segment. Nearby dots use similar language. Colour shows a machine-discovered topic.',
          )}
        </desc>
        <rect width={width} height={height} rx="8" className="plot-bg" />
        {points.map((point) => {
          const active = selected?.chunk_id === point.chunk_id
          return (
            <circle
              key={point.chunk_id}
              cx={scaleX(point.x)}
              cy={scaleY(point.y)}
              r={active ? 7 : 4.2}
              fill={color(point.topic_id)}
              opacity={
                point.topic_id === -1
                  ? 0.28
                  : featuredTopics.includes(point.topic_id)
                    ? 0.78
                    : 0.42
              }
              className={active ? 'umap-point active' : 'umap-point'}
              onClick={() => onSelect(point)}
            >
              <title>{`${point.speaker} · ${topicName(point.topic_id, point.topic_label)}`}</title>
            </circle>
          )
        })}
      </svg>
      <p className="chart-hint">
        {t('Select a dot to read the source excerpt.')}
      </p>
    </div>
  )
}

function ReportHeader({
  number,
  eyebrow,
  title,
  intro,
  source,
  period,
  unit,
}: {
  number: string
  eyebrow: string
  title: string
  intro: string
  source: string
  period: string
  unit: string
}) {
  return (
    <header className="report-header">
      <div className="report-number">R{number}</div>
      <div>
        <p className="eyebrow">{t(eyebrow)}</p>
        <h2>{t(title)}</h2>
        <p className="report-intro">{t(intro)}</p>
        <dl className="source-strip">
          <div>
            <dt>{t('Source')}</dt>
            <dd>{t(source)}</dd>
          </div>
          <div>
            <dt>{t('Period')}</dt>
            <dd>{period}</dd>
          </div>
          <div>
            <dt>{t('Unit')}</dt>
            <dd>{t(unit)}</dd>
          </div>
        </dl>
      </div>
    </header>
  )
}

function pageFromHash(hash: string) {
  if (
    [
      '#politics',
      '#politics-votes',
      '#politics-laws',
      '#data-explorer',
      '#budget-comparison',
      '#budget-outturn',
      '#debates',
      '#raw-data',
    ].includes(hash)
  )
    return 'politics'
  if (['#job-market', '#job-data'].includes(hash)) return 'jobs'
  if (['#drugcomb', '#drugcomb-data'].includes(hash)) return 'drugcomb'
  if (hash === '#rfc-drift') return 'allegoria'
  if (hash === '#thesis') return 'thesis'
  if (hash === '#homie') return 'homie'
  return 'home'
}

function App() {
  const [language, setLanguage] = useState<Locale>(currentLocale)
  useEffect(() => {
    document.documentElement.lang = language
    document.title =
      language === 'sv'
        ? 'Anton Ernstsson · Data och analys'
        : 'Anton Ernstsson · Data & Analytics'
  }, [language])
  const changeLanguage = (next: Locale) => {
    setLocale(next)
    setLanguage(next)
  }
  const [hash, setHash] = useState(() => window.location.hash || '#start')
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const navigate = () => {
      setHash(window.location.hash || '#start')
      setMenuOpen(false)
    }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  const page = pageFromHash(hash)
  const politicsView =
    hash === '#data-explorer'
      ? 'speeches'
      : ['#budget-comparison', '#budget-outturn'].includes(hash)
        ? 'budgets'
        : hash === '#debates'
          ? 'language'
          : hash === '#raw-data'
            ? 'data'
            : 'overview'
  useEffect(() => {
    requestAnimationFrame(() => {
      if (page === 'home' && hash === '#projects')
        document.getElementById('projects')?.scrollIntoView({ block: 'start' })
      else if (hash === '#budget-outturn')
        document
          .getElementById('budget-outturn')
          ?.scrollIntoView({ block: 'start' })
      else window.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [hash, page])
  const [umap, setUmap] = useState<UmapPoint[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [debateOverview, setDebateOverview] = useState<DebateOverview | null>(
    null,
  )
  const [monthly, setMonthly] = useState<MonthlyAd[]>([])
  const [technologies, setTechnologies] = useState<Technology[]>([])
  const [jobKpis, setJobKpis] = useState<JobKpis | null>(null)
  const [jobYears, setJobYears] = useState<number[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [sessions, setSessions] = useState<string[]>([])
  // Empty until the topic mart names its sessions; then the latest is chosen.
  const [session, setSession] = useState('')
  const [party, setParty] = useState('All')
  const [selectedPoint, setSelectedPoint] = useState<UmapPoint | null>(null)
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [reportError, setReportError] = useState<string | null>(null)

  useEffect(() => {
    if (page !== 'politics' || politicsView !== 'language') return
    let active = true
    setLoading(true)
    setReportError(null)
    // The topic mart names the sessions that have a map; the latest is shown first.
    fetchReport('gold/marts/debate/topics.json')
      .then((topicData) => {
        const available = topicData.sessions as string[]
        const chosen = available.includes(session) ? session : available.at(-1)!
        return fetchReport(`gold/marts/debate/${chosen}.json`).then(
          (umapData) => [umapData, topicData, available, chosen] as const,
        )
      })
      .then(([umapData, topicData, available, chosen]) => {
        if (!active) return
        setSessions(available)
        if (chosen !== session) setSession(chosen)
        setUmap(umapData.data)
        setTopics(topicData.data)
        setDebateOverview(topicData.overview)
        setSelectedPoint(
          umapData.data.find((point: UmapPoint) => point.topic_id !== -1) ??
            umapData.data[0],
        )
        setLoading(false)
      })
      .catch((error: Error) => {
        if (active) {
          setReportError(error.message)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [session, page, politicsView])

  useEffect(() => {
    if (page !== 'jobs') return
    let active = true
    setReportError(null)
    fetchReport('gold/marts/jobs.json')
      .then((jobsData) => {
        if (!active) return
        setMonthly(jobsData.monthly as MonthlyAd[])
        setTechnologies(jobsData.technologies as Technology[])
        setJobKpis(jobsData.kpis)
        setJobYears(jobsData.years as number[])
        setRoles(jobsData.roles as string[])
        setRole((current) => current || (jobsData.roles as string[])[0])
      })
      .catch((error: Error) => {
        if (active) setReportError(error.message)
      })
    return () => {
      active = false
    }
  }, [page])

  const parties = useMemo(
    () => [
      'All',
      ...Array.from(new Set(umap.map((point) => point.party))).sort(),
    ],
    [umap],
  )
  const visiblePoints =
    party === 'All' ? umap : umap.filter((point) => point.party === party)
  const featuredTopics = useMemo(() => {
    const counts = new Map<number, number>()
    umap.forEach((point) => {
      if (point.topic_id !== -1)
        counts.set(point.topic_id, (counts.get(point.topic_id) ?? 0) + 1)
    })
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => id)
  }, [umap])
  const groupedCount = visiblePoints.filter(
    (point) => point.topic_id !== -1,
  ).length
  const groupedShare = visiblePoints.length
    ? (groupedCount / visiblePoints.length) * 100
    : 0
  const sessionPopulation = umap[0]?.session_population ?? 0
  const topTopics = topics.filter((topic) => !topic.is_unclustered).slice(0, 7)
  const unclusteredShare = topics.find(
    (topic) => topic.is_unclustered,
  )?.word_share_pct
  const topTech = technologies
    .filter((tech) => tech.cohort === 'Data roles')
    .slice(0, 10)
  const annual = useMemo(
    () =>
      roles.map((item) => ({
        role: item,
        values: jobYears.map((year) =>
          monthly
            .filter(
              (row) => row.role === item && row.month.startsWith(String(year)),
            )
            .reduce((sum, row) => sum + row.new_ads, 0),
        ),
      })),
    [monthly, roles, jobYears],
  )
  const selectedAnnual = annual.find((item) => item.role === role)?.values ?? []

  return (
    <>
      <a className="skip-link" href="#main">
        {t('Skip to content')}
      </a>
      <header className="site-header">
        <a
          className="wordmark"
          href="#start"
          aria-label={t('Anton Ernstsson, home')}
        >
          <span>{t('AE')}</span>
          <strong>{t('Anton Ernstsson')}</strong>
        </a>
        <div className="header-actions">
          <div
            className="language-switch"
            role="group"
            aria-label={language === 'sv' ? 'Välj språk' : 'Choose language'}
          >
            <button
              type="button"
              lang="en"
              aria-pressed={language === 'en'}
              onClick={() => changeLanguage('en')}
            >
              EN
            </button>
            <button
              type="button"
              lang="sv"
              aria-pressed={language === 'sv'}
              onClick={() => changeLanguage('sv')}
            >
              SV
            </button>
          </div>
          <button
            className="menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="site-nav"
          >
            {menuOpen ? t('Close') : t('Menu')}
          </button>
        </div>
        <nav
          id="site-nav"
          className={menuOpen ? 'nav open' : 'nav'}
          aria-label={t('Main navigation')}
        >
          <a href="#start" onClick={() => setMenuOpen(false)}>
            {t('About')}
          </a>
          <a href="#projects" onClick={() => setMenuOpen(false)}>
            {t('Projects')}
          </a>
          <a href="#politics" onClick={() => setMenuOpen(false)}>
            {t('Politics')}
          </a>
          <a href="#job-market" onClick={() => setMenuOpen(false)}>
            {t('Job market')}
          </a>
          <a href="#drugcomb" onClick={() => setMenuOpen(false)}>
            {t('DrugComb')}
          </a>
          <a
            className="nav-cv"
            href="/Anton_Ernstsson_CV_Data_Engineer.pdf"
            download
          >
            {t('Download CV')}
          </a>
        </nav>
      </header>
      <main id="main">
        <Suspense
          fallback={
            <div className="loading" role="status">
              {t('Loading report data…')}
            </div>
          }
        >
          {page === 'home' && (
            <>
              <section className="intro profile-home" id="start">
                <div className="intro-copy" id="about">
                  <p className="eyebrow">{t('Anton Ernstsson · Stockholm')}</p>
                  <h1>
                    {t('Data Engineer')}
                    <br />
                    {t('& Analytics Engineer.')}
                  </h1>
                  <p className="lede">
                    {t(
                      "Hi, I'm Anton. I enjoy making complex information easier to understand — from building reliable data pipelines to exploring questions through reports and applied AI. I'm a junior data professional with experience from Fora and Avtalat, and this is a collection of what I've worked on and what I'm curious about.",
                    )}
                  </p>
                  <div className="intro-links">
                    <a href="#projects">
                      {t('View projects ')}
                      <span>↓</span>
                    </a>
                    <a href="mailto:anton.ernstson@gmail.com">
                      {t('Email me')}
                    </a>
                    <a href="/Anton_Ernstsson_CV_Data_Engineer.pdf" download>
                      {t('Download CV')}
                    </a>
                  </div>
                </div>
                <aside
                  className="profile-board"
                  aria-label={t('Profile overview')}
                >
                  <section>
                    <p className="eyebrow">{t('Experience')}</p>
                    <div className="profile-rows">
                      <div>
                        <time>2026</time>
                        <span>
                          <strong>{t('Avtalat')}</strong>
                          <small>
                            {t('Analytics Engineer · LIA internship')}
                          </small>
                        </span>
                      </div>
                      <div>
                        <time>2025–26</time>
                        <span>
                          <strong>{t('Fora')}</strong>
                          <small>{t('Data Engineer · LIA internship')}</small>
                        </span>
                      </div>
                      <div>
                        <time>2024–26</time>
                        <span>
                          <strong>{t('JENSEN')}</strong>
                          <small>{t('AI Developer programme')}</small>
                        </span>
                      </div>
                    </div>
                  </section>
                  <section>
                    <p className="eyebrow">{t('Tech stack')}</p>
                    <div className="stack-groups">
                      <div>
                        <small>{t('Data')}</small>
                        <span>{t('Python · SQL · dbt')}</span>
                      </div>
                      <div>
                        <small>{t('Platform')}</small>
                        <span>{t('Azure · Databricks · Docker')}</span>
                      </div>
                      <div>
                        <small>{t('Applied AI')}</small>
                        <span>{t('NLP · embeddings · clustering')}</span>
                      </div>
                      <div>
                        <small>{t('Delivery')}</small>
                        <span>{t('FastAPI · React · TypeScript')}</span>
                      </div>
                    </div>
                  </section>
                  <section className="profile-links">
                    <a
                      href="https://www.linkedin.com/in/anton-ernstsson"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('LinkedIn ↗')}
                    </a>
                    <a
                      href="https://github.com/korv9"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('GitHub ↗')}
                    </a>
                    <span>{t('Open to junior data roles')}</span>
                  </section>
                </aside>
              </section>

              <AboutProfile />
              <div id="projects">
                <ProductDirectory />
              </div>
              <StudyProjects />
            </>
          )}
          {page === 'politics' && (
            <div className="project-page politics-page">
              <div className="page-lead" id="politics-page">
                <p className="eyebrow">
                  {t('Personal research · Swedish politics')}
                </p>
                <h1>{t('Swedish politics, in the records.')}</h1>
                <p>
                  {t(
                    'Speeches, proposed spending and formal decisions in one place. I built this to make it easier to follow what politicians actually do and check the original sources.',
                  )}
                </p>
              </div>
              <nav
                className="page-tabs"
                aria-label={t('Politics report views')}
              >
                <a
                  href="#politics"
                  aria-current={
                    politicsView === 'overview' ? 'page' : undefined
                  }
                >
                  {t('Decisions')}
                </a>
                <a
                  href="#data-explorer"
                  aria-current={
                    politicsView === 'speeches' ? 'page' : undefined
                  }
                >
                  {t('Speeches')}
                </a>
                <a
                  href="#budget-comparison"
                  aria-current={politicsView === 'budgets' ? 'page' : undefined}
                >
                  {t('Budgets')}
                </a>
                <a
                  href="#debates"
                  aria-current={
                    politicsView === 'language' ? 'page' : undefined
                  }
                >
                  {t('Language map')}
                </a>
                <a
                  href="#raw-data"
                  aria-current={politicsView === 'data' ? 'page' : undefined}
                >
                  {t('Data & methods')}
                </a>
              </nav>
              <div className="reports" id="reports">
                {politicsView === 'overview' && <PoliticsLab />}
                {politicsView === 'speeches' && <SpeechBrowser />}
                {politicsView === 'budgets' && (
                  <>
                    <BudgetLab />
                    <BudgetOutturn />
                  </>
                )}
                {politicsView === 'language' && (
                  <article className="report" id="debates">
                    <ReportHeader
                      number="01"
                      eyebrow="Language & politics"
                      title={t('What do party leaders talk about?')}
                      intro="A map of language used in Swedish party leader debates. Nearby dots use similar words; the map does not show political positions."
                      source="Swedish Parliament open data"
                      period={
                        debateOverview
                          ? `${debateOverview.first_date.slice(0, 4)}–${debateOverview.last_date.slice(0, 4)}`
                          : '…'
                      }
                      unit="Text segments"
                    />
                    <a className="report-jump" href="#budget-comparison">
                      {t('Explore debate × budget charts ↓')}
                    </a>
                    <div className="kpis">
                      <div>
                        <strong>
                          {debateOverview
                            ? formatNumber(debateOverview.analyzed_speeches)
                            : '—'}
                        </strong>
                        <span>{t('speeches analysed')}</span>
                      </div>
                      <div>
                        <strong>
                          {debateOverview
                            ? formatNumber(debateOverview.analyzed_segments)
                            : '—'}
                        </strong>
                        <span>{t('text segments')}</span>
                      </div>
                      <div>
                        <strong>
                          {topics.length
                            ? topics.filter((topic) => !topic.is_unclustered)
                                .length
                            : '—'}
                        </strong>
                        <span>{t('topic clusters')}</span>
                      </div>
                      <div>
                        <strong>
                          {unclusteredShare == null
                            ? '—'
                            : `${unclusteredShare.toFixed(1)}%`}
                        </strong>
                        <span>{t('words ungrouped')}</span>
                      </div>
                    </div>
                    <div className="viz-shell">
                      <div className="viz-toolbar">
                        <div>
                          <span className="control-label">
                            {t('Parliamentary session')}
                          </span>
                          <div className="segmented">
                            {sessions.map((item) => (
                              <button
                                key={item}
                                className={session === item ? 'active' : ''}
                                onClick={() => {
                                  setLoading(true)
                                  setSession(item)
                                  setParty('All')
                                }}
                              >
                                {item.replace('-', '/')}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label>
                          <span className="control-label">{t('Party')}</span>
                          <select
                            value={party}
                            onChange={(event) => {
                              const nextParty = event.target.value
                              setParty(nextParty)
                              setSelectedPoint(
                                umap.find(
                                  (point) =>
                                    nextParty === 'All' ||
                                    point.party === nextParty,
                                ) ?? null,
                              )
                            }}
                          >
                            {parties.map((item) => (
                              <option key={item} value={item}>
                                {t(item)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="umap-guide">
                        <div>
                          <strong>{t('How to read the map')}</strong>
                          <span>
                            {t(
                              'Each dot is one sampled speech segment. Distance shows approximate language similarity, not agreement or a political position. Cluster names are provisional machine labels; I plan to retrain this model.',
                            )}
                          </span>
                        </div>
                        <dl>
                          <div>
                            <dt>{t('Shown')}</dt>
                            <dd>{formatNumber(visiblePoints.length)}</dd>
                          </div>
                          <div>
                            <dt>{t('Sample assigned a cluster')}</dt>
                            <dd>{groupedShare.toFixed(0)}%</dd>
                          </div>
                          <div>
                            <dt>{t('Full session')}</dt>
                            <dd>{formatNumber(sessionPopulation)}</dd>
                          </div>
                        </dl>
                      </div>
                      <div
                        className="topic-legend"
                        aria-label={t('Topic colour legend')}
                      >
                        {featuredTopics.map((id, index) => (
                          <span key={id}>
                            <i style={{ background: topicColors[index] }} />
                            {topicName(id, String(id))}
                          </span>
                        ))}
                        <span>
                          <i style={{ background: '#76817e' }} />
                          {t('Other topics')}
                        </span>
                        <span>
                          <i style={{ background: '#cbc9c1' }} />
                          {t('Ungrouped')}
                        </span>
                      </div>
                      <div className="umap-access">
                        <label>
                          {t('Read a sampled segment')}
                          <select
                            value={selectedPoint?.chunk_id ?? ''}
                            onChange={(event) =>
                              setSelectedPoint(
                                visiblePoints.find(
                                  (point) =>
                                    point.chunk_id === event.target.value,
                                ) ?? null,
                              )
                            }
                          >
                            <option value="">{t('Choose a segment')}</option>
                            {visiblePoints.map((point) => (
                              <option
                                key={point.chunk_id}
                                value={point.chunk_id}
                              >
                                {point.speaker} · {point.party} ·{' '}
                                {topicName(point.topic_id, point.topic_label)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p>
                          {t(
                            'The coloured groups come from an exploratory NLP model. Percentages below describe words in the full analysed corpus; the map contains at most 400 sampled segments per session.',
                          )}
                        </p>
                      </div>
                      <div className="umap-layout">
                        <div>
                          {loading ? (
                            <div className="loading">
                              {t('Loading report data…')}
                            </div>
                          ) : reportError ? (
                            <p role="alert">{reportError}</p>
                          ) : (
                            <UmapChart
                              points={visiblePoints}
                              domainPoints={umap}
                              selected={selectedPoint}
                              onSelect={setSelectedPoint}
                              featuredTopics={featuredTopics}
                            />
                          )}
                        </div>
                        <aside className="point-detail" aria-live="polite">
                          <p className="eyebrow">{t('Selected segment')}</p>
                          {selectedPoint ? (
                            <>
                              <h3>
                                {topicName(
                                  selectedPoint.topic_id,
                                  selectedPoint.topic_label,
                                )}
                              </h3>
                              <p className="speaker">
                                {selectedPoint.speaker} · {selectedPoint.party}
                                <br />
                                <time>{selectedPoint.speech_date}</time>
                              </p>
                              <small className="source-language">
                                {t('Original Swedish excerpt')}
                              </small>
                              <blockquote lang="sv">
                                “{selectedPoint.excerpt}…”
                              </blockquote>
                              <a
                                href={selectedPoint.source_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {t('Open parliamentary source ↗')}
                              </a>
                            </>
                          ) : (
                            <p>{t('Select a dot on the map.')}</p>
                          )}
                        </aside>
                      </div>
                    </div>
                    <div className="reading-grid compact-reading">
                      <div className="finding">
                        <p className="eyebrow">{t('Main observation')}</p>
                        <h3>
                          {topTopics[0]
                            ? currentLocale() === 'sv'
                              ? `${topicName(topTopics[0].topic_id, topTopics[0].topic_label)} är det största grupperade språkmönstret.`
                              : `${topicName(topTopics[0].topic_id, topTopics[0].topic_label)} is the largest grouped language pattern.`
                            : t('Loading topic patterns…')}
                        </h3>
                        <p>
                          {topTopics[0]
                            ? currentLocale() === 'sv'
                              ? `Det omfattar ${topTopics[0].word_share_pct.toFixed(1)} % av alla ord; ${unclusteredShare?.toFixed(1) ?? '—'} % är utan kluster.`
                              : `It accounts for ${topTopics[0].word_share_pct.toFixed(1)}% of all words; ${unclusteredShare?.toFixed(1) ?? '—'}% remain ungrouped.`
                            : t(
                                'Topic shares use the full analysed corpus, not the map sample.',
                              )}
                        </p>
                      </div>
                      <div
                        className="bar-list"
                        aria-label={t('Largest topic clusters by word share')}
                      >
                        {topTopics.slice(0, 5).map((topic) => (
                          <div key={topic.topic_id}>
                            <div>
                              <span>
                                {topicName(topic.topic_id, topic.topic_label)}
                              </span>
                              <strong>
                                {topic.word_share_pct.toLocaleString(
                                  currentLocale() === 'sv' ? 'sv-SE' : 'en-GB',
                                  { maximumFractionDigits: 1 },
                                )}
                                %
                              </strong>
                            </div>
                            <span className="bar">
                              <i
                                style={{
                                  width: `${(topic.word_share_pct / topTopics[0].word_share_pct) * 100}%`,
                                  background:
                                    topicColors[
                                      Math.abs(topic.topic_id) %
                                        topicColors.length
                                    ],
                                }}
                              />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <details className="method">
                      <summary>{t('Method & limitations')}</summary>
                      <div>
                        <p>
                          {t('Segments are embedded with ')}
                          <code>
                            {t('paraphrase-multilingual-MiniLM-L12-v2')}
                          </code>
                          {t(
                            ', reduced with UMAP and clustered with HDBSCAN. The map shows a deterministic sample of up to 400 segments per session.',
                          )}
                        </p>
                        <p>
                          {t(
                            'Two-dimensional distance is approximate. Labels are machine-generated keywords, not manual coding. Clusters describe language patterns, not political positions. Labels have not been manually validated, and the model will be retrained before making stronger comparisons.',
                          )}
                        </p>
                        <a
                          href="https://github.com/korv9/partiledardebatt-analys"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('Code and documentation on GitHub ↗')}
                        </a>
                      </div>
                    </details>
                  </article>
                )}
                {politicsView === 'data' && <DataExplorer />}
              </div>
            </div>
          )}
          {page === 'jobs' && (
            <div className="project-page">
              <div className="page-lead">
                <p className="eyebrow">{t('Swedish Job Market Analytics')}</p>
                <h1>{t('Swedish job market.')}</h1>
                <p>
                  {t(
                    'Historical job-ad data, with clear definitions and a view of how software and data roles changed.',
                  )}
                </p>
              </div>
              <div className="reports">
                <article className="report" id="job-market">
                  <ReportHeader
                    number="02"
                    eyebrow="Labour market & technology"
                    title={t('What is happening to tech jobs?')}
                    intro="A compact view of ad volume, junior openings and technologies mentioned in Swedish job ads."
                    source="JobTech Historical Ads"
                    period={
                      jobYears.length
                        ? `${jobYears[0]}–${jobYears.at(-1)}`
                        : '…'
                    }
                    unit="Unique ad IDs"
                  />
                  <div className="kpis jobs-kpis">
                    <div>
                      <strong>
                        {jobKpis ? formatNumber(jobKpis.ads_total) : '—'}
                      </strong>
                      <span>{t('ads in the sample')}</span>
                    </div>
                    <div>
                      <strong>
                        {jobKpis ? formatNumber(jobKpis.employers_unique) : '—'}
                      </strong>
                      <span>{t('unique employers')}</span>
                    </div>
                    <div>
                      <strong>
                        {jobKpis
                          ? formatSignedPercent(jobKpis.software_change_pct)
                          : '—'}
                      </strong>
                      <span>
                        {t('developer ads')}
                        {jobKpis
                          ? `, ${jobKpis.baseline_year}–${String(jobKpis.comparison_year).slice(2)}`
                          : ''}
                      </span>
                    </div>
                    <div>
                      <strong>
                        {jobKpis
                          ? `${jobKpis.junior_share_pct.toFixed(1)}%`
                          : '—'}
                      </strong>
                      <span>{t('junior share')}</span>
                    </div>
                  </div>
                  <div className="viz-shell">
                    <div className="viz-toolbar">
                      <div>
                        <span className="control-label">
                          {t('Role family')}
                        </span>
                        <div className="role-tabs">
                          {roles.map((item) => (
                            <button
                              key={item}
                              className={role === item ? 'active' : ''}
                              onClick={() => setRole(item)}
                            >
                              {t(item)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="job-chart-head">
                      <div>
                        <p className="eyebrow">{t('New ads per month')}</p>
                        <h3>{t(role)}</h3>
                      </div>
                      <div className="year-totals">
                        {selectedAnnual.map((value, index) => (
                          <span key={jobYears[index]}>
                            <small>{jobYears[index]}</small>
                            <strong>{formatNumber(value)}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                    {monthly.length ? (
                      <JobsChart rows={monthly} role={role} />
                    ) : reportError ? (
                      <p role="alert">{reportError}</p>
                    ) : (
                      <div className="loading">{t('Loading report data…')}</div>
                    )}
                  </div>
                  <div className="reading-grid compact-reading">
                    <div className="finding">
                      <p className="eyebrow">{t('Main observation')}</p>
                      <h3>
                        {jobKpis &&
                        jobKpis.junior_software_change_pct <
                          jobKpis.software_change_pct
                          ? t('Junior openings fell faster than total volume.')
                          : t('Junior openings compared with total volume.')}
                      </h3>
                      <p>
                        {jobKpis
                          ? currentLocale() === 'sv'
                            ? `Juniora mjukvaruannonser gick från ${formatNumber(jobKpis.junior_software_baseline)} år ${jobKpis.baseline_year} till ${formatNumber(jobKpis.junior_software_comparison)} år ${jobKpis.comparison_year}: ${formatSignedPercent(jobKpis.junior_software_change_pct)}, jämfört med ${formatSignedPercent(jobKpis.software_change_pct)} för alla mjukvaruannonser.`
                            : `Junior software ads went from ${formatNumber(jobKpis.junior_software_baseline)} in ${jobKpis.baseline_year} to ${formatNumber(jobKpis.junior_software_comparison)} in ${jobKpis.comparison_year}: ${formatSignedPercent(jobKpis.junior_software_change_pct)}, compared with ${formatSignedPercent(jobKpis.software_change_pct)} for all software ads.`
                          : t('Loading the job-market summary…')}
                      </p>
                    </div>
                    <div className="tech-bars">
                      <p className="eyebrow">
                        {t('Most mentioned in data ads')}
                      </p>
                      {topTech.slice(0, 7).map((tech) => (
                        <div key={tech.technology}>
                          <span>{tech.technology}</span>
                          <span className="bar">
                            <i
                              style={{
                                width: `${(tech.share_pct / topTech[0].share_pct) * 100}%`,
                              }}
                            />
                          </span>
                          <strong>
                            {tech.share_pct.toLocaleString(
                              currentLocale() === 'sv' ? 'sv-SE' : 'en-GB',
                              { maximumFractionDigits: 1 },
                            )}
                            %
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <details className="method">
                    <summary>{t('Definitions & limitations')}</summary>
                    <div>
                      <p>
                        {t(
                          'Documented text rules define role families and detect technology mentions. A mention may be optional or negated.',
                        )}
                      </p>
                      <p>
                        {t(
                          'An ad is not a hire. The archive may not cover every Swedish vacancy, and title-based seniority is an approximation.',
                        )}
                      </p>
                      <a
                        href="https://github.com/korv9/swedish-job-market-analytics"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('Code and methodology on GitHub ↗')}
                      </a>
                    </div>
                  </details>
                </article>
              </div>
              <ProjectDataDisclosure
                title={t('Job ad tables and definitions')}
                initialDataset="fact_job_month_role"
                sectionId="job-data"
              />
            </div>
          )}
          {page === 'drugcomb' && (
            <div className="project-page">
              <div className="page-lead">
                <p className="eyebrow">{t('DrugComb Synergy Prediction')}</p>
                <h1>{t('DrugComb Synergy Prediction.')}</h1>
                <p>
                  {t(
                    'Experimental results from cleaned measurements through evaluation on unfamiliar pairs, drugs and cell lines.',
                  )}
                </p>
              </div>
              <div className="reports">
                <DrugCombReport />
                <ProjectDataDisclosure
                  title={t('Result tables and downloads')}
                  initialDataset="drugcomb_metrics"
                  sectionId="drugcomb-data"
                />
              </div>
            </div>
          )}
          {page === 'allegoria' && (
            <div className="project-page">
              <div className="page-lead">
                <p className="eyebrow">{t('Allegoria · work in progress')}</p>
                <h1>{t('Allegoria / RFC drift.')}</h1>
                <p>
                  {t(
                    'A compact experiment with real requirement profiles and a clearly labelled synthetic direction example.',
                  )}
                </p>
              </div>
              <div className="reports">
                <RfcReport />
              </div>
            </div>
          )}
          {page === 'thesis' && (
            <div className="project-page">
              <div className="page-lead">
                <p className="eyebrow">{t('Degree project · Fora')}</p>
                <h1>
                  {t('Finding useful review candidates in incident data.')}
                </h1>
                <p>
                  {t(
                    'My principal case study in data quality, privacy-aware NLP and clustering. Internal source records are not published.',
                  )}
                </p>
              </div>
              <div className="featured-projects">
                <div className="project-grid">
                  <article className="thesis-card" id="thesis">
                    <div className="project-card-head">
                      <span>{t('Degree project · Fora · 2026')}</span>
                      <strong>{t('Primary case study')}</strong>
                    </div>
                    <h3>{t('Finding review candidates in incident data')}</h3>
                    <p>
                      {t(
                        'Built a privacy-aware Azure Databricks workflow for data quality assessment and NLP clustering. The goal was to surface groups of similar incidents for manual review, without presenting clusters as proven root causes.',
                      )}
                    </p>
                    <div className="thesis-kpis">
                      <div>
                        <strong>16,811</strong>
                        <span>{t('anonymised incidents')}</span>
                      </div>
                      <div>
                        <strong>121</strong>
                        <span>{t('clusters found')}</span>
                      </div>
                      <div>
                        <strong>72</strong>
                        <span>{t('without an existing problem link')}</span>
                      </div>
                      <div>
                        <strong>0.706</strong>
                        <span>{t('best reported silhouette')}</span>
                      </div>
                    </div>
                    <div className="thesis-findings">
                      <div>
                        <span>01</span>
                        <p>
                          <strong>
                            {t('Data quality shaped the pipeline.')}
                          </strong>{' '}
                          {t(
                            'Selected ISO/IEC 25012 dimensions were assessed before the modelling stage.',
                          )}
                        </p>
                      </div>
                      <div>
                        <span>02</span>
                        <p>
                          <strong>
                            {t(
                              'HDBSCAN produced the stronger internal separation.',
                            )}
                          </strong>{' '}
                          {t(
                            'The reported silhouette was 0.706, compared with 0.534 for KMeans.',
                          )}
                        </p>
                      </div>
                      <div>
                        <span>03</span>
                        <p>
                          <strong>
                            {t('72 clusters became review candidates.')}
                          </strong>{' '}
                          {t(
                            'They lacked an existing problem link, but require domain validation before any root-cause claim.',
                          )}
                        </p>
                      </div>
                    </div>
                    <details>
                      <summary>{t('Pipeline & limitations')}</summary>
                      <p>
                        {t(
                          'Presidio for PII, multilingual sentence embeddings, UMAP to 10 dimensions, HDBSCAN and MLflow. Internal clustering metrics do not replace business validation, and no internal incident text or employer raw data is published here.',
                        )}
                      </p>
                    </details>
                  </article>
                </div>
              </div>
            </div>
          )}
          {page === 'homie' && (
            <div className="project-page">
              <div className="page-lead">
                <p className="eyebrow">{t('Homie API · work in progress')}</p>
                <h1>
                  {t('From household events to understandable analytics.')}
                </h1>
                <p>
                  {t(
                    'The API contract and data design are here for inspection. Several endpoints remain documented stubs.',
                  )}
                </p>
              </div>
              <div className="reports">
                <HomieProject />
              </div>
            </div>
          )}
        </Suspense>
      </main>
      <footer>
        <span>{t('Anton Ernstsson · Stockholm')}</span>
        <span>
          {t('Explore the projects · ')}
          <a href="#projects">{t('Back to all projects')}</a>
        </span>
      </footer>
    </>
  )
}

export default App
