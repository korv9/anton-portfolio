/**
 * One article of the current consolidated text: its text verbatim in the reader's language,
 * where it sits, when it applies (with the sentence of Article 113 that says so), how it
 * changed since 2024, the obligations mapped to it and the articles it refers to.
 */
import { useEffect, useState } from 'react'
import { currentLocale, l } from '../i18n'
import { articleStatus } from './logic'
import { loadTexts } from './data'
import {
  actorLabel,
  ArticleLink,
  fmtDate,
  Kind,
  Source,
  Status,
} from './shared'
import { ObligationList } from './views'
import type { AiActData } from './types'

export function ArticleView({
  data,
  today,
  number,
}: {
  data: AiActData
  today: string
  number: string
}) {
  const lang = currentLocale() === 'sv' ? 'sv' : 'en'
  const [text, setText] = useState<string | null>(null)
  const article = data.articles.find((a) => a.article_number === number)
  useEffect(() => {
    setText(null)
    if (!article) return
    let live = true
    loadTexts(lang)
      .then((t) => live && setText(t[article.article_id] ?? ''))
      .catch(() => live && setText(''))
    return () => {
      live = false
    }
  }, [article?.article_id, lang])

  if (!article)
    return (
      <p className="aa-lede">
        {l(
          'No such article in the current text.',
          'Ingen sådan artikel i den gällande texten.',
        )}{' '}
        <a href="#ai-act-today">{l('All articles', 'Alla artiklar')}</a>
      </p>
    )
  const index = data.articles.indexOf(article)
  const prev = data.articles[index - 1]
  const next = data.articles[index + 1]
  const chapter = data.chapters.find(
    (c) =>
      c.chapter === article.chapter &&
      (c.section ?? null) === (article.section ?? null),
  )
  const status = articleStatus(article, today)
  const obligations = data.obligations.filter(
    (o) => o.article_number === article.article_number,
  )
  const guidance = data.guidance.filter((g) =>
    article.guidance.includes(g.guidance_id),
  )
  const change = {
    inserted: l(
      'New: inserted by the amending act',
      'Ny: införd genom ändringsakten',
    ),
    amended: l('Amended since 2024', 'Ändrad sedan 2024'),
    unchanged: l('Unchanged since 2024', 'Oförändrad sedan 2024'),
    text_differs: l(
      'Text differs from 2024; no amendment marker',
      'Texten skiljer sig från 2024; ingen ändringsmarkering',
    ),
  }[article.change_type]

  return (
    <article className="aa-article">
      <header>
        <p className="aa-kicker">
          {l('Chapter', 'Kapitel')} {article.chapter}
          {chapter &&
            `, ${l(chapter.chapter_title_en, chapter.chapter_title_sv).toLowerCase()}`}
          {article.section &&
            chapter?.section_title_en &&
            `, ${l('Section', 'Avsnitt')} ${article.section}: ${l(chapter.section_title_en, chapter.section_title_sv ?? '')}`}
        </p>
        <h2>
          {l('Article', 'Artikel')} {article.article_number}
          <span>{l(article.title_en, article.title_sv)}</span>
        </h2>
        <dl className="aa-article-facts">
          <div>
            <dt>{l('Applies', 'Gäller')}</dt>
            <dd>
              <Status status={status} /> {l('from', 'från')}{' '}
              {fmtDate(article.applies_from)}
              {article.applies_from_second &&
                ` ${l('and', 'och')} ${fmtDate(article.applies_from_second)}`}
              <small>
                {l(article.application_note_en, article.application_note_sv)}{' '}
                <ArticleLink n="113">
                  {l('Article 113', 'Artikel 113')}
                </ArticleLink>
                : “{article.application_quote}”
              </small>
            </dd>
          </div>
          <div>
            <dt>{l('Since 2024', 'Sedan 2024')}</dt>
            <dd>
              {change}
              {article.amended_by.length > 0 && (
                <small>{article.amended_by.join(', ')}</small>
              )}
            </dd>
          </div>
          {article.actors.length > 0 && (
            <div>
              <dt>{l('Puts duties on', 'Lägger skyldigheter på')}</dt>
              <dd>
                {article.actors
                  .map((a) => actorLabel(data.actors, a))
                  .join(', ')}{' '}
                <Kind type="derived" />
              </dd>
            </div>
          )}
        </dl>
      </header>
      <div className="aa-legal-text" lang={lang}>
        <p className="aa-kicker">
          <Kind type="source" />{' '}
          {lang === 'sv'
            ? 'Officiell svensk språkversion, konsoliderad text'
            : 'Official English text, consolidated version'}
        </p>
        {text === null ? (
          <p className="aa-muted">{l('Loading the text…', 'Hämtar texten…')}</p>
        ) : (
          text.split('\n').map((line, i) => <p key={i}>{line}</p>)
        )}
        <Source href={article.source_url}>
          {l('Read on EUR-Lex', 'Läs på EUR-Lex')}
        </Source>
      </div>
      {obligations.length > 0 && (
        <section className="aa-section">
          <h3>
            {l(
              'Obligations mapped to this article',
              'Skyldigheter kopplade till artikeln',
            )}
          </h3>
          <ObligationList data={data} today={today} items={obligations} />
        </section>
      )}
      {(article.refers_to.length > 0 || guidance.length > 0) && (
        <section className="aa-section aa-related">
          {article.refers_to.length > 0 && (
            <p>
              <Kind type="derived" /> {l('Refers to', 'Hänvisar till')}{' '}
              {article.refers_to.map((a, i) => (
                <span key={a}>
                  {i > 0 && ', '}
                  <ArticleLink n={a}>{a}</ArticleLink>
                </span>
              ))}
            </p>
          )}
          {guidance.map((g) => (
            <p key={g.guidance_id}>
              {l('Commission guidance', 'Kommissionens vägledning')}:{' '}
              <Source href={g.source_url}>{g.title}</Source>
            </p>
          ))}
        </section>
      )}
      <nav className="aa-article-nav" aria-label={l('Articles', 'Artiklar')}>
        {prev ? (
          <ArticleLink n={prev.article_number}>
            ← {l('Article', 'Artikel')} {prev.article_number}
          </ArticleLink>
        ) : (
          <span />
        )}
        <a href="#ai-act-today">{l('All articles', 'Alla artiklar')}</a>
        {next ? (
          <ArticleLink n={next.article_number}>
            {l('Article', 'Artikel')} {next.article_number} →
          </ArticleLink>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}
