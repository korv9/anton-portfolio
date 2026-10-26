/** News topics in the collected political news. */
import { l } from '../../i18n'
import { focal, Frame, useData, type Post } from '../kit'
import { Bars, int } from './pol-kit'

type News = {
  topics: { key: string; name_en: string; name_sv?: string }[]
  items: { topics: string[] }[]
}

/** Items per topic, most first; an item can carry several topics. A topic without a name is
 * left out, so a key never shows. */
const topicCounts = (d: News) => {
  const names = new Map(
    d.topics.map((t) => [t.key, l(t.name_en, t.name_sv ?? t.name_en)]),
  )
  const counts = new Map<string, number>()
  for (const t of d.items.flatMap((i) => i.topics))
    counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts]
    .filter(([k]) => names.has(k))
    .map(([k, n]) => ({ key: k, name: names.get(k)!, n }))
    .sort((a, b) => b.n - a.n)
}

function NewsTopics() {
  return (
    <Frame data={useData<News>('parliament/news.json')}>
      {(d) => (
        <Bars
          label={l('News items per topic, top 10', 'Nyheter per ämne, topp 10')}
          format={int}
          rows={topicCounts(d)
            .slice(0, 10)
            .map((t, i) => ({
              key: t.key,
              label: <span title={t.name}>{t.name}</span>,
              value: t.n,
              color: focal(i === 0),
            }))}
        />
      )}
    </Frame>
  )
}

function newsTitle(d: News) {
  const [top] = topicCounts(d)
  return top
    ? l(
        `${top.name} is the most common news topic: ${top.n} of ${d.items.length} items`,
        `${top.name} är det vanligaste nyhetsämnet: ${top.n} av ${d.items.length} nyheter`,
      )
    : l('News items per topic', 'Nyheter per ämne')
}

export const posts: Post[] = [
  {
    id: 'pol-news-topics',
    domain: 'politics',
    sources: ['parliament/news.json'],
    title: newsTitle,
    note: [
      'News items per topic, top 10; an item can have several topics. Sources: SVT, Ekot, Government Offices.',
      'Nyheter per ämne, topp 10; en nyhet kan ha flera ämnen. Källor: SVT, Ekot, Regeringskansliet.',
    ],
    render: () => <NewsTopics />,
  },
]
