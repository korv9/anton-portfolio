/**
 * Allegora's conversation (AskTheLaw.tsx). A Swedish-law turn is streamed (stream.ts): a row of
 * steps, the answer as a marked draft while it is written, the checked answer with a ✓ on each
 * quote once the Worker's check has passed, and the fable told from it underneath. A draft that
 * fails the check is taken away and the fixed owl fable says so. An AI Act turn arrives whole, its
 * fable first and the checked answer folded under it. The sources sit folded under each turn, or
 * in the panel beside the conversation on a wide screen (Sources.tsx).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { l } from '../i18n'
import type { Answer } from '../workersAi/corpus'
import { Draft, Steps } from './Progress'
import { anchor, Sources } from './Sources'

export type Item = {
  id: string
  title: string
  url: string
  text: string
  law?: string
  fetched?: string
}
export type Hit = { item: Item; score: number }
export type Turn = {
  id: number
  question: string
  hits: Hit[] | null
  /** 'example': an example whose checked answer is not published, asked while the Worker is out. */
  reply: Answer | 'waiting' | 'example' | null
  notice?: string
  /** A streamed turn: the draft while it is written, then the fable told after the check. */
  streamed?: boolean
  draft?: string
  fable?: string | null | 'waiting'
}

// As the Worker's parser: a colon or white space may sit between [[id]] and its quote.
const QUOTE = /\[\[([^\]]+)\]\]\s*:?\s*"([^"]+)"/g

/** The answer's text with each [[id]]"quote" as a marked quote that leads to its passage. */
function Quoted({
  text,
  lang,
  onJump,
}: {
  text: string
  /** The language of the quoted law, when it can differ from the page's. */
  lang?: string
  onJump: (id: string) => void
}) {
  const parts: ReactNode[] = []
  let at = 0
  for (const m of text.matchAll(QUOTE)) {
    parts.push(text.slice(at, m.index))
    parts.push(
      <span className="lq-quote" key={m.index}>
        <q lang={lang}>{m[2]}</q>{' '}
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

function Fable({ text }: { text: string }) {
  return (
    <figure className="lq-allegory">
      {text
        .split(/\n+/)
        .filter(Boolean)
        .map((line) => (
          <p key={line}>{line}</p>
        ))}
    </figure>
  )
}

const OWL = () =>
  l(
    'Ulla the owl searched every paragraph she could find, but none of them answered the question. She could have guessed. She kept quiet instead.\nMoral: Whoever does not know should not pretend to.',
    'Ugglan Ulla letade igenom varje paragraf hon hittade, men ingen av dem svarade på frågan. Hon kunde ha gissat. Hon teg i stället.\nSensmoral: Den som inte vet ska inte låtsas veta.',
  )

function TurnView({
  turn,
  lang,
  wide,
  onShow,
}: {
  turn: Turn
  lang?: string
  wide: boolean
  onShow: (turn: number, passage?: string) => void
}) {
  const { reply, hits } = turn
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState(false)
  // A quote's passage to focus once it is on the page.
  const [target, setTarget] = useState<string | null>(null)
  const jump = (id: string) => {
    if (wide) return onShow(turn.id, id)
    setAll(true)
    setOpen(true)
    setTarget(id)
  }
  useEffect(() => {
    if (!target) return
    document.getElementById(anchor(turn.id, target))?.focus()
    setTarget(null)
  })
  const verified =
    reply && typeof reply === 'object' && reply.status === 'verified'
      ? reply
      : null
  const quoted = verified && (
    <Quoted text={verified.answer} lang={lang} onJump={jump} />
  )
  const fable = turn.streamed ? turn.fable : verified?.allegory

  let answer: ReactNode = null
  if (turn.notice) answer = <p className="lq-notice">{turn.notice}</p>
  else if (reply === 'waiting')
    answer = turn.draft ? (
      <Draft text={turn.draft} lang={lang} />
    ) : turn.streamed ? null : (
      <p className="lq-status lq-loading">
        {hits
          ? l(
              'Writing the fable and checking it…',
              'Fabeln skrivs och kontrolleras…',
            )
          : l('Searching the law…', 'Söker i lagen…')}
      </p>
    )
  else if (reply === 'example')
    answer = (
      <p className="lq-status">
        {l(
          'A checked answer for this example is not published yet; the passages found are below.',
          'Ett kontrollerat svar på det här exemplet är inte publicerat än; de hittade paragraferna står nedan.',
        )}
      </p>
    )
  else if (verified && turn.streamed)
    // The checked answer leads; the fable told from it follows.
    answer = (
      <>
        {quoted}
        {fable === 'waiting' ? null : fable ? <Fable text={fable} /> : null}
      </>
    )
  else if (verified?.allegory) answer = <Fable text={verified.allegory} />
  else if (verified)
    // The retelling failed or the example was answered without one: the checked answer stands.
    answer = (
      <>
        <p className="lq-caption">
          {l(
            'No fable this time; the law itself:',
            'Ingen fabel den här gången; lagen själv:',
          )}
        </p>
        {quoted}
      </>
    )
  else if (reply)
    answer = (
      <>
        <Fable text={OWL()} />
        <p className="lq-caption">
          {reply.status === 'unverified'
            ? l(
                'The answer could not be verified against the legal text.',
                'Svaret kunde inte verifieras mot lagtexten.',
              )
            : l(
                'The paragraphs found do not answer the question.',
                'De hittade paragraferna besvarar inte frågan.',
              )}
        </p>
      </>
    )
  const folded = !turn.streamed && verified?.allegory

  return (
    <li className="lq-turn">
      <p className="lq-ask">{turn.question}</p>
      {turn.streamed && !turn.notice && <Steps turn={turn} />}
      {answer}
      {hits && wide && turn.streamed && (
        <button
          type="button"
          className="btn-text lq-show"
          onClick={() => onShow(turn.id)}
        >
          {l('Show the sources beside', 'Visa källorna bredvid')}
        </button>
      )}
      {hits && reply !== 'waiting' && !(wide && turn.streamed) && (
        <details
          className="lq-law"
          open={open}
          onToggle={(e) => setOpen(e.currentTarget.open)}
        >
          <summary>
            {folded
              ? l('Show the legal text', 'Visa lagtexten')
              : l(
                  `Show the ${hits.length} passages found`,
                  `Visa de ${hits.length} passager som hittades`,
                )}
          </summary>
          {folded && (
            <>
              <h3 className="lq-law-title">
                {l('What the law says', 'Vad lagen säger')}
              </h3>
              {quoted}
            </>
          )}
          <h3 className="lq-law-title">{l('Sources', 'Källor')}</h3>
          <Sources
            turn={turn.id}
            hits={hits}
            lang={lang}
            all={all}
            onAll={() => setAll(true)}
          />
        </details>
      )}
    </li>
  )
}

export default function Thread({
  turns,
  lang,
  wide = false,
  onShow = () => {},
}: {
  turns: Turn[]
  lang?: string
  wide?: boolean
  onShow?: (turn: number, passage?: string) => void
}) {
  if (!turns.length) return null
  return (
    // A list cannot carry role="log", so the log wraps it.
    <div role="log" aria-label={l('Conversation', 'Samtal')}>
      <ol className="lq-thread">
        {turns.map((turn) => (
          <TurnView
            key={turn.id}
            turn={turn}
            lang={lang}
            wide={wide}
            onShow={onShow}
          />
        ))}
      </ol>
    </div>
  )
}
