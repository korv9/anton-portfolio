/**
 * Nyheter: the political news from SVT, Sveriges Radio Ekot and the Government Offices, with
 * the week's summary on top. The summary is written by Claude from the headlines only
 * (platform/publish/summarize_news.py) and every theme links to the items it rests on; until
 * one has been generated the page says so and shows the headlines alone. Below it: which parties
 * the news names, the topics, and the feed itself, filtered by source, topic, party and words.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import { load } from '../../parliament/data'
import type { News, NewsItem } from '../../parliament/news'
import {
  PartyLogo,
  RIKSDAG_PARTIES,
  identity,
  partyName,
} from '../../parties/identity'
import type { Route } from '../../router'
import { Board, Card, Cards, Empty, Kpi, Kpis } from '../board/Board'
import { Select, dayName, num } from '../controls'
import { useParties } from '../partySelection'
import { useViewParams } from '../useViewParams'
import './nyheter.css'

type Summary = {
  generated_at: string
  model: string
  period: { from: string; to: string; days: number }
  items_considered: number
  headline: string
  summary: string
  themes: {
    title: string
    text: string
    parties: string[]
    item_ids: string[]
  }[]
  by_party: { party: string; text: string; item_ids: string[] }[]
  method: string
}

const SOURCES: Record<string, string> = {
  svt: 'SVT',
  ekot: 'Ekot',
  regeringen: 'Regeringen',
}
const DEFAULTS = { kalla: '', amne: '', sok: '' }

const time = (iso: string) =>
  new Date(iso).toLocaleString(l('en-GB', 'sv-SE'), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function NyheterTheme({ route }: { route: Route }) {
  const [news, setNews] = useState<News | null>(null)
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useViewParams(route, DEFAULTS)
  const [query, setQuery] = useState(view.sok)
  const { selected } = useParties(route)
  useEffect(() => {
    load<News>('parliament/news.json')
      .then(setNews)
      .catch((e: Error) => setError(e.message))
    load<Summary>('parliament/news-summaries.json')
      .then(setSummary)
      .catch(() => setSummary(null))
  }, [])

  const items = useMemo(() => {
    if (!news) return []
    const words = query.trim().toLowerCase()
    return news.items.filter(
      (i) =>
        (!view.kalla || i.source === view.kalla) &&
        (!view.amne || i.topics.includes(view.amne)) &&
        (!selected.length || selected.some((p) => i.parties.includes(p))) &&
        (!words ||
          `${i.title} ${i.summary ?? ''}`.toLowerCase().includes(words)),
    )
  }, [news, view.kalla, view.amne, selected, query])

  if (error)
    return (
      <p role="alert" className="theme-error">
        {error}
      </p>
    )
  if (!news) return <Empty />

  const byId = new Map(news.items.map((i) => [i.id, i]))
  const topicName = (key: string) => {
    const t = news.topics.find((x) => x.key === key)
    return t ? l(t.name_en, t.name_sv) : key
  }
  const newest = news.items[0]?.published_at
  const weekAgo = newest ? Date.parse(newest) - 7 * 86_400_000 : 0
  const thisWeek = news.items.filter(
    (i) => Date.parse(i.published_at) >= weekAgo,
  ).length
  const counts = RIKSDAG_PARTIES.map((p) => ({
    party: p,
    n: news.party_counts_30d[p] ?? 0,
  })).sort((a, b) => b.n - a.n)
  const topCount = Math.max(1, ...counts.map((c) => c.n))
  const topicCounts = news.topics
    .map((t) => ({
      key: t.key,
      n: news.items.filter((i) => i.topics.includes(t.key)).length,
    }))
    .filter((t) => t.n > 0)
    .sort((a, b) => b.n - a.n)

  const cite = (ids: string[]) =>
    ids
      .map((id) => byId.get(id))
      .filter((i): i is NewsItem => !!i)
      .slice(0, 4)

  return (
    <Board
      title={l('Political news', 'Politiska nyheter')}
      sub={l(
        `Headlines from SVT, Ekot and the Government Offices, the last ${news.days} days, tagged by the parties and topics they name. Each links to the article, which stays with its publisher.`,
        `Rubriker från SVT, Ekot och Regeringskansliet de senaste ${news.days} dagarna, märkta med de partier och ämnen de nämner. Varje rubrik länkar till artikeln, som ligger kvar hos utgivaren.`,
      )}
      slicers={
        <>
          <Select
            label={l('Source', 'Källa')}
            value={view.kalla}
            options={[
              { value: '', label: l('All sources', 'Alla källor') },
              ...Object.entries(SOURCES).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            onChange={(kalla) => setView({ kalla })}
          />
          <Select
            label={l('Topic', 'Ämne')}
            value={view.amne}
            options={[
              { value: '', label: l('All topics', 'Alla ämnen') },
              ...news.topics.map((t) => ({
                value: t.key,
                label: l(t.name_en, t.name_sv),
              })),
            ]}
            onChange={(amne) => setView({ amne })}
          />
          <label className="board-search">
            <span>{l('Search', 'Sök')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setView({ sok: e.target.value })
              }}
              placeholder={l('e.g. budget', 't.ex. budget')}
            />
          </label>
        </>
      }
    >
      <Kpis>
        <Kpi
          index={1}
          label={l('This week', 'Den här veckan')}
          value={thisWeek}
          format={(v) => num(v)}
          sub={newest ? `${l('newest', 'senaste')} ${dayName(newest)}` : ''}
        />
        <Kpi
          index={2}
          label={l('Named most', 'Nämns mest')}
          value={counts[0]?.n ?? 0}
          format={(v) => `${counts[0]?.party ?? ''} ${num(v)}`}
          sub={l('last 30 days', 'senaste 30 dagarna')}
        />
      </Kpis>

      <Cards>
        <Card
          index={0}
          wide
          title={l('The week in summary', 'Veckan i sammandrag')}
          meta={
            summary
              ? l(
                  `${dayName(summary.period.from)}–${dayName(summary.period.to)}, ${summary.items_considered} headlines, written by a language model (${summary.model}) from the headlines only, each theme linked to its sources`,
                  `${dayName(summary.period.from)}–${dayName(summary.period.to)}, ${summary.items_considered} rubriker, skriven av en språkmodell (${summary.model}) enbart utifrån rubrikerna, varje tema länkat till sina källor`,
                )
              : undefined
          }
        >
          {summary === undefined ? (
            <Empty />
          ) : summary ? (
            <div className="news-summary">
              <p className="news-summary-headline">{summary.headline}</p>
              <p className="news-summary-text">{summary.summary}</p>
              <ol className="news-themes">
                {summary.themes.map((t) => (
                  <li key={t.title}>
                    <h3>{t.title}</h3>
                    <p>{t.text}</p>
                    {t.parties.length > 0 && (
                      <p className="news-parties">
                        {t.parties.map((p) => (
                          <span key={p} title={partyName(p)}>
                            <PartyLogo party={p} size={18} /> {p}
                          </span>
                        ))}
                      </p>
                    )}
                    <ul className="news-cites">
                      {cite(t.item_ids).map((i) => (
                        <li key={i.id}>
                          <a href={i.url} target="_blank" rel="noreferrer">
                            {SOURCES[i.source]}: {i.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              {summary.by_party.length > 0 && (
                <ul className="news-by-party">
                  {summary.by_party.map((n) => (
                    <li
                      key={n.party}
                      style={{ ['--party' as string]: identity(n.party).color }}
                    >
                      <b>
                        <PartyLogo party={n.party} size={20} /> {n.party}
                      </b>
                      <span>{n.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="news-summary-missing">
              <p>
                {l(
                  'No summary has been generated yet. It is written by Claude from the week’s headlines when the news refresh runs with an API key (platform/publish/summarize_news.py): themes and party notes that must cite the headlines they rest on, and anything that cannot be traced is removed before it is published.',
                  'Ingen sammanfattning har genererats ännu. Den skrivs av Claude utifrån veckans rubriker när nyhetsuppdateringen körs med en API-nyckel (platform/publish/summarize_news.py): teman och partinoteringar som måste hänvisa till rubrikerna de bygger på, och allt som inte kan spåras tas bort innan det publiceras.',
                )}
              </p>
            </div>
          )}
        </Card>

        <Card
          index={1}
          title={l(
            'Which parties the news names',
            'Vilka partier nyheterna nämner',
          )}
          meta={l(
            'Headlines naming each party, last 30 days, naming is not the same as being about',
            'Rubriker som nämner partiet, senaste 30 dagarna, att nämnas är inte samma sak som att handla om',
          )}
        >
          <ul className="news-party-bars">
            {counts.map((c) => (
              <li key={c.party}>
                <span>
                  <PartyLogo party={c.party} size={18} /> {c.party}
                </span>
                <i>
                  <b
                    style={{
                      width: `${(c.n / topCount) * 100}%`,
                      background: identity(c.party).color,
                    }}
                  />
                </i>
                <span className="num">{num(c.n)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          index={2}
          title={l('Topics', 'Ämnen')}
          meta={l(
            'Headlines per topic, click to filter',
            'Rubriker per ämne, klicka för att filtrera',
          )}
        >
          <ul className="news-topics">
            {topicCounts.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  aria-pressed={view.amne === t.key}
                  onClick={() =>
                    setView({ amne: view.amne === t.key ? '' : t.key })
                  }
                >
                  {topicName(t.key)} <span>{num(t.n)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          index={3}
          wide
          title={l('The headlines', 'Rubrikerna')}
          meta={l(
            `${num(items.length)} of ${num(news.items.length)}, newest first${selected.length ? `, naming ${selected.join(', ')}` : ''}`,
            `${num(items.length)} av ${num(news.items.length)}, nyast först${selected.length ? `, som nämner ${selected.join(', ')}` : ''}`,
          )}
        >
          <ol className="news-feed">
            {items.slice(0, 60).map((i) => (
              <li key={i.id}>
                <span className={`news-source ${i.source}`}>
                  {SOURCES[i.source]}
                </span>
                <div>
                  <a href={i.url} target="_blank" rel="noreferrer">
                    <b>{i.title}</b>
                  </a>
                  {i.summary && <p>{i.summary}</p>}
                  <p className="news-tags">
                    <time dateTime={i.published_at}>
                      {time(i.published_at)}
                    </time>
                    {i.parties.map((p) => (
                      <span key={p} className="news-party" title={partyName(p)}>
                        {RIKSDAG_PARTIES.includes(p) && (
                          <PartyLogo party={p} size={16} />
                        )}
                        {p}
                      </span>
                    ))}
                    {i.topics.map((t) => (
                      <span key={t} className="news-topic">
                        {topicName(t)}
                      </span>
                    ))}
                  </p>
                </div>
              </li>
            ))}
            {items.length === 0 && (
              <li className="dash-empty">
                {l('No headline matches.', 'Ingen rubrik matchar.')}
              </li>
            )}
          </ol>
          <p className="dash-meta">{news.method}</p>
        </Card>
      </Cards>
    </Board>
  )
}
