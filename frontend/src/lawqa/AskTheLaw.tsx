/**
 * Ask the law (#fraga-lagen, docs/workers-ai.md): a question over a selection of Swedish statutes
 * or the EU AI Act. The Worker embeds the question, the browser finds the eight nearest passages
 * and shows them at once, then the Worker answers from those passages and returns the answer only
 * when every quote is verbatim in its passage. Three example questions per corpus carry their
 * vectors and work without the Worker; their checked answers come from the model evaluation.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import type { Law } from './LawData'
import LawData, { SELECTED } from './LawData'
import PageHead, { Method } from '../ui/PageHead'
import './lawqa.css'

type Item = {
  id: string
  title: string
  url: string
  text: string
  law?: string
  fetched?: string
}
type Example = {
  question: string
  question_en?: string
  vector: number[]
  passages?: string[]
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
type Eval = Run & {
  tokens_per_answer?: number
  compared?: Run[]
  /** The run date, once the export writes one. */
  run?: string
}
type Hit = { item: Item; score: number }

const TOP = 8
/** Passages shown before "Show all". */
const FIRST = 3
// eval.json carries no run date yet; docs/workers-ai.md dates the run to the night to 15 October.
const EVAL_RUN = '2026-10-15'
const MODEL_NAMES: Record<string, string> = {
  '@cf/google/gemma-4-26b-a4b-it': 'Gemma 4 26B',
}
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
/**
 * An example answered from recitals alone is left out: "When does the AI Act start to apply?"
 * was answered from recital 179, not Article 113. ponytail: filtered here until the eval export
 * re-runs that question.
 */
const recitalOnly = (e: Example) =>
  e.answer?.status === 'verified' &&
  e.answer.quotes.every((q) => q.id.startsWith('rct_'))

/** The answer's text with each [[id]]"quote" as a marked quote that leads to its passage. */
function Quoted({
  text,
  onJump,
}: {
  text: string
  onJump: (id: string) => void
}) {
  const parts: ReactNode[] = []
  let at = 0
  for (const m of text.matchAll(QUOTE)) {
    parts.push(text.slice(at, m.index))
    parts.push(
      <span className="lq-quote" key={m.index}>
        <q>{m[2]}</q>{' '}
        <button type="button" className="btn-text" onClick={() => onJump(m[1])}>
          {m[1]}
        </button>{' '}
        <small>
          ✓ {l('checked word for word', 'kontrollerat ord för ord')}
        </small>
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
  // null while examples.json loads; a corpus without one has none.
  const [examples, setExamples] = useState<Example[] | null>(null)
  const [evaluation, setEvaluation] = useState<Eval | null>(null)
  const [question, setQuestion] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [reply, setReply] = useState<Answer | 'waiting' | 'example' | null>(
    null,
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Until the reader asks, the page shows the first example's checked answer.
  const [touched, setTouched] = useState(false)
  const [all, setAll] = useState(false)
  // The corpus (about 12 MB for Swedish law) loads once the reader turns to the form or the
  // sources; the opening example's answer needs only examples.json. Without examples it loads now.
  const [wanted, setWanted] = useState(false)
  const want = wanted || examples?.length === 0
  const wake = () => setWanted(true)
  // A quote's passage to focus once the passages are on the page.
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    setCorpus(null)
    setExamples(null)
    setWanted(false)
    setTouched(false)
    setAll(false)
    setHits(null)
    setReply(null)
    setNotice(null)
    fetchJson<{ examples: Example[] }>(`workers-ai/${file}/examples.json`).then(
      (e) => setExamples(e.examples.filter((x) => !recitalOnly(x))),
      () => setExamples([]),
    )
  }, [file])
  useEffect(() => {
    if (want) loadCorpus<Item>(file).then(setCorpus, () => setCorpus('missing'))
  }, [file, want])
  useEffect(() => {
    fetchJson<Eval>('workers-ai/eval.json').then(setEvaluation, () => {})
  }, [])

  async function run(q: string, example?: Example) {
    if (corpus === 'missing') return
    wake()
    setTouched(true)
    setAll(false)
    setBusy(true)
    setNotice(null)
    setHits(null)
    setReply(null)
    let loaded: Corpus<Item>
    try {
      loaded = await loadCorpus<Item>(file)
    } catch {
      setCorpus('missing')
      setBusy(false)
      return
    }
    try {
      const found = nearest(loaded, example?.vector ?? (await embed(q)), TOP)
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
          (examples?.length ?? 0) > 0,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  const ready = corpus && corpus !== 'missing' ? corpus : null
  const opening = touched
    ? undefined
    : examples?.find((e) => e.answer?.status === 'verified')
  const openingHits = useMemo(
    () => (opening && ready ? nearest(ready, opening.vector, TOP) : null),
    [opening, ready],
  )
  const shownHits = opening ? openingHits : hits
  const shownReply = opening ? (opening.answer ?? null) : reply
  /** A quote leads to its passage, which may sit among the folded ones or not be loaded yet. */
  const jump = (id: string) => {
    wake()
    setAll(true)
    setTarget(id)
  }
  useEffect(() => {
    if (!target || !shownHits) return
    document.getElementById(`lq-${target}`)?.focus()
    setTarget(null)
  }, [target, shownHits])

  const meta = ready?.meta ?? null
  const laws = (meta?.laws as Law[] | undefined) ?? []
  const fetched = meta?.fetched as string | undefined
  const compared = evaluation?.compared ?? []
  const chosen = compared.find(
    (run) =>
      run.model === evaluation?.model && run.setting === evaluation?.setting,
  )
  const k = evaluation?.k ?? TOP
  const decimal = (n: number) =>
    n.toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 2 })
  return (
    <ReportFrame>
      <div className="report lq">
        <section className="report-tab" aria-labelledby="lq-title">
          <PageHead
            title="Allegora"
            sentence={l(
              'Ask about Swedish law or the EU AI Act. The answer quotes the law word for word, then retells it as an allegory.',
              'Fråga om svensk lag eller EU:s AI-förordning. Svaret citerar lagen ordagrant och berättar den sedan som en allegori.',
            )}
            kpis={[
              {
                label: l('Laws searchable', 'Sökbara lagar'),
                value: num((laws.length ? laws : SELECTED).length),
              },
              ...(meta
                ? [
                    {
                      label: l('Passages indexed', 'Indexerade passager'),
                      value: num(meta.n),
                    },
                  ]
                : []),
              ...(evaluation?.verified_share != null &&
              evaluation.questions != null
                ? [
                    {
                      label: l(
                        'Answers with every quote verified',
                        'Svar med alla citat verifierade',
                      ),
                      value: `${Math.round(evaluation.verified_share * evaluation.questions)} ${l('of', 'av')} ${evaluation.questions}`,
                    },
                  ]
                : []),
              ...(evaluation?.recall_at_k != null
                ? [
                    {
                      label: l(
                        `Right passage in the top ${k}`,
                        `Rätt passage bland de ${k} första`,
                      ),
                      value: decimal(evaluation.recall_at_k),
                    },
                  ]
                : []),
            ]}
          />
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

          <p className="lq-notices">
            {l(
              'Not legal advice · not the official text · questions are not logged',
              'Inte juridisk rådgivning · inte den officiella texten · frågor loggas inte',
            )}
          </p>

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
              onFocus={wake}
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
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? l('Searching…', 'Söker…') : l('Ask', 'Fråga')}
                </button>
              </div>
              {examples && examples.length > 0 && (
                <div
                  className="lq-examples"
                  role="group"
                  aria-label={l('Example questions', 'Exempelfrågor')}
                >
                  {examples.map((e) => (
                    <button
                      key={e.question}
                      type="button"
                      disabled={busy}
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
              {want && corpus === null && (
                <p className="lq-status lq-loading" role="status">
                  {choice === 'sfs'
                    ? l('Reading the statute book…', 'Läser in lagboken…')
                    : l('Reading the AI Act…', 'Läser in AI-förordningen…')}
                </p>
              )}
              {examples?.length === 0 && (
                <p className="lq-status">
                  {l(
                    'Ask in your own words; every quote in the answer is checked against the text.',
                    'Fråga med egna ord; varje citat i svaret kontrolleras mot texten.',
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

          <div className="lq-body">
            {(shownHits || shownReply) && (
              <div className="lq-result">
                <section aria-labelledby="lq-answer-title" aria-live="polite">
                  <h2 id="lq-answer-title">{l('Answer', 'Svar')}</h2>
                  {opening && (
                    <p className="lq-caption">
                      {l(
                        'A ready-made example, checked in advance',
                        'Ett färdigt exempel, kontrollerat i förväg',
                      )}
                      {choice === 'sfs' &&
                        l(' · answered in Swedish, from the Swedish text', '')}
                      {': '}
                      <span className="lq-asked">{asked(opening)}</span>
                    </p>
                  )}
                  {shownReply === 'waiting' ? (
                    <p className="lq-status" role="status">
                      {l(
                        'Writing and checking the answer…',
                        'Svaret skrivs och kontrolleras…',
                      )}
                    </p>
                  ) : shownReply === 'example' ? (
                    <p className="lq-status">
                      {l(
                        'A checked answer for this example is not published yet; the passages found are below.',
                        'Ett kontrollerat svar på det här exemplet är inte publicerat än; de hittade paragraferna står nedan.',
                      )}
                    </p>
                  ) : shownReply?.status === 'verified' ? (
                    <>
                      {shownReply.allegory && (
                        <figure className="lq-allegory">
                          <figcaption>
                            {l('The allegory', 'Allegorin')}
                          </figcaption>
                          {shownReply.allegory
                            .split(/\n+/)
                            .filter(Boolean)
                            .map((line) => (
                              <p key={line}>{line}</p>
                            ))}
                        </figure>
                      )}
                      {shownReply.allegory && (
                        <h3 className="lq-law-title">
                          {l('What the law says', 'Vad lagen säger')}
                        </h3>
                      )}
                      <Quoted text={shownReply.answer} onJump={jump} />
                    </>
                  ) : shownReply?.status === 'unverified' ? (
                    <p className="lq-status">
                      {l(
                        'The answer could not be verified against the legal text, so only the paragraphs found are shown.',
                        'Svaret kunde inte verifieras mot lagtexten, så bara de hittade paragraferna visas.',
                      )}
                    </p>
                  ) : shownReply?.status === 'no_answer' ? (
                    <p className="lq-status">
                      {l(
                        'The paragraphs found do not answer the question.',
                        'De hittade paragraferna besvarar inte frågan.',
                      )}
                    </p>
                  ) : null}
                </section>
                {opening && !shownHits && (
                  <section aria-labelledby="lq-passages-title">
                    <h2 id="lq-passages-title">{l('Sources', 'Källor')}</h2>
                    {want ? (
                      <p className="lq-status" role="status">
                        {l('Finding the passages…', 'Hämtar passagerna…')}
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="btn-text lq-more"
                        onClick={wake}
                      >
                        {l(
                          `Show the ${opening.passages?.length ?? TOP} passages found`,
                          `Visa de ${opening.passages?.length ?? TOP} passager som hittades`,
                        )}
                      </button>
                    )}
                  </section>
                )}
                {shownHits && (
                  <section aria-labelledby="lq-passages-title">
                    <h2 id="lq-passages-title">{l('Sources', 'Källor')}</h2>
                    <p className="lq-caption">
                      {l(
                        `The ${shownHits.length} nearest passages, found in your browser`,
                        `De ${shownHits.length} närmaste passagerna, hittade i din webbläsare`,
                      )}
                    </p>
                    <ol className="lq-passages">
                      {shownHits.map(({ item }, i) => (
                        <li
                          key={item.id}
                          id={`lq-${item.id}`}
                          tabIndex={-1}
                          hidden={!all && i >= FIRST}
                        >
                          <p className="lq-title">
                            <a href={item.url}>{item.title}</a>{' '}
                            <small translate="no">{item.id}</small>
                          </p>
                          <p>{item.text}</p>
                        </li>
                      ))}
                    </ol>
                    {!all && shownHits.length > FIRST && (
                      <button
                        type="button"
                        className="btn-text lq-more"
                        onClick={() => setAll(true)}
                      >
                        {l(
                          `Show all ${shownHits.length}`,
                          `Visa alla ${shownHits.length}`,
                        )}
                      </button>
                    )}
                  </section>
                )}
              </div>
            )}
          </div>

          <LawData laws={laws} />
          <Method
            summary={l(
              'How it is made · sources · method',
              'Så är det gjort · källor · metod',
            )}
          >
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
            {evaluation?.verified_share != null &&
              evaluation.questions != null && (
                <section
                  className="lq-checked"
                  aria-labelledby="lq-checked-title"
                >
                  <h2 id="lq-checked-title">
                    {l('How it is checked', 'Så kontrolleras det')}
                  </h2>
                  <p>
                    {l(
                      `Your question is matched to the ${k} nearest paragraphs in the browser. A model answers from those alone, and the answer is shown only if every quote sits word for word in its paragraph. Otherwise you see the paragraphs, not the answer.`,
                      `Frågan matchas mot de ${k} närmaste paragraferna i webbläsaren. En modell svarar bara utifrån dem, och svaret visas bara om varje citat står ord för ord i sin paragraf. Annars visas paragraferna, inte svaret.`,
                    )}
                  </p>
                  <p className="lq-caption">
                    {l(
                      `Run on the night to ${evaluation.run ?? EVAL_RUN} (UTC)`,
                      `Körd natten till ${evaluation.run ?? EVAL_RUN} (UTC)`,
                    )}
                    {' · '}
                    <span translate="no">
                      {MODEL_NAMES[evaluation.model] ??
                        evaluation.model.split('/').pop()}
                    </span>
                    {evaluation.setting && `, ${evaluation.setting}`}
                    {chosen &&
                      neurons(chosen) &&
                      ` · ${neurons(chosen)} ${l('neurons per answer', 'neuroner per svar')}`}
                  </p>
                  <p className="lq-small">
                    {l(
                      `n = ${evaluation.questions} hand-written questions. Verified means the quotes match the law, not that the answer is legally correct.`,
                      `n = ${evaluation.questions} egenskrivna frågor. Verifierat betyder att citaten stämmer med lagen, inte att svaret är juridiskt korrekt.`,
                    )}
                  </p>
                </section>
              )}
            <div className="lq-about">
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
                          {meta.recall_at_10.toLocaleString(
                            l('en-GB', 'sv-SE'),
                            {
                              maximumFractionDigits: 3,
                            },
                          )}
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
                <section
                  className="lq-models"
                  aria-labelledby="lq-models-title"
                >
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
          </Method>
        </section>
      </div>
    </ReportFrame>
  )
}
