/**
 * A debate read as a group chat: the turns in speaking order in one window, a bubble at the
 * left, the next speaker's at the right and so on, each cut short with a button for the whole
 * of it. The turns come in one after the other; give the chat the debate's id as its key so a
 * new debate plays from the top.
 */
import { useState } from 'react'
import { l } from '../../i18n'
import { PartyLogo, partyLine, partyName } from '../../parties/identity'
import { exchanges, speakerName, type Speech } from './data'
import './chat.css'

const STEP = 12
const SHORT = 150

/** The start of a speech, without the greeting to the Speaker, cut at a word. */
function brief(text: string) {
  const flat = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(Herr|Fru) talman!\s*/, '')
  if (flat.length <= SHORT) return flat
  return `${flat.slice(0, flat.lastIndexOf(' ', SHORT))} …`
}

export default function DebateChat({
  speeches,
  parties,
}: {
  speeches: Speech[]
  /** Only these parties' turns are shown; none means every turn. */
  parties: string[]
}) {
  const [limit, setLimit] = useState(STEP)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const turns = exchanges(speeches)
    .flatMap((e) => [e.opening, ...e.replies])
    .filter((t) => !parties.length || parties.includes(t.speech.party ?? ''))
  if (!turns.length)
    return (
      <p className="dash-empty">
        {l(
          'No turns from the chosen parties in this debate.',
          'Inga inlägg från de valda partierna i den här debatten.',
        )}
      </p>
    )
  const toggle = (id: string) =>
    setOpen((now) => {
      const next = new Set(now)
      if (!next.delete(id)) next.add(id)
      return next
    })
  // The side changes with the speaker, so an exchange reads as a conversation.
  let right = true
  return (
    <div
      className="chat"
      tabIndex={0}
      role="group"
      aria-label={l('The debate as a chat', 'Debatten som chatt')}
    >
      <ol>
        {turns.slice(0, limit).map((turn, i) => {
          const { speech } = turn
          if (i === 0 || turns[i - 1].speech.speaker !== speech.speaker)
            right = !right
          const whole = open.has(speech.speech_id)
          const long = speech.speech_text.replace(/\s+/g, ' ').length > SHORT
          return (
            <li
              key={speech.speech_id}
              className="chat-turn"
              data-side={right ? 'right' : 'left'}
              data-kind={turn.kind}
              style={{
                ['--i' as string]: i % STEP,
                ['--c' as string]: speech.party
                  ? partyLine(speech.party)
                  : 'var(--subtle)',
              }}
            >
              <span className="chat-face">
                {speech.party && <PartyLogo party={speech.party} size={28} />}
              </span>
              <div className="chat-bubble">
                <p className="chat-who">
                  <b>{speakerName(speech.speaker)}</b>
                  {turn.to?.party && (
                    <span>
                      {turn.kind === 'svar'
                        ? l('answers', 'svarar')
                        : l('replies to', 'replikerar på')}{' '}
                      {partyName(turn.to.party)}
                    </span>
                  )}
                </p>
                <p className={whole ? 'chat-text whole' : 'chat-text'}>
                  {whole
                    ? speech.speech_text.trim()
                    : brief(speech.speech_text)}
                </p>
                {long && (
                  <button
                    type="button"
                    className="chat-more"
                    aria-expanded={whole}
                    onClick={() => toggle(speech.speech_id)}
                  >
                    {whole
                      ? l('Show less', 'Visa mindre')
                      : l('Read all of it', 'Läs hela')}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {turns.length > limit && (
        <button
          type="button"
          className="chat-next"
          onClick={() => setLimit(limit + STEP)}
        >
          {l(
            `Keep reading, ${turns.length - limit} turns left`,
            `Läs vidare, ${turns.length - limit} inlägg kvar`,
          )}
        </button>
      )}
    </div>
  )
}
