/**
 * One debate as a timeline: a lane per party, and a block for every speech placed where it
 * falls in the debate and as wide as it is long (words). The debate is split into its
 * beginning, middle and end; under each part the party that spoke most then and the issue
 * areas its words point to. Hovering or focusing a block shows who spoke and about what.
 */
import { useMemo, useState } from 'react'
import { l } from '../../i18n'
import {
  PartyLogo,
  RIKSDAG_PARTIES,
  identity,
  partyName,
} from '../../parties/identity'
import { num } from '../controls'
import { issuesIn, speakerName, type Issue, type Speech } from './data'

type Block = {
  speech: Speech
  start: number
  words: number
  topics: string[]
}

const wordsOf = (s: Speech & { word_count?: number }) =>
  s.word_count ?? s.speech_text.split(/\s+/).length

const PARTS: [string, string][] = [
  ['Beginning', 'Början'],
  ['Middle', 'Mitten'],
  ['End', 'Slutet'],
]

export default function DebateTimeline({
  speeches,
  issues,
  parties,
}: {
  speeches: Speech[]
  issues: Issue[]
  /** The parties to draw, in order. */
  parties: string[]
}) {
  const [active, setActive] = useState<Block | null>(null)
  const issueName = (key: string) => {
    const issue = issues.find((i) => i.key === key)
    return issue ? l(issue.en, issue.sv) : key
  }

  const { blocks, total, thirds } = useMemo(() => {
    let at = 0
    const blocks: Block[] = speeches.map((speech) => {
      const words = wordsOf(speech)
      const block = {
        speech,
        start: at,
        words,
        topics: issuesIn(speech.speech_text, issues, 2, 2),
      }
      at += words
      return block
    })
    const total = Math.max(at, 1)
    // Each third: words per party, and the issue areas of the leading party's speeches.
    const thirds = PARTS.map((_, i) => {
      const from = (total * i) / 3
      const to = (total * (i + 1)) / 3
      const inPart = blocks.filter((b) => {
        const mid = b.start + b.words / 2
        return mid >= from && mid < to
      })
      const byParty = new Map<string, number>()
      for (const b of inPart)
        if (b.speech.party)
          byParty.set(
            b.speech.party,
            (byParty.get(b.speech.party) ?? 0) + b.words,
          )
      const leader = [...byParty.entries()].sort((a, b) => b[1] - a[1])[0]
      const topics = leader
        ? issuesIn(
            inPart
              .filter((b) => b.speech.party === leader[0])
              .map((b) => b.speech.speech_text)
              .join(' '),
            issues,
            3,
            3,
          )
        : []
      return { leader, topics, words: inPart.reduce((s, b) => s + b.words, 0) }
    })
    return { blocks, total, thirds }
  }, [speeches, issues])

  const lanes = parties.filter((p) => blocks.some((b) => b.speech.party === p))
  const others = blocks.some(
    (b) => !b.speech.party || !RIKSDAG_PARTIES.includes(b.speech.party),
  )
  const laneOf = (b: Block) =>
    b.speech.party && lanes.includes(b.speech.party) ? b.speech.party : '–'
  const shownLanes = others ? [...lanes, '–'] : lanes

  return (
    <div className="timeline">
      <ol className="timeline-parts">
        {thirds.map((part, i) => (
          <li key={PARTS[i][0]}>
            <span className="timeline-part-name">{l(...PARTS[i])}</span>
            {part.leader ? (
              <>
                <b>
                  {partyName(part.leader[0])}{' '}
                  <small>
                    {num(Math.round((part.leader[1] / part.words) * 100))}{' '}
                    {l('% of the words', '% av orden')}
                  </small>
                </b>
                {part.topics.length > 0 && (
                  <span className="timeline-topics">
                    {part.topics.map(issueName).join(', ')}
                  </span>
                )}
              </>
            ) : (
              <span>–</span>
            )}
          </li>
        ))}
      </ol>

      <div
        className="timeline-grid"
        role="group"
        aria-label={l(
          'Who spoke when in the debate, one lane per party',
          'Vem som talade när i debatten, en rad per parti',
        )}
      >
        {shownLanes.map((party) => {
          const id = identity(party)
          const words = blocks
            .filter((b) => laneOf(b) === party)
            .reduce((s, b) => s + b.words, 0)
          return (
            <div className="timeline-lane" key={party}>
              <span className="timeline-lane-name">
                {party !== '–' && <PartyLogo party={party} size={20} />}
                <b>{party === '–' ? l('Other', 'Övriga') : party}</b>
              </span>
              <div className="timeline-track">
                {blocks
                  .filter((b) => laneOf(b) === party)
                  .map((b) => (
                    <button
                      key={b.speech.speech_id}
                      type="button"
                      className={`timeline-block${b.speech.is_reply ? ' reply' : ''}${active?.speech.speech_id === b.speech.speech_id ? ' active' : ''}`}
                      style={{
                        left: `${(b.start / total) * 100}%`,
                        width: `max(3px, ${(b.words / total) * 100}%)`,
                        background: party === '–' ? '#9a9a9a' : id.color,
                      }}
                      aria-label={`${b.speech.speech_number}. ${speakerName(b.speech.speaker)}, ${num(b.words)} ${l('words', 'ord')}`}
                      onMouseEnter={() => setActive(b)}
                      onFocus={() => setActive(b)}
                      onClick={() =>
                        document
                          .getElementById(`tal-${b.speech.speech_number}`)
                          ?.scrollIntoView({ block: 'start' })
                      }
                    />
                  ))}
              </div>
              <span className="timeline-lane-total">{num(words)}</span>
            </div>
          )
        })}
      </div>
      <p className="timeline-axis">
        <span>{l('Start of the debate', 'Debattens början')}</span>
        <span>
          {num(total)} {l('words in all', 'ord totalt')}
        </span>
        <span>{l('End', 'Slut')}</span>
      </p>

      <div className="timeline-detail" aria-live="polite">
        {active ? (
          <>
            <b>
              {active.speech.speech_number}.{' '}
              {speakerName(active.speech.speaker)}
              {active.speech.party ? ` (${active.speech.party})` : ''}
            </b>{' '}
            ,{' '}
            {active.speech.is_reply
              ? l('reply', 'replik')
              : l('speech', 'anförande')}{' '}
            , {num(active.words)} {l('words', 'ord')}
            {active.topics.length > 0 && (
              <>, {active.topics.map(issueName).join(', ')}</>
            )}
          </>
        ) : (
          l(
            'Hover a block to see who spoke and about what. Wide blocks are long speeches; the thin ones are replies.',
            'Hovra över ett block för att se vem som talade och om vad. Breda block är långa anföranden, smala är repliker.',
          )
        )}
      </div>
    </div>
  )
}
