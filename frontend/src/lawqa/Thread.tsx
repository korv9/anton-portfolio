/**
 * Allegora's conversation (AskTheLaw.tsx): each question and the fable that answers it. The checked
 * answer and the passages it quotes sit folded under each fable, as its evidence. A question the
 * passages cannot answer gets a fixed fable, never a generated one.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { l } from '../i18n'
import type { Answer } from '../workersAi/corpus'

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
}

/** Passages shown before "Show all". */
const FIRST = 3
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

function TurnView({ turn, lang }: { turn: Turn; lang?: string }) {
  const { reply, hits } = turn
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState(false)
  // A quote's passage to focus once it is on the page.
  const [target, setTarget] = useState<string | null>(null)
  const anchor = (id: string) => `lq-${turn.id}-${id}`
  const jump = (id: string) => {
    setAll(true)
    setOpen(true)
    setTarget(id)
  }
  useEffect(() => {
    if (!target) return
    document.getElementById(anchor(target))?.focus()
    setTarget(null)
  })
  const verified =
    reply && typeof reply === 'object' && reply.status === 'verified'
      ? reply
      : null
  const quoted = verified && (
    <Quoted text={verified.answer} lang={lang} onJump={jump} />
  )

  let answer: ReactNode = null
  if (turn.notice) answer = <p className="lq-notice">{turn.notice}</p>
  else if (reply === 'waiting')
    answer = (
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

  return (
    <li className="lq-turn">
      <p className="lq-ask">{turn.question}</p>
      {answer}
      {hits && reply !== 'waiting' && (
        <details
          className="lq-law"
          open={open}
          onToggle={(e) => setOpen(e.currentTarget.open)}
        >
          <summary>
            {verified?.allegory
              ? l('Show the legal text', 'Visa lagtexten')
              : l(
                  `Show the ${hits.length} passages found`,
                  `Visa de ${hits.length} passager som hittades`,
                )}
          </summary>
          {verified?.allegory && (
            <>
              <h3 className="lq-law-title">
                {l('What the law says', 'Vad lagen säger')}
              </h3>
              {quoted}
            </>
          )}
          <h3 className="lq-law-title">{l('Sources', 'Källor')}</h3>
          <ol className="lq-passages">
            {hits.map(({ item }, i) => (
              <li
                key={item.id}
                id={anchor(item.id)}
                lang={lang}
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
          {!all && hits.length > FIRST && (
            <button
              type="button"
              className="btn-text lq-more"
              onClick={() => setAll(true)}
            >
              {l(`Show all ${hits.length}`, `Visa alla ${hits.length}`)}
            </button>
          )}
        </details>
      )}
    </li>
  )
}

export default function Thread({
  turns,
  lang,
}: {
  turns: Turn[]
  lang?: string
}) {
  if (!turns.length) return null
  return (
    <ol
      className="lq-thread"
      role="log"
      aria-label={l('Conversation', 'Samtal')}
    >
      {turns.map((turn) => (
        <TurnView key={turn.id} turn={turn} lang={lang} />
      ))}
    </ol>
  )
}
