/**
 * Ask the law (#fraga-lagen, docs/workers-ai.md): a question over a selection of Swedish statutes
 * or the EU AI Act. The Worker embeds the question, the browser finds the eight nearest passages
 * and shows them at once, then the Worker answers from those passages and returns the answer only
 * when every quote is verbatim in its passage. Three example questions per corpus carry their
 * vectors and work without the Worker; their checked answers come from the model evaluation.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { l } from '../i18n'
import { setHashParams, type Route } from '../router'
import { fetchJson } from '../dataSource'
import { ReportFrame } from '../report/ReportShell'
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
import './lawqa.css'

type Item = {
  id: string
  title: string
  url: string
  text: string
  law?: string
  fetched?: string
}
type Law = { sfs: string; title: string; url: string }
type Example = {
  question: string
  question_en?: string
  vector: number[]
  answer?: Answer
}
/** One answer model's run over the eval questions (eval.json); any figure may be missing. */
type Run = {
  model: string
  setting?: string
  questions?: number
  verified_share?: number
  recall_at_k?: number
  k?: number
  neurons_per_answer?: number
  neurons_lower_bound?: boolean
}
type Eval = Run & { tokens_per_answer?: number; compared?: Run[] }
type Hit = { item: Item; score: number }

const TOP = 8
const MAX = 500
const ANSWER_MODEL = '@cf/google/gemma-4-26b-a4b-it'
// As the Worker's parser: a colon or white space may sit between [[id]] and its quote.
const QUOTE = /\[\[([^\]]+)\]\]\s*:?\s*"([^"]+)"/g

const fileOf = (choice: string) =>
  choice === 'sfs' ? 'sfs' : l('ai-act-en', 'ai-act-sv')
const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))
const pct = (share: number) =>
  `${(share * 100).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 0 })}\u00a0%`
const neurons = (run: Run) =>
  run.neurons_per_answer == null
    ? null
    : `${run.neurons_lower_bound ? l('at least ', 'minst ') : ''}${num(run.neurons_per_answer)}`
/** The example's question in the reader's language; the corpus text itself stays as published. */
const asked = (e: Example) => l(e.question_en ?? e.question, e.question)

/** The figures that exist for a run, as one line. */
function scores(run: Run) {
  const parts = [
    run.verified_share != null &&
      l(
        `${pct(run.verified_share)} pass the quote check`,
        `${pct(run.verified_share)} klarar citatkontrollen`,
      ),
    run.recall_at_k != null &&
      run.k != null &&
      `recall@${run.k} ${pct(run.recall_at_k)}`,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return run.questions != null
    ? `${l(`${run.questions} questions`, `${run.questions} frågor`)}: ${parts.join(', ')}`
    : parts.join(', ')
}

/** The answer's text with each [[id]]"quote" as a marked quote that leads to its passage. */
function Quoted({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let at = 0
  for (const m of text.matchAll(QUOTE)) {
    parts.push(text.slice(at, m.index))
    parts.push(
      <span className="lq-quote" key={m.index}>
        <q>{m[2]}</q>{' '}
        <button
          type="button"
          className="btn-text"
          onClick={() => document.getElementById(`lq-${m[1]}`)?.focus()}
        >
          {m[1]}
        </button>{' '}
        <small>✓ {l('verbatim in the source', 'ordagrant i källan')}</small>
      </span>,
    )
    at = m.index + m[0].length
  }
  parts.push(text.slice(at))
  return <p className="lq-answer">{parts}</p>
}

export default function AskTheLaw({ route }: { route: Route }) {
  const choice = route.params.get('korpus') === 'ai-act' ? 'ai-act' : 'sfs'
  const file = fileOf(choice)
  const [corpus, setCorpus] = useState<Corpus<Item> | 'missing' | null>(null)
  const [examples, setExamples] = useState<Example[]>([])
  const [evaluation, setEvaluation] = useState<Eval | null>(null)
  const [question, setQuestion] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [reply, setReply] = useState<Answer | 'waiting' | 'example' | null>(
    null,
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCorpus(null)
    setHits(null)
    setReply(null)
    setNotice(null)
    loadCorpus<Item>(file).then(setCorpus, () => setCorpus('missing'))
    fetchJson<{ examples: Example[] }>(`workers-ai/${file}/examples.json`).then(
      (e) => setExamples(e.examples),
      () => setExamples([]),
    )
  }, [file])
  useEffect(() => {
    fetchJson<Eval>('workers-ai/eval.json').then(setEvaluation, () => {})
  }, [])

  async function run(q: string, example?: Example) {
    if (!corpus || corpus === 'missing') return
    setBusy(true)
    setNotice(null)
    setHits(null)
    setReply(null)
    try {
      const found = nearest(corpus, example?.vector ?? (await embed(q)), TOP)
      setHits(found)
      if (example) return setReply(example.answer ?? 'example')
      setReply('waiting')
      setReply(
        await ask(
          q,
          file,
          found.map(({ item }) => ({ id: item.id, text: item.text })),
        ),
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

  const meta = corpus && corpus !== 'missing' ? corpus.meta : null
  const laws = (meta?.laws as Law[] | undefined) ?? []
  const fetched = meta?.fetched as string | undefined
  const compared = evaluation?.compared ?? []
  const chosen = compared.find(
    (run) =>
      run.model === evaluation?.model && run.setting === evaluation?.setting,
  )
  const summary = evaluation && scores(evaluation)
  return (
    <ReportFrame>
      <div className="report lq">
        <header className="politik-intro">
          <p className="politik-intro-name">
            {l('Ask the law', 'Fråga lagen')}
          </p>
          <p className="politik-intro-data">
            {l(
              'Questions over a selection of Swedish statutes and the EU AI Act, answered with quotes checked word for word against the text.',
              'Frågor över ett urval av svenska lagar och EU:s AI-förordning, besvarade med citat som kontrolleras ord för ord mot texten.',
            )}
          </p>
        </header>
        <section className="report-tab" aria-labelledby="lq-title">
          <header className="report-head">
            <h1 id="lq-title">{l('Ask the law', 'Fråga lagen')}</h1>
            <div
              className="lq-switch"
              role="group"
              aria-label={l('Corpus', 'Korpus')}
            >
              {(['sfs', 'ai-act'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={choice === c}
                  onClick={() =>
                    setHashParams(
                      route.path,
                      new URLSearchParams(c === 'sfs' ? {} : { korpus: c }),
                    )
                  }
                >
                  {c === 'sfs' ? l('Swedish law', 'Svensk lag') : 'EU AI Act'}
                </button>
              ))}
            </div>
          </header>

          <div className="lq-notices">
            <p>
              {l(
                'This is a search in legal text, not legal advice.',
                'Det här är en sökning i lagtext, inte juridisk rådgivning.',
              )}
            </p>
            <p>
              {choice === 'sfs'
                ? l(
                    `The legal text comes from the Riksdag's open data ${fetched ? `(fetched ${fetched}) ` : ''}and is not the official version, which is at svenskforfattningssamling.se.`,
                    `Lagtexten kommer från Riksdagens öppna data ${fetched ? `(hämtad ${fetched}) ` : ''}och är inte den officiella versionen; den finns på svenskforfattningssamling.se.`,
                  )
                : l(
                    'The text of the AI Act comes from EUR-Lex. Only the version published in the Official Journal of the EU is authentic.',
                    'AI-förordningens text kommer från EUR-Lex. Bara versionen i Europeiska unionens officiella tidning är giltig.',
                  )}
            </p>
            <p>
              {l(
                'Your question goes to Cloudflare Workers AI and is not logged or stored.',
                'Frågan skickas till Cloudflare Workers AI och loggas eller sparas inte.',
              )}
            </p>
          </div>

          {corpus === 'missing' ? (
            <p className="lq-status">
              {l(
                'This corpus is not published yet.',
                'Den här korpusen är inte publicerad än.',
              )}
            </p>
          ) : (
            <form
              className="lq-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (question.trim()) run(question.trim())
              }}
            >
              <label htmlFor="lq-question">
                {l('Your question', 'Din fråga')}
              </label>
              <textarea
                name="question"
                autoComplete="off"
                id="lq-question"
                rows={2}
                maxLength={MAX}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <div className="lq-actions">
                <span className="lq-count">
                  {question.length} / {MAX}
                </span>
                <button
                  type="submit"
                  className="btn"
                  disabled={busy || !corpus}
                >
                  {busy ? l('Searching…', 'Söker…') : l('Ask', 'Fråga')}
                </button>
              </div>
              {examples.length > 0 && (
                <div
                  className="lq-examples"
                  role="group"
                  aria-label={l('Example questions', 'Exempelfrågor')}
                >
                  {examples.map((e) => (
                    <button
                      key={e.question}
                      type="button"
                      disabled={busy || !corpus}
                      onClick={() => {
                        setQuestion(asked(e))
                        run(e.question, e)
                      }}
                    >
                      {asked(e)}
                    </button>
                  ))}
                </div>
              )}
              {examples.length === 0 && file === 'ai-act-en' && (
                <p className="lq-count">
                  {l(
                    'Example questions for the English text are not published yet.',
                    'Exempelfrågor för den engelska texten är inte publicerade än.',
                  )}
                </p>
              )}
            </form>
          )}

          {notice && (
            <p className="lq-notice" role="status">
              {notice}
            </p>
          )}

          {hits && (
            <div className="lq-result">
              <section aria-labelledby="lq-answer-title" aria-live="polite">
                <h2 id="lq-answer-title">{l('Answer', 'Svar')}</h2>
                {reply === 'waiting' ? (
                  <p className="lq-status" role="status">
                    {l(
                      'Writing and checking the answer…',
                      'Svaret skrivs och kontrolleras…',
                    )}
                  </p>
                ) : reply === 'example' ? (
                  <p className="lq-status">
                    {l(
                      'A checked answer for this example is not published yet; the passages found are below.',
                      'Ett kontrollerat svar på det här exemplet är inte publicerat än; de hittade paragraferna står nedan.',
                    )}
                  </p>
                ) : reply?.status === 'verified' ? (
                  <Quoted text={reply.answer} />
                ) : reply?.status === 'unverified' ? (
                  <p className="lq-status">
                    {l(
                      'The answer could not be verified against the legal text, so only the paragraphs found are shown.',
                      'Svaret kunde inte verifieras mot lagtexten, så bara de hittade paragraferna visas.',
                    )}
                  </p>
                ) : reply?.status === 'no_answer' ? (
                  <p className="lq-status">
                    {l(
                      'The paragraphs found do not answer the question.',
                      'De hittade paragraferna besvarar inte frågan.',
                    )}
                  </p>
                ) : null}
              </section>
              <section aria-labelledby="lq-passages-title">
                <h2 id="lq-passages-title">
                  {l(
                    `The ${TOP} nearest passages`,
                    `De ${TOP} närmaste passagerna`,
                  )}
                </h2>
                <ol className="lq-passages">
                  {hits.map(({ item }) => (
                    <li key={item.id} id={`lq-${item.id}`} tabIndex={-1}>
                      <p className="lq-title">
                        <a href={item.url}>{item.title}</a>{' '}
                        <small translate="no">{item.id}</small>
                      </p>
                      <p>{item.text}</p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          )}

          <div className="lq-about">
            {choice === 'sfs' && laws.length > 0 && (
              <section aria-labelledby="lq-laws-title">
                <h2 id="lq-laws-title">
                  {laws.length === 1
                    ? l('The law in the selection', 'Lagen i urvalet')
                    : l(
                        `The ${laws.length} laws in the selection`,
                        `De ${laws.length} lagarna i urvalet`,
                      )}
                </h2>
                <ul className="lq-laws">
                  {laws.map((law) => (
                    <li key={law.sfs}>
                      <a href={law.url}>{law.title}</a> <small>{law.sfs}</small>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {meta && (
              <section className="lq-tech" aria-labelledby="lq-tech-title">
                <h2 id="lq-tech-title">
                  {l('How it works', 'Så fungerar det')}
                </h2>
                <dl>
                  <dt>{l('Passages', 'Passager')}</dt>
                  <dd>{num(meta.n)}</dd>
                  <dt>{l('Embedding', 'Inbäddning')}</dt>
                  <dd>
                    {meta.model}, PCA {meta.dims} {l('dims', 'dim')}, int8
                  </dd>
                  {meta.recall_at_10 != null && (
                    <>
                      <dt>recall@10</dt>
                      <dd>
                        {meta.recall_at_10.toLocaleString(l('en-GB', 'sv-SE'), {
                          maximumFractionDigits: 3,
                        })}
                      </dd>
                    </>
                  )}
                  <dt>{l('Answers', 'Svar')}</dt>
                  <dd>
                    <span translate="no">
                      {evaluation?.model ?? ANSWER_MODEL}
                    </span>
                    {evaluation?.setting && `, ${evaluation.setting}`}
                  </dd>
                  {summary && (
                    <>
                      <dt>{l('Evaluation', 'Utvärdering')}</dt>
                      <dd>{summary}</dd>
                    </>
                  )}
                  {chosen && neurons(chosen) && (
                    <>
                      <dt>{l('Cost per answer', 'Kostnad per svar')}</dt>
                      <dd>
                        {neurons(chosen)} {l('neurons', 'neuroner')}
                        {evaluation?.tokens_per_answer != null &&
                          `, ${num(evaluation.tokens_per_answer)} tokens`}
                      </dd>
                    </>
                  )}
                </dl>
              </section>
            )}
            {compared.length > 0 && (
              <section className="lq-models" aria-labelledby="lq-models-title">
                <h2 id="lq-models-title">
                  {l('Answer models compared', 'Svarsmodellerna jämförda')}
                </h2>
                <div className="lq-table">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{l('Model', 'Modell')}</th>
                        <th scope="col" className="num">
                          {l('Questions', 'Frågor')}
                        </th>
                        <th scope="col" className="num">
                          {l('Quote check', 'Citatkontroll')}
                        </th>
                        <th scope="col" className="num">
                          recall@{compared[0].k ?? TOP}
                        </th>
                        <th scope="col" className="num">
                          {l('Neurons per answer', 'Neuroner per svar')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {compared.map((run) => (
                        <tr
                          key={`${run.model} ${run.setting}`}
                          className={run === chosen ? 'lq-chosen' : undefined}
                        >
                          <th scope="row">
                            <span translate="no">
                              {run.model.split('/').pop()}
                            </span>
                            {run.setting && <small>{run.setting}</small>}
                          </th>
                          <td className="num">
                            {run.questions != null && num(run.questions)}
                          </td>
                          <td className="num">
                            {run.verified_share != null &&
                              pct(run.verified_share)}
                          </td>
                          <td className="num">
                            {run.recall_at_k != null && pct(run.recall_at_k)}
                          </td>
                          <td className="num">{neurons(run)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
    </ReportFrame>
  )
}
