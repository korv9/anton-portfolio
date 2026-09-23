import RfcReport from './RfcReport'
import { useEffect, useMemo, useState } from 'react'
import BudgetLab from './BudgetLab'
import PoliticsLab from './politics/PoliticsLab'
import './styles.css'

type UmapPoint = { chunk_id: string; topic_id: number; topic_label: string; x: number; y: number; party: string; speaker: string; session: string; speech_date: string; excerpt: string; source_url: string; session_population: number }
type Topic = { topic_id: number; topic_label: string; words: number; word_share_pct: number; is_unclustered: boolean }
type MonthlyAd = { month: string; role: string; new_ads: number; unique_employers: number }
type Technology = { cohort: string; technology: string; ads_mentioning: number; share_pct: number }

const sessions = ['2015-16', '2020-21', '2022-23', '2025-26']
const roles = ['Software Developer', 'Data Engineer', 'Data Scientist', 'Analytics Engineer']
const roleNames: Record<string, string> = { 'Software Developer': 'Software Developer', 'Data Engineer': 'Data Engineer', 'Data Scientist': 'Data Scientist', 'Analytics Engineer': 'Analytics Engineer' }
const topicColors = ['#087f7b', '#e45b39', '#7656a8', '#ca8b18', '#3679a6', '#be4774', '#5d7d3a', '#995a35']
const topicNames: Record<number, string> = {
  [-1]: 'Ungrouped', 0: 'Business & economy', 1: 'EMU & referendum', 2: 'Women & men',
  3: 'Police & crime', 4: 'Housing & rents', 5: 'Climate, energy & EU', 6: 'Migration',
  7: 'Sweden Democrats', 8: 'Schools & teachers', 9: 'Children & families', 10: 'General debate',
  11: 'Euro & currency', 12: 'Healthcare', 13: 'Elder care & pensions', 14: 'Taxes',
  15: 'Jobs & labour market', 16: 'EU & Europe', 17: 'UN & Afghanistan', 18: 'Parties & politics',
  19: 'Tax & public spending', 20: 'Russia & Ukraine', 21: 'NATO & defence', 22: 'Jobs & unemployment',
  23: 'Political responsibility', 24: 'Sweden & the world',
}
const topicName = (id: number, fallback: string) => topicNames[id] ?? fallback

function parseCsv<T>(text: string): T[] {
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((header, index) => {
      const value = values[index]
      return [header, value !== '' && Number.isFinite(Number(value)) ? Number(value) : value]
    })) as T
  })
}

function formatNumber(value: number) { return new Intl.NumberFormat('en-GB').format(value) }

function LineChart({ rows, role }: { rows: MonthlyAd[]; role: string }) {
  const data = rows.filter((row) => row.role === role)
  const width = 900, height = 330
  const margin = { top: 24, right: 24, bottom: 44, left: 62 }
  const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom
  const max = Math.max(...data.map((row) => row.new_ads))
  const yMax = Math.ceil(max / 100) * 100 || 10
  const x = (index: number) => margin.left + (index / Math.max(data.length - 1, 1)) * plotW
  const y = (value: number) => margin.top + plotH - (value / yMax) * plotH
  const points = data.map((row, index) => `${x(index)},${y(row.new_ads)}`).join(' ')
  const ticks = [0, .25, .5, .75, 1]
  return <div className="chart-wrap" tabIndex={0} aria-label="Chart scrolls horizontally on small screens"><svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`New ads per month for ${roleNames[role]}, 2022 to 2025`}>
    {ticks.map((tick) => <g key={tick}><line x1={margin.left} x2={width - margin.right} y1={y(yMax * tick)} y2={y(yMax * tick)} className="grid-line" /><text x={margin.left - 12} y={y(yMax * tick) + 4} textAnchor="end" className="axis-label">{formatNumber(Math.round(yMax * tick))}</text></g>)}
    {['2022', '2023', '2024', '2025'].map((year, index) => <text key={year} x={margin.left + (index / 3) * plotW} y={height - 12} textAnchor={index === 0 ? 'start' : index === 3 ? 'end' : 'middle'} className="axis-label">{year}</text>)}
    <polyline points={points} fill="none" stroke="#087f7b" strokeWidth="4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    {data.map((row, index) => <circle key={row.month} cx={x(index)} cy={y(row.new_ads)} r="4" className="line-point"><title>{`${row.month.slice(0, 7)}: ${formatNumber(row.new_ads)} ads`}</title></circle>)}
  </svg></div>
}

function UmapChart({ points, domainPoints, selected, onSelect, featuredTopics }: { points: UmapPoint[]; domainPoints: UmapPoint[]; selected: UmapPoint | null; onSelect: (point: UmapPoint) => void; featuredTopics: number[] }) {
  const width = 900, height = 520, pad = 28
  const xs = domainPoints.map((point) => point.x), ys = domainPoints.map((point) => point.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const scaleX = (value: number) => pad + ((value - minX) / Math.max(maxX - minX, 1)) * (width - pad * 2)
  const scaleY = (value: number) => height - pad - ((value - minY) / Math.max(maxY - minY, 1)) * (height - pad * 2)
  const color = (topic: number) => {
    if (topic === -1) return '#cbc9c1'
    const index = featuredTopics.indexOf(topic)
    return index >= 0 ? topicColors[index] : '#76817e'
  }
  return <div className="umap-frame"><svg className="umap-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="umap-title umap-desc">
    <title id="umap-title">Language map of debate segments</title><desc id="umap-desc">Each dot is a text segment. Nearby dots use similar language. Colour shows a machine-discovered topic.</desc><rect width={width} height={height} rx="8" className="plot-bg" />
    {points.map((point) => { const active = selected?.chunk_id === point.chunk_id; return <circle key={point.chunk_id} cx={scaleX(point.x)} cy={scaleY(point.y)} r={active ? 7 : 4.2} fill={color(point.topic_id)} opacity={point.topic_id === -1 ? .28 : featuredTopics.includes(point.topic_id) ? .78 : .42} className={active ? 'umap-point active' : 'umap-point'} onClick={() => onSelect(point)}><title>{`${point.speaker} · ${topicName(point.topic_id, point.topic_label)}`}</title></circle> })}
  </svg><p className="chart-hint">Select a dot to read the source excerpt.</p></div>
}

function ReportHeader({ number, eyebrow, title, intro, source, period, unit }: { number: string; eyebrow: string; title: string; intro: string; source: string; period: string; unit: string }) {
  return <header className="report-header"><div className="report-number">R{number}</div><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="report-intro">{intro}</p><dl className="source-strip"><div><dt>Source</dt><dd>{source}</dd></div><div><dt>Period</dt><dd>{period}</dd></div><div><dt>Unit</dt><dd>{unit}</dd></div></dl></div></header>
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [umap, setUmap] = useState<UmapPoint[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [monthly, setMonthly] = useState<MonthlyAd[]>([])
  const [technologies, setTechnologies] = useState<Technology[]>([])
  const [session, setSession] = useState('2025-26')
  const [party, setParty] = useState('All')
  const [selectedPoint, setSelectedPoint] = useState<UmapPoint | null>(null)
  const [role, setRole] = useState('Software Developer')
  const [loading, setLoading] = useState(true)

  useEffect(() => { Promise.all([
    fetch(`/data/debates/sessions/${session}/umap.json`).then((r) => r.json()),
    fetch('/data/debates/summary.json').then((r) => r.json()),
    fetch('/data/jobs/03_ads_by_month.csv').then((r) => r.text()),
    fetch('/data/jobs/06_top_technologies.csv').then((r) => r.text()),
  ]).then(([umapData, topicData, monthlyCsv, techCsv]) => {
    setUmap(umapData.data); setTopics(topicData.data); setMonthly(parseCsv<MonthlyAd>(monthlyCsv)); setTechnologies(parseCsv<Technology>(techCsv)); setSelectedPoint(umapData.data.find((point: UmapPoint) => point.topic_id !== -1) ?? umapData.data[0]); setLoading(false)
  }) }, [session])

  const parties = useMemo(() => ['All', ...Array.from(new Set(umap.map((point) => point.party))).sort()], [umap])
  const visiblePoints = party === 'All' ? umap : umap.filter((point) => point.party === party)
  const featuredTopics = useMemo(() => {
    const counts = new Map<number, number>()
    umap.forEach((point) => { if (point.topic_id !== -1) counts.set(point.topic_id, (counts.get(point.topic_id) ?? 0) + 1) })
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id)
  }, [umap])
  const groupedCount = visiblePoints.filter((point) => point.topic_id !== -1).length
  const groupedShare = visiblePoints.length ? groupedCount / visiblePoints.length * 100 : 0
  const sessionPopulation = umap[0]?.session_population ?? 0
  const topTopics = topics.filter((topic) => !topic.is_unclustered).slice(0, 7)
  const topTech = technologies.filter((tech) => tech.cohort === 'Data roles').slice(0, 10)
  const annual = useMemo(() => roles.map((item) => ({ role: item, values: [2022, 2023, 2024, 2025].map((year) => monthly.filter((row) => row.role === item && row.month.startsWith(String(year))).reduce((sum, row) => sum + row.new_ads, 0)) })), [monthly])
  const selectedAnnual = annual.find((item) => item.role === role)?.values ?? []

  return <><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><a className="wordmark" href="#start" aria-label="Anton Ernstsson, home"><span>AE</span><strong>Anton Ernstsson</strong></a><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="site-nav">{menuOpen ? 'Close' : 'Menu'}</button><nav id="site-nav" className={menuOpen ? 'nav open' : 'nav'} aria-label="Main navigation"><a href="#about" onClick={() => setMenuOpen(false)}>About</a><a href="#projects" onClick={() => setMenuOpen(false)}>Projects</a><a href="#reports" onClick={() => setMenuOpen(false)}>Reports</a><a className="nav-cv" href="/Anton_Ernstsson_CV_Data_Engineer.pdf" download>Download CV</a></nav></header>
    <main id="main"><section className="intro profile-home" id="start"><div className="intro-copy" id="about"><p className="eyebrow">Anton Ernstsson · Stockholm</p><h1>Data Engineer<br />& Analytics Engineer.</h1><p className="lede">I turn messy source data into reliable pipelines, analytical models and visual explanations. My professional experience is in data and applied AI; frontend is a supporting skill I use to make the results easier to explore.</p><div className="intro-links"><a href="#projects">View projects <span>↓</span></a><a href="mailto:anton.ernstson@gmail.com">Email me</a><a href="/Anton_Ernstsson_CV_Data_Engineer.pdf" download>Download CV</a></div></div>
      <aside className="profile-board" aria-label="Profile overview">
        <section><p className="eyebrow">Experience</p><div className="profile-rows"><div><time>2026</time><span><strong>Avtalat</strong><small>AI & data internship</small></span></div><div><time>2025–26</time><span><strong>Fora</strong><small>Data, NLP & degree project</small></span></div><div><time>2024–26</time><span><strong>JENSEN</strong><small>AI Developer programme</small></span></div></div></section>
        <section><p className="eyebrow">Tech stack</p><div className="stack-groups"><div><small>Data</small><span>Python · SQL · dbt</span></div><div><small>Platform</small><span>Azure · Databricks · Docker</span></div><div><small>Applied AI</small><span>NLP · embeddings · clustering</span></div><div><small>Delivery</small><span>FastAPI · React · TypeScript</span></div></div></section>
        <section className="profile-links"><a href="https://www.linkedin.com/in/anton-ernstsson" target="_blank" rel="noreferrer">LinkedIn ↗</a><a href="https://github.com/korv9" target="_blank" rel="noreferrer">GitHub ↗</a><span>Open to junior data roles</span></section>
      </aside></section>

      <section className="featured-projects" id="projects"><header><p className="eyebrow">Selected projects</p><h2>Data work with a question at the centre.</h2></header><div className="project-grid">
        <article className="thesis-card"><div className="project-card-head"><span>Degree project · Fora · 2026</span><strong>Primary case study</strong></div><h3>Finding review candidates in incident data</h3><p>Built a privacy-aware Azure Databricks workflow for data quality assessment and NLP clustering. The goal was to surface groups of similar incidents for manual review, without presenting clusters as proven root causes.</p><div className="thesis-kpis"><div><strong>16,811</strong><span>anonymised incidents</span></div><div><strong>121</strong><span>clusters found</span></div><div><strong>72</strong><span>without an existing problem link</span></div><div><strong>0.706</strong><span>best reported silhouette</span></div></div><div className="thesis-findings"><div><span>01</span><p><strong>Data quality shaped the pipeline.</strong> Selected ISO/IEC 25012 dimensions were assessed before the modelling stage.</p></div><div><span>02</span><p><strong>HDBSCAN produced the stronger internal separation.</strong> The reported silhouette was 0.706, compared with 0.534 for KMeans.</p></div><div><span>03</span><p><strong>72 clusters became review candidates.</strong> They lacked an existing problem link, but require domain validation before any root-cause claim.</p></div></div><details><summary>Pipeline & limitations</summary><p>Presidio for PII, multilingual sentence embeddings, UMAP to 10 dimensions, HDBSCAN and MLflow. Internal clustering metrics do not replace business validation, and no internal incident text or employer raw data is published here.</p></details></article>
        <div className="project-side"><a href="#politics"><span>Interactive observatory</span><h3>Swedish political observatory</h3><p>Speeches, recorded votes and source law, with traceable evidence.</p><strong>Explore report ↓</strong></a><a href="#job-market"><span>Interactive report</span><h3>Swedish job market analytics</h3><p>Ad volume, junior openings and technology mentions from 2022–2025.</p><strong>Explore report ↓</strong></a><article><span>More experiments</span><h3>Allegoria, Homie API & DrugComb</h3><p>Normative text analysis, FastAPI work and drug synergy prediction.</p><div className="inline-links"><a href="#rfc-drift">Allegoria · RFC drift ↓</a><a href="https://github.com/korv9/homie-api" target="_blank" rel="noreferrer">Homie ↗</a><a href="https://github.com/korv9/DrugComb-Synergy-Prediction" target="_blank" rel="noreferrer">DrugComb ↗</a></div></article></div>
      </div></section>

      <section className="reports" id="reports" aria-label="Reports"><PoliticsLab /><article className="report" id="debates"><ReportHeader number="01" eyebrow="Language & politics" title="What do party leaders talk about?" intro="A map of language used in Swedish party leader debates. Nearby dots use similar words; the map does not show political positions." source="Swedish Parliament open data" period="1993/94–2025/26" unit="Text segments" /><a className="report-jump" href="#budget-comparison">Explore debate × budget charts ↓</a><div className="kpis"><div><strong>10,055</strong><span>speeches analysed</span></div><div><strong>39,269</strong><span>text segments</span></div><div><strong>25</strong><span>topic clusters</span></div><div><strong>49.7%</strong><span>words ungrouped</span></div></div>
        <div className="viz-shell"><div className="viz-toolbar"><div><span className="control-label">Parliamentary session</span><div className="segmented">{sessions.map((item) => <button key={item} className={session === item ? 'active' : ''} onClick={() => { setLoading(true); setSession(item); setParty('All') }}>{item.replace('-', '/')}</button>)}</div></div><label><span className="control-label">Party</span><select value={party} onChange={(event) => { const nextParty = event.target.value; setParty(nextParty); setSelectedPoint(umap.find((point) => nextParty === 'All' || point.party === nextParty) ?? null) }}>{parties.map((item) => <option key={item}>{item}</option>)}</select></label></div>
          <div className="umap-guide"><div><strong>How to read the map</strong><span>Each dot is a text segment. Nearby dots use similar language. The axes have no direct meaning.</span></div><dl><div><dt>Shown</dt><dd>{formatNumber(visiblePoints.length)}</dd></div><div><dt>Sample grouped</dt><dd>{groupedShare.toFixed(0)}%</dd></div><div><dt>Full session</dt><dd>{formatNumber(sessionPopulation)}</dd></div></dl></div>
          <div className="topic-legend" aria-label="Topic colour legend">{featuredTopics.map((id, index) => <span key={id}><i style={{ background: topicColors[index] }} />{topicName(id, String(id))}</span>)}<span><i style={{ background:'#76817e' }} />Other topics</span><span><i style={{ background:'#cbc9c1' }} />Ungrouped</span></div>
          <div className="umap-layout"><div>{loading ? <div className="loading">Loading report data…</div> : <UmapChart points={visiblePoints} domainPoints={umap} selected={selectedPoint} onSelect={setSelectedPoint} featuredTopics={featuredTopics} />}</div><aside className="point-detail" aria-live="polite"><p className="eyebrow">Selected segment</p>{selectedPoint ? <><h3>{topicName(selectedPoint.topic_id, selectedPoint.topic_label)}</h3><p className="speaker">{selectedPoint.speaker} · {selectedPoint.party}<br /><time>{selectedPoint.speech_date}</time></p><small className="source-language">Original Swedish excerpt</small><blockquote>“{selectedPoint.excerpt}…”</blockquote><a href={selectedPoint.source_url} target="_blank" rel="noreferrer">Open parliamentary source ↗</a></> : <p>Select a dot on the map.</p>}</aside></div></div>
        <div className="reading-grid compact-reading"><div className="finding"><p className="eyebrow">Main observation</p><h3>Climate, energy and the EU form the largest coherent cluster.</h3><p>It accounts for 13.3% of all words. Almost half the words remain ungrouped.</p></div><div className="bar-list" aria-label="Largest topic clusters by word share">{topTopics.slice(0, 5).map((topic) => <div key={topic.topic_id}><div><span>{topicName(topic.topic_id, topic.topic_label)}</span><strong>{topic.word_share_pct.toLocaleString('en-GB', { maximumFractionDigits: 1 })}%</strong></div><span className="bar"><i style={{ width: `${topic.word_share_pct / topTopics[0].word_share_pct * 100}%`, background: topicColors[Math.abs(topic.topic_id) % topicColors.length] }} /></span></div>)}</div></div>
        <details className="method"><summary>Method & limitations</summary><div><p>Segments are embedded with <code>paraphrase-multilingual-MiniLM-L12-v2</code>, reduced with UMAP and clustered with HDBSCAN. The map shows a deterministic sample of up to 400 segments per session.</p><p>Two-dimensional distance is approximate. Labels are machine-generated keywords, not manual coding. Clusters describe language patterns, not political positions.</p><a href="https://github.com/korv9/partiledardebatt-analys" target="_blank" rel="noreferrer">Code and documentation on GitHub ↗</a></div></details><BudgetLab /></article>

        <RfcReport /><article className="report" id="job-market"><ReportHeader number="02" eyebrow="Labour market & technology" title="What is happening to tech jobs?" intro="A compact view of ad volume, junior openings and technologies mentioned in Swedish job ads." source="JobTech Historical Ads" period="2022–2025" unit="Unique ad IDs" /><div className="kpis jobs-kpis"><div><strong>35,726</strong><span>ads in the sample</span></div><div><strong>2,862</strong><span>unique employers</span></div><div><strong>−52.6%</strong><span>developer ads, 2022–25</span></div><div><strong>4.1%</strong><span>junior share</span></div></div>
        <div className="viz-shell"><div className="viz-toolbar"><div><span className="control-label">Role family</span><div className="role-tabs">{roles.map((item) => <button key={item} className={role === item ? 'active' : ''} onClick={() => setRole(item)}>{roleNames[item]}</button>)}</div></div></div><div className="job-chart-head"><div><p className="eyebrow">New ads per month</p><h3>{roleNames[role]}</h3></div><div className="year-totals">{selectedAnnual.map((value, index) => <span key={index}><small>{2022 + index}</small><strong>{formatNumber(value)}</strong></span>)}</div></div>{monthly.length ? <LineChart rows={monthly} role={role} /> : <div className="loading">Loading report data…</div>}</div>
        <div className="reading-grid compact-reading"><div className="finding"><p className="eyebrow">Main observation</p><h3>Junior openings fell faster than total volume.</h3><p>Junior software ads fell from 651 in 2022 to 187 in 2025: −71.3%, compared with −52.6% for all software ads.</p></div><div className="tech-bars"><p className="eyebrow">Most mentioned in data ads</p>{topTech.slice(0, 7).map((tech) => <div key={tech.technology}><span>{tech.technology}</span><span className="bar"><i style={{ width: `${tech.share_pct / topTech[0].share_pct * 100}%` }} /></span><strong>{tech.share_pct.toLocaleString('en-GB', { maximumFractionDigits: 1 })}%</strong></div>)}</div></div>
        <details className="method"><summary>Definitions & limitations</summary><div><p>Documented text rules define role families and detect technology mentions. A mention may be optional or negated.</p><p>An ad is not a hire. The archive may not cover every Swedish vacancy, and title-based seniority is an approximation.</p><a href="https://github.com/korv9/swedish-job-market-analytics" target="_blank" rel="noreferrer">Code and methodology on GitHub ↗</a></div></details></article></section>

      </main>
    <footer><span>Anton Ernstsson · Stockholm</span><span>Reports built from verified exports</span></footer></>
}

export default App
