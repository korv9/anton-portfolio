/** AI Act size: characters per chapter and the Act's headline counts. */
import { Frame, useData, type Post } from '../kit'
import { Bars, Kpis, fmt, heading, sentence, sum, usable } from './txt-kit'
import { l } from '../../i18n'

type Article = { article_number: string; chapter: string; char_count: number }
type Chapter = {
  chapter: string
  chapter_title_en: string
  chapter_title_sv?: string | null
}
type Summary = { counts: Record<string, number> }
const ARTICLES = 'ai-act/articles.json'
const CHAPTERS = 'ai-act/chapters.json'
const SUMMARY = 'ai-act/summary.json'
const d = 'ai-act'

/** Characters per chapter, largest first. */
const byChapter = (rows: Article[]) =>
  [
    ...rows.reduce(
      (m, a) => m.set(a.chapter, (m.get(a.chapter) ?? 0) + a.char_count),
      new Map<string, number>(),
    ),
  ].sort((a, b) => b[1] - a[1])

function ArticleBars() {
  const data = usable(useData<Article[]>(ARTICLES), ARTICLES, (r) => r.length)
  const names = usable(useData<Chapter[]>(CHAPTERS), CHAPTERS, (r) => r.length)
  return (
    <Frame data={data}>
      {(rows) => (
        <Frame data={names}>
          {(chapters) => {
            // The file has a row per section; the chapter heading repeats on each.
            const title = new Map(
              chapters.map((c) => [
                c.chapter,
                sentence(
                  l(
                    c.chapter_title_en,
                    c.chapter_title_sv || c.chapter_title_en,
                  ),
                ),
              ]),
            )
            return (
              <Bars
                label={l(
                  'Characters per chapter of the AI Act, largest first',
                  'Tecken per kapitel i AI-förordningen, störst först',
                )}
                format={fmt}
                long
                rows={byChapter(rows).map(([c, n]) => ({
                  key: c,
                  label: `${c} ${title.get(c) ?? ''}`,
                  value: n,
                }))}
              />
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

/** The four counts the card shows; a count missing from the file leaves the card. */
const KEYS: [string, string, string][] = [
  ['articles', 'articles', 'artiklar'],
  [
    'articles_changed',
    'new or amended since 2024',
    'nya eller ändrade sedan 2024',
  ],
  [
    'obligations',
    'obligations on named actors',
    'skyldigheter för namngivna aktörer',
  ],
  ['actors', 'defined actors', 'definierade aktörer'],
]
const complete = (s: Summary) =>
  KEYS.every(([k]) => Number.isFinite(s.counts?.[k]))

function Counts() {
  const data = usable(useData<Summary>(SUMMARY), SUMMARY, complete)
  return (
    <Frame data={data}>
      {({ counts: c }) => (
        <Kpis items={KEYS.map(([k, en, sv]) => [fmt(c[k]), l(en, sv)])} />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-article-bars',
    domain: d,
    sources: ['ai-act/articles.json', 'ai-act/chapters.json'],
    size: 'wide',
    title: heading((rows: Article[]) => {
      const [[c, n]] = byChapter(rows)
      const all = sum(rows.map((a) => a.char_count))
      const p = Math.round((n / all) * 100)
      return l(
        `Chapter ${c} holds ${p}% of the Act's text, the most of any chapter`,
        `Kapitel ${c} rymmer ${p} % av förordningens text, mest av alla kapitel`,
      )
    }),
    note: [
      'Characters per chapter of Regulation (EU) 2024/1689, consolidated text',
      'Tecken per kapitel i förordning (EU) 2024/1689, konsoliderad text',
    ],
    render: () => <ArticleBars />,
  },
  {
    id: 'txt-act-counts',
    domain: d,
    sources: ['ai-act/summary.json'],
    title: heading((s: Summary) =>
      complete(s)
        ? l(
            `${s.counts.articles_changed} of the ${s.counts.articles} articles are new or amended since 2024`,
            `${s.counts.articles_changed} av förordningens ${s.counts.articles} artiklar är nya eller ändrade sedan 2024`,
          )
        : '',
    ),
    note: [
      'Regulation (EU) 2024/1689; counts from EUR-Lex, consolidated text',
      'Förordning (EU) 2024/1689; antal från EUR-Lex, konsoliderad text',
    ],
    render: () => <Counts />,
  },
]
