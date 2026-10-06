/**
 * The language map of party-leader debates: a UMAP projection of sampled speech segments,
 * coloured by machine-found topic, with the source excerpt beside it. A deep dive under
 * "Vad politikerna pratar om".
 */
import { useEffect, useMemo, useState } from 'react'
import { currentLocale, t } from '../i18n'
import { fetchData } from '../dataSource'
import ReportHeader from '../site/ReportHeader'

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
type DebateOverview = {
  analyzed_speeches: number
  analyzed_segments: number
  first_date: string
  last_date: string
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
async function fetchReport(url: string) {
  const response = await fetchData(url)
  if (!response.ok) throw new Error(`Report data unavailable: ${url}`)
  return response.json()
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

export default function LanguageMap() {
  const [umap, setUmap] = useState<UmapPoint[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [debateOverview, setDebateOverview] = useState<DebateOverview | null>(
    null,
  )
  const [sessions, setSessions] = useState<string[]>([])
  // Empty until the topic mart names its sessions; then the latest is chosen.
  const [session, setSession] = useState('')
  const [party, setParty] = useState('All')
  const [selectedPoint, setSelectedPoint] = useState<UmapPoint | null>(null)
  const [loading, setLoading] = useState(true)
  const [reportError, setReportError] = useState<string | null>(null)

  useEffect(() => {
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
  }, [session])

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

  return (
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
        {t('Explore debate × budget charts')}
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
              ? topics.filter((topic) => !topic.is_unclustered).length
              : '—'}
          </strong>
          <span>{t('topic clusters')}</span>
        </div>
        <div>
          <strong>
            {unclusteredShare == null ? '—' : `${unclusteredShare.toFixed(1)}%`}
          </strong>
          <span>{t('words ungrouped')}</span>
        </div>
      </div>
      <div className="viz-shell">
        <div className="viz-toolbar">
          <div>
            <span className="control-label">{t('Parliamentary session')}</span>
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
                    (point) => nextParty === 'All' || point.party === nextParty,
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
        <div className="topic-legend" aria-label={t('Topic colour legend')}>
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
                    (point) => point.chunk_id === event.target.value,
                  ) ?? null,
                )
              }
            >
              <option value="">{t('Choose a segment')}</option>
              {visiblePoints.map((point) => (
                <option key={point.chunk_id} value={point.chunk_id}>
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
              <div className="loading">{t('Loading report data…')}</div>
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
                  {topicName(selectedPoint.topic_id, selectedPoint.topic_label)}
                </h3>
                <p className="speaker">
                  {selectedPoint.speaker} · {selectedPoint.party}
                  <br />
                  <time>{selectedPoint.speech_date}</time>
                </p>
                <small className="source-language">
                  {t('Original Swedish excerpt')}
                </small>
                <blockquote lang="sv">“{selectedPoint.excerpt}…”</blockquote>
                <a
                  href={selectedPoint.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('Open parliamentary source')}
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
                <span>{topicName(topic.topic_id, topic.topic_label)}</span>
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
                        Math.abs(topic.topic_id) % topicColors.length
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
            <code>{t('paraphrase-multilingual-MiniLM-L12-v2')}</code>
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
            {t('Code and documentation on GitHub')}
          </a>
        </div>
      </details>
    </article>
  )
}
