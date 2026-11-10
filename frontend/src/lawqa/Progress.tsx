/**
 * A streamed turn in progress (Thread.tsx): the row of steps it has passed, and the answer as an
 * unchecked draft while Claude writes it.
 */
import { l } from '../i18n'
import type { Turn } from './Thread'

/** The draft as it is written: quotes as plain quotes, no ids and no ✓, half-written marks left out. */
export function Draft({ text, lang }: { text: string; lang?: string }) {
  const shown = text
    .replace(/\[\[[^\]]*$/, '')
    .replace(/\[\[[^\]]*\]\]\s*:?\s*/g, '')
  return (
    <div className="lq-draft">
      <p className="lq-caption">
        {l('Draft, not checked yet', 'Utkast, inte kontrollerat än')}
      </p>
      <p className="lq-answer" lang={lang}>
        {shown}
      </p>
    </div>
  )
}

type State = 'done' | 'current' | 'failed'

/** Where a streamed turn has got to: searched, found, written, checked, retold. */
export function Steps({ turn }: { turn: Turn }) {
  const { hits, reply, draft, fable } = turn
  const status = reply && typeof reply === 'object' ? reply.status : null
  const steps: [string, State][] = [
    hits
      ? [
          l(
            `Found ${hits.length} paragraphs`,
            `Hittade ${hits.length} paragrafer`,
          ),
          'done',
        ]
      : [l('Searching the law', 'Söker i lagen'), 'current'],
  ]
  if (hits && (draft || status)) {
    if (status === 'verified')
      steps.push([
        l('Checked word for word ✓', 'Kontrollerat ord för ord ✓'),
        'done',
      ])
    else if (status === 'unverified')
      steps.push([l('Failed the check', 'Klarade inte kontrollen'), 'failed'])
    else if (status === 'no_answer')
      steps.push([
        l('No answer in the law found', 'Inget svar i lagtexten'),
        'done',
      ])
    else
      steps.push([
        l('Writing and checking', 'Skriver och kontrollerar'),
        'current',
      ])
  }
  if (fable === 'waiting')
    steps.push([l('Writing the fable', 'Skriver fabeln'), 'current'])
  else if (fable) steps.push([l('Fable', 'Fabel'), 'done'])
  return (
    <ol className="lq-steps" aria-label={l('Progress', 'Förlopp')}>
      {steps.map(([text, state]) => (
        <li key={text} data-state={state}>
          {text}
        </li>
      ))}
    </ol>
  )
}
