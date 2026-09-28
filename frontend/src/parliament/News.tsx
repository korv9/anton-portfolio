/**
 * Political news from SVT, Sveriges Radio Ekot and the Government Offices: headline, the
 * feed's own summary, time and a link to the article, which stays with its publisher
 * (platform/ingest/news, dbt tag:news, export_news.py).
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { PartyLogo, PartyTag, RIKSDAG_PARTIES } from '../parties/identity'
import { load } from './data'

export type NewsItem = {
  id: string
  source: 'svt' | 'ekot' | 'regeringen'
  title: string
  summary: string | null
  url: string
  published_at: string
  parties: string[]
  topics: string[]
}
export type News = {
  generated_at: string
  days: number
  collected_since: string | null
  sources: Record<
    string,
    {
      name: string
      url: string | null
      last_fetch: string | null
      last_success: string | null
      last_status: number | null
      last_error: string | null
    }
  >
  topics: { key: string; name_sv: string; name_en: string }[]
  party_counts_30d: Record<string, number>
  items: NewsItem[]
  method: string
}

const SOURCE_LABEL: Record<string, string> = {
  svt: 'SVT',
  ekot: 'Ekot',
  regeringen: 'Regeringen',
}

export function useNews() {
  const [news, setNews] = useState<News | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    load<News>('parliament/news.json')
      .then(setNews)
      .catch((reason: Error) => setError(reason.message))
  }, [])
  return { news, error }
}

const time = (iso: string) =>
  new Date(iso).toLocaleString('sv-SE', {
    timeZone: 'Europe/Stockholm',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(l('en-GB', 'sv-SE'), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

/** What the numbers cover: the archive is younger than 30 days until collection has run that long. */
function countsNote(news: News, shown: number) {
  const since = news.collected_since
  const young = since && Date.now() - Date.parse(since) < 30 * 86_400_000
  const start = since
    ? new Date(since).toLocaleDateString(l('en-GB', 'sv-SE'), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''
  return young
    ? l(
        `${shown} items. Collection started on ${start}; the feeds cannot be read backwards, so the number by each party counts the items naming it since then.`,
        `${shown} nyheter. Insamlingen startade ${start}; flödena går inte att läsa bakåt, så siffran vid varje parti räknar nyheterna som nämnt partiet sedan dess.`,
      )
    : l(
        `${shown} items in the last ${news.days} days. The number by each party is items naming it in the last 30 days.`,
        `${shown} nyheter de senaste ${news.days} dagarna. Siffran vid varje parti är nyheter som nämner partiet de senaste 30 dagarna.`,
      )
}

/** A list of news items, newest first. */
export function NewsList({
  news,
  items,
  compact = false,
}: {
  news: News
  items: NewsItem[]
  compact?: boolean
}) {
  const topicName = (key: string) => {
    const topic = news.topics.find((t) => t.key === key)
    return topic ? l(topic.name_en, topic.name_sv) : key
  }
  if (items.length === 0)
    return <p>{l('No news items yet.', 'Inga nyheter ännu.')}</p>
  return (
    <ol
      className={compact ? 'news-list compact' : 'news-list'}
      data-testid="news-list"
    >
      {items.map((item) => (
        <li key={item.id} className={`news-item source-${item.source}`}>
          <div className="news-meta">
            <span className="news-source">{SOURCE_LABEL[item.source]}</span>
            <time dateTime={item.published_at}>{time(item.published_at)}</time>
          </div>
          <a
            className="news-title"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.title}
          </a>
          {!compact && item.summary && (
            <p className="news-summary">{item.summary}</p>
          )}
          {(item.parties.length > 0 || item.topics.length > 0) && (
            <div className="news-tags">
              {item.parties.map((p) => (
                <a
                  key={p}
                  href={`#parties-${p.toLowerCase()}`}
                  className="news-party"
                >
                  <PartyTag party={p} size={14} />
                </a>
              ))}
              {!compact &&
                item.topics.map((t) => (
                  <span key={t} className="news-topic">
                    {topicName(t)}
                  </span>
                ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

/** The news view: every political item, filtered by party, source, topic or words. */
export default function NewsView() {
  const { news, error } = useNews()
  const [party, setParty] = useState('')
  const [source, setSource] = useState('')
  const [topic, setTopic] = useState('')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(40)
  const filtered = useMemo(
    () =>
      (news?.items ?? []).filter(
        (i) =>
          (!party || i.parties.includes(party)) &&
          (!source || i.source === source) &&
          (!topic || i.topics.includes(topic)) &&
          (!query ||
            `${i.title} ${i.summary ?? ''}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [news, party, source, topic, query],
  )
  if (error) return <p role="alert">{error}</p>
  if (!news) return <div className="loading">{l('Loading…', 'Laddar…')}</div>
  const days: [string, NewsItem[]][] = []
  for (const item of filtered.slice(0, limit)) {
    const key = dayKey(item.published_at)
    if (days.at(-1)?.[0] === key) days.at(-1)![1].push(item)
    else days.push([key, [item]])
  }
  return (
    <section className="report welfare-section" aria-labelledby="news-heading">
      <p className="eyebrow">{l('In the news', 'I nyheterna')}</p>
      <h2 id="news-heading">
        {l(
          'What the parties and the government are doing',
          'Vad partierna och regeringen gör',
        )}
      </h2>
      <div
        className="party-picker"
        role="group"
        aria-label={l('Party', 'Parti')}
      >
        {RIKSDAG_PARTIES.map((p) => (
          <button
            key={p}
            type="button"
            className={party === p ? 'party-chip on' : 'party-chip'}
            aria-pressed={party === p}
            onClick={() => setParty(party === p ? '' : p)}
          >
            <PartyLogo party={p} size={18} />
            {p}
            <small className="news-count">
              {news.party_counts_30d[p] ?? 0}
            </small>
          </button>
        ))}
      </div>
      <div className="slicers news-slicers">
        <label>
          {l('Source', 'Källa')}
          <select
            value={source}
            data-field="news-source"
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">{l('All sources', 'Alla källor')}</option>
            {Object.entries(news.sources).map(([key, s]) => (
              <option key={key} value={key}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {l('Topic', 'Ämne')}
          <select
            value={topic}
            data-field="news-topic"
            onChange={(e) => setTopic(e.target.value)}
          >
            <option value="">{l('All topics', 'Alla ämnen')}</option>
            {news.topics.map((t) => (
              <option key={t.key} value={t.key}>
                {l(t.name_en, t.name_sv)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {l('Search', 'Sök')}
          <input
            type="search"
            value={query}
            data-field="news-search"
            placeholder={l('e.g. talman', 't.ex. talman')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <p className="welfare-note">{countsNote(news, filtered.length)}</p>
      {days.map(([key, items]) => (
        <div key={key} className="news-day">
          <h3 className="analysis-subhead">{dayLabel(key)}</h3>
          <NewsList news={news} items={items} />
        </div>
      ))}
      {filtered.length > limit && (
        <button
          type="button"
          className="compact-toggle"
          onClick={() => setLimit(limit + 60)}
        >
          {l(
            `Show more (${filtered.length - limit} left)`,
            `Visa fler (${filtered.length - limit} kvar)`,
          )}
        </button>
      )}
      <details className="method">
        <summary>{l('Sources and method', 'Källor och metod')}</summary>
        <p>
          {l(
            news.method,
            'Rubriker och flödenas egna ingresser från SVT Nyheter, Sveriges Radio Ekot och Regeringskansliet, hämtade med några timmars mellanrum; varje nyhet länkar till artikeln, som ligger kvar hos sin utgivare. Nyheterna märks med de partier de nämner, så som redaktionerna skriver dem ("(S)", "SD:s", "Vänsterpartiet", "Tidöpartierna"), eller med fullständigt namn på en minister, talman eller ledamot i tjänst (riksdagens personlista), och ämnen efter nyckelord; en nyhet kan nämna ett parti utan att handla om det.',
          )}
        </p>
        <ul>
          {Object.entries(news.sources).map(([key, s]) => (
            <li key={key}>
              {s.url ? <a href={s.url}>{s.name}</a> : s.name}:{' '}
              {s.last_success
                ? l(
                    `last read ${time(s.last_success)}`,
                    `senast läst ${time(s.last_success)}`,
                  )
                : l('not read yet', 'inte läst ännu')}
              {s.last_error &&
                s.last_fetch !== s.last_success &&
                l(
                  ' (latest attempt failed)',
                  ' (senaste försöket misslyckades)',
                )}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
