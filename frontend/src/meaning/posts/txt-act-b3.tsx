/** AI Act cross-references: the articles other articles cite most. */
import { Frame, PALETTE, useData, type Post } from '../kit'
import { Bars, heading, usable } from './txt-kit'
import { l } from '../../i18n'

type Article = {
  article_number: string
  title_en: string
  title_sv?: string | null
  refers_to: string[]
}
const ARTICLES = 'ai-act/articles.json'
const d = 'ai-act'

/** How many other articles cite each article, most first. */
function cited(rows: Article[]) {
  const n = new Map<string, number>()
  for (const a of rows)
    for (const r of new Set(a.refers_to))
      if (r !== a.article_number) n.set(r, (n.get(r) ?? 0) + 1)
  return [...n].sort((a, b) => b[1] - a[1])
}
/** The source carries a stray quote on some titles. */
const clean = (t: string) => t.replace(/['’]+$/, '')

function ReferenceBars() {
  const data = usable(
    useData<Article[]>(ARTICLES),
    ARTICLES,
    (r) => cited(r).length,
  )
  return (
    <Frame data={data}>
      {(rows) => {
        const title = new Map(
          rows.map((a) => [
            a.article_number,
            l(a.title_en, a.title_sv || a.title_en),
          ]),
        )
        const ranked = cited(rows)
        return (
          <Bars
            label={l(
              'AI Act articles cited most often by other articles',
              'Artiklar i AI-förordningen som andra artiklar hänvisar till oftast',
            )}
            format={String}
            long
            focus={null}
            rows={ranked.map(([k, n]) => ({
              key: k,
              label: `${k} ${clean(title.get(k) ?? '')}`,
              value: n,
              color: n === ranked[0][1] ? PALETTE[0] : undefined,
            }))}
          />
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-reference-arcs',
    domain: d,
    sources: ['ai-act/articles.json'],
    title: heading((rows: Article[]) => {
      const ranked = cited(rows)
      if (!ranked.length) return ''
      const top = ranked.filter(([, n]) => n === ranked[0][1]).map(([k]) => k)
      const n = ranked[0][1]
      return top.length === 1
        ? l(
            `Article ${top[0]} is cited by ${n} other articles, the most`,
            `Artikel ${top[0]} hänvisas till av ${n} andra artiklar, flest av alla`,
          )
        : l(
            `Articles ${top.slice(0, -1).join(', ')} and ${top.at(-1)} are each cited by ${n} other articles`,
            `Artiklarna ${top.slice(0, -1).join(', ')} och ${top.at(-1)} hänvisas till av ${n} andra artiklar vardera`,
          )
    }),
    note: [
      'Other AI Act articles that refer to each article; the top ten show until opened',
      'Andra artiklar i AI-förordningen som hänvisar till varje artikel; de tio främsta visas tills kortet öppnas',
    ],
    render: () => <ReferenceBars />,
  },
]
