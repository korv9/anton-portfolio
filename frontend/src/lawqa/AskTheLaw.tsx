/**
 * Allegora (#fraga-lagen, docs/products/allegora/allegora-gcp.md): the name, then a conversation about Swedish law
 * (Thread.tsx). The Worker finds the eight paragraphs nearest the question among every law and
 * ordinance in force (POST /api/ask, searched on Google Cloud) and streams the answer as a draft;
 * the answer is kept only when every quote is verbatim in its paragraph, and a fable told from it
 * follows. A follow-up sends the thread's last two checked turns. On a wide screen the sources
 * stand in a panel beside the conversation. Without the Worker the example questions fall back to
 * the checked answers from the model evaluation, which have no fable. ?korpus=ai-act asks the EU
 * AI Act instead, searched in the browser and answered whole.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { fetchJson } from '../dataSource'
import { ReportFrame } from '../report/ReportShell'
import { PROJECTS } from '../projects/projectRegistry'
import { Method } from '../ui/PageHead'
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
import { SourcePanel, useWide } from './Sources'
import { streamTurn, type Said } from './stream'
import Thread, { type Item, type Turn } from './Thread'
import '../ui/page-head.css'
import './lawqa.css'

type Example = {
  question: string
  question_en?: string
  vector: number[]
  passages?: string[]
  answer?: Answer
}

const TOP = 8
const entry = PROJECTS.find((p) => p.id === 'ask-the-law')!
const MAX = 500

const fileOf = (choice: string) =>
  choice === 'sfs' ? 'sfs' : l('ai-act-en', 'ai-act-sv')
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

export default function AskTheLaw({ route }: { route: Route }) {
  const choice = route.params.get('korpus') === 'ai-act' ? 'ai-act' : 'sfs'
  const file = fileOf(choice)
  const [corpus, setCorpus] = useState<Corpus<Item> | 'missing' | null>(null)
  // null while examples.json loads; a corpus without one has none.
  const [examples, setExamples] = useState<Example[] | null>(null)
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const wide = useWide()
  // The turn the panel shows and the passage a quote named; the latest turn until one is picked.
  const [shown, setShown] = useState<{
    turn: number
    passage: string | null
  } | null>(null)
  // The AI Act's corpus loads in the browser once the reader turns to the form, or now when it
  // has no examples. Swedish law is searched by the Worker and loads nothing.
  const [wanted, setWanted] = useState(false)
  const want = choice !== 'sfs' && (wanted || examples?.length === 0)
  const wake = () => setWanted(true)

  useEffect(() => {
    setCorpus(null)
    setExamples(null)
    setWanted(false)
    setTurns([])
    setShown(null)
    fetchJson<{ examples: Example[] }>(`workers-ai/${file}/examples.json`).then(
      (e) => setExamples(e.examples.filter((x) => !recitalOnly(x))),
      () => setExamples([]),
    )
  }, [file])
  // Swedish law's search service sleeps when no one asks; waking it now hides its start while
  // the reader writes a question.
  useEffect(() => {
    if (choice === 'sfs') fetch('/api/warm', { method: 'POST' }).catch(() => {})
  }, [choice])
  useEffect(() => {
    if (want) loadCorpus<Item>(file).then(setCorpus, () => setCorpus('missing'))
  }, [file, want])

  async function run(q: string, label: string, example?: Example) {
    if (corpus === 'missing') return
    wake()
    setBusy(true)
    setQuestion('')
    const id = Date.now()
    const update = (patch: Partial<Turn>) =>
      setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    const streamed = choice === 'sfs'
    // The thread's last checked turns, so a follow-up is read in its context.
    const history: Said[] = turns
      .flatMap((t) =>
        t.reply && typeof t.reply === 'object' && t.reply.status === 'verified'
          ? [{ question: t.question, answer: t.reply.answer }]
          : [],
      )
      .slice(-2)
    setTurns((all) => [
      ...all,
      { id, question: label, hits: null, reply: 'waiting', streamed },
    ])
    setShown(null)
    try {
      if (streamed) {
        await streamTurn(q, history, update)
        return
      }
      let loaded: Corpus<Item>
      try {
        loaded = await loadCorpus<Item>(file)
      } catch {
        setCorpus('missing')
        update({ reply: null })
        return
      }
      const found = nearest(loaded, example?.vector ?? (await embed(q)), TOP)
      update({ hits: found })
      update({
        reply: await ask(
          q,
          file,
          found.map(({ item }) => ({ id: item.id, text: item.text })),
        ),
      })
    } catch (error) {
      // An example still answers from the evaluation's checked answer, without a fable.
      if (example)
        update({ reply: example.answer ?? 'example', draft: undefined })
      else
        update({
          reply: null,
          draft: undefined,
          notice: fallback(
            error instanceof Unavailable ? error.reason : 'error',
            (examples?.length ?? 0) > 0,
          ),
        })
    } finally {
      setBusy(false)
    }
  }

  const lang = choice === 'sfs' ? 'sv' : undefined
  // On a wide screen a streamed turn's sources stand beside the conversation.
  const latest = turns.find((t) => t.id === shown?.turn) ?? turns.at(-1)
  const panel = wide && latest?.streamed ? latest : undefined

  return (
    <ReportFrame>
      <div className="report lq">
        <section className="report-tab" aria-label="Allegora">
          <header className="page-head">
            <h1 className="page-head-title">ALLEGORA</h1>
            <p className="page-head-lede">
              {l(entry.summary.en, entry.summary.sv)}
            </p>
            <p className="page-head-lede">
              {l(entry.built.en, entry.built.sv)}
            </p>
            <p className="page-head-lede">
              {l(
                'The answer appears as a draft while it is written. If the check fails, the draft is removed and only the paragraphs found are shown.',
                'Svaret syns som utkast medan det skrivs. Går kontrollen inte igenom tas utkastet bort, och bara de paragrafer som hittades visas.',
              )}
            </p>
          </header>

          <div className={panel ? 'lq-workspace' : undefined}>
            <div className="lq-main">
              <Thread
                turns={turns}
                lang={lang}
                wide={wide}
                onShow={(turn, passage) =>
                  setShown({ turn, passage: passage ?? null })
                }
              />

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
                    if (question.trim()) run(question.trim(), question.trim())
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
                          onClick={() => run(e.question, asked(e), e)}
                        >
                          {asked(e)}
                        </button>
                      ))}
                    </div>
                  )}
                  {want && corpus === null && (
                    <p className="lq-status lq-loading" role="status">
                      {l('Reading the AI Act…', 'Läser in AI-förordningen…')}
                    </p>
                  )}
                  <p className="lq-notices">
                    {l(
                      'Not legal advice · not the official text · questions are not logged',
                      'Inte juridisk rådgivning · inte den officiella texten · frågor loggas inte',
                    )}
                  </p>
                </form>
              )}
            </div>
            {panel && (
              <SourcePanel
                key={panel.id}
                turn={panel.id}
                question={panel.question}
                hits={panel.hits}
                lang={lang}
                target={shown?.turn === panel.id ? shown.passage : null}
              />
            )}
          </div>
          <Method
            summary={l(
              'How it is made · sources · method',
              'Så är det gjort · källor · metod',
            )}
          >
            <p>{l(entry.question.en, entry.question.sv)}</p>
            <p>{l(entry.result.en, entry.result.sv)}</p>
            <footer>
              <p>{entry.tech.join(' · ')}</p>
            </footer>
          </Method>
        </section>
      </div>
    </ReportFrame>
  )
}
