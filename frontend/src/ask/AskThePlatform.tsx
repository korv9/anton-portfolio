/**
 * Ask the platform (docs/workers-ai.md): a question about how this site is built, answered from its
 * own documents, dbt models and data catalogue through the same path as Ask the law. The corpus
 * loads when the reader reaches the field; the Worker embeds the question, the browser finds the
 * eight nearest passages and the Worker returns an answer only when every quote is verbatim. Each
 * quote links to its file at the commit it was read from, and the first quoted passage that names
 * a node of architecture/graph.json gets its five-step path. With the day's quota spent, the three
 * precomputed examples still answer.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import {
  answer as ask,
  embed,
  fallback,
  loadCorpus,
  nearest,
  Unavailable,
  type Answer,
  type Corpus,
} from '../workersAi/corpus'
import { lineage, type Graph } from './lineage'
import { LineageStrip } from './LineageStrip'
import './ask.css'

type Item = {
  id: string
  title: string
  url: string
  text: string
  path: string
  commit: string
  nodes: string[]
}
type Example = { question: string; vector: number[]; answer?: Answer }
type Hit = { item: Item; score: number }

const CORPUS = 'platform'
const TOP = 8
const MAX = 500
// As the Worker's parser: a colon or white space may sit between [[id]] and its quote.
const QUOTE = /\[\[([^\]]+)\]\]\s*:?\s*"([^"]+)"/g
/** The answer with each [[id]]"quote" as a quote followed by its file and commit. */
function Quoted({ text, items }: { text: string; items: Map<string, Item> }) {
  const parts: ReactNode[] = []
  let at = 0
  for (const m of text.matchAll(QUOTE)) {
    const item = items.get(m[1])
    parts.push(text.slice(at, m.index))
    parts.push(
      <span className="ap-quote" key={m.index}>
        <q>{m[2]}</q>{' '}
        {item ? (
          <a className="ap-cite" href={item.url} translate="no">
            {item.path} @ {item.commit}
          </a>
        ) : (
          <span className="ap-cite" translate="no">
            {m[1]}
          </span>
        )}
      </span>,
    )
    at = m.index + m[0].length
  }
  parts.push(text.slice(at))
  return <p className="ap-answer">{parts}</p>
}

export default function AskThePlatform() {
  const [corpus, setCorpus] = useState<Corpus<Item> | 'missing' | null>(null)
  const [examples, setExamples] = useState<Example[]>([])
  const [graph, setGraph] = useState<Graph | null>(null)
  const [question, setQuestion] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [reply, setReply] = useState<Answer | 'waiting' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchJson<{ examples: Example[] }>(
      `workers-ai/${CORPUS}/examples.json`,
    ).then(
      (e) => setExamples(e.examples),
      () => setExamples([]),
    )
  }, [])

  // The corpus (about 4 MB) waits until the reader reaches the field or an example. Only a 404
  // means it is not published; any other failure leaves the form and is retried on the next ask.
  const load = () =>
    loadCorpus<Item>(CORPUS).then(
      (c) => (setCorpus(c), c),
      (error) => {
        if (/HTTP 404/.test(String(error))) setCorpus('missing')
        else
          setNotice(
            l(
              'The passages could not be loaded. Ask again to retry.',
              'Passagerna kunde inte laddas. Fråga igen för att försöka på nytt.',
            ),
          )
        return null
      },
    )

  async function run(q: string, example?: Example) {
    setBusy(true)
    setNotice(null)
    setHits(null)
    setReply('waiting')
    try {
      const c = corpus && corpus !== 'missing' ? corpus : await load()
      if (!c) return setReply(null)
      const found = nearest(c, example?.vector ?? (await embed(q)), TOP)
      setHits(found)
      setReply(
        example?.answer ??
          (await ask(
            q,
            CORPUS,
            found.map(({ item }) => ({ id: item.id, text: item.text })),
          )),
      )
    } catch (error) {
      setReply(null)
      setNotice(
        fallback(
          error instanceof Unavailable ? error.reason : 'error',
          examples.length > 0,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  const items = new Map(hits?.map(({ item }) => [item.id, item]))
  const quoted =
    reply && reply !== 'waiting' && reply.status === 'verified'
      ? reply.quotes.map((q) => items.get(q.id)).filter((i) => i != null)
      : []
  // The first quoted passage that names a model, else one that names any node on the data path.
  const named = quoted.flatMap((i) => i.nodes)
  const start = [
    ...named.filter((n) => n.startsWith('dbt:')),
    ...named.filter((n) => !n.startsWith('dbt:')),
  ].find((n) => graph && lineage(graph, n))
  const steps = graph && start ? lineage(graph, start) : null
  useEffect(() => {
    if (named.length && !graph)
      fetchJson<Graph>('architecture/graph.json').then(setGraph, () => {})
  }, [named.length, graph])

  return (
    <section className="ap" aria-labelledby="ap-title">
      <h3 id="ap-title">{l('Ask the platform', 'Fråga plattformen')}</h3>
      <p className="ap-lede">
        {l(
          'A question about how this site is built gets an answer quoted from its own documents, dbt models and data catalogue. Every quote is checked word for word against its file.',
          'En fråga om hur sajten är byggd får ett svar med citat ur dess egna dokument, dbt-modeller och datakatalog. Varje citat kontrolleras ord för ord mot sin fil.',
        )}
      </p>
      {corpus === 'missing' ? (
        <p className="ap-status">
          {l(
            'The corpus is not published yet.',
            'Korpusen är inte publicerad än.',
          )}
        </p>
      ) : (
        <form
          className="ap-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (question.trim()) run(question.trim())
          }}
        >
          <label htmlFor="ap-question">{l('Your question', 'Din fråga')}</label>
          <div className="ap-field">
            <input
              id="ap-question"
              name="question"
              autoComplete="off"
              enterKeyHint="send"
              maxLength={MAX}
              value={question}
              placeholder={l(
                'How is the junior share tested?',
                'Hur testas juniorandelen?',
              )}
              onFocus={() => corpus || load().then((c) => c && setNotice(null))}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button type="submit" className="btn" disabled={busy}>
              {busy ? l('Searching…', 'Söker…') : l('Ask', 'Fråga')}
            </button>
          </div>
          {examples.length > 0 && (
            <div
              className="ap-examples"
              role="group"
              aria-label={l('Example questions', 'Exempelfrågor')}
            >
              {examples.map((e) => (
                <button
                  key={e.question}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setQuestion(e.question)
                    run(e.question, e)
                  }}
                >
                  {e.question}
                </button>
              ))}
            </div>
          )}
        </form>
      )}

      {notice && (
        <p className="ap-notice" role="status">
          {notice}
        </p>
      )}

      <div className="ap-result" aria-live="polite">
        {reply === 'waiting' ? (
          <p className="ap-status">
            {hits
              ? l(
                  'Writing and checking the answer…',
                  'Svaret skrivs och kontrolleras…',
                )
              : l(
                  'Finding the nearest passages…',
                  'Letar fram de närmaste passagerna…',
                )}
          </p>
        ) : reply?.status === 'verified' ? (
          <>
            <Quoted text={reply.answer} items={items} />
            {steps && start && (
              <LineageStrip
                steps={steps}
                label={graph?.nodes.find((n) => n.id === start)?.label ?? start}
              />
            )}
          </>
        ) : reply?.status === 'unverified' ? (
          <p className="ap-status">
            {l(
              'The answer quoted something its passage does not say, so it is not shown. The passages found are below.',
              'Svaret citerade något som inte står i passagen, så det visas inte. De hittade passagerna står nedan.',
            )}
          </p>
        ) : reply?.status === 'no_answer' ? (
          <p className="ap-status">
            {l(
              'The passages found do not answer the question.',
              'De hittade passagerna besvarar inte frågan.',
            )}
          </p>
        ) : null}
        {hits && reply !== 'waiting' && (
          <details className="ap-passages">
            <summary>
              {l(
                `The ${hits.length} passages it read`,
                `De ${hits.length} passager som lästes`,
              )}
            </summary>
            <ol>
              {hits.map(({ item }) => (
                <li key={item.id}>
                  <a href={item.url}>{item.title}</a>
                  <p>{item.text}</p>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </section>
  )
}
