/**
 * One debate, replik för replik: the order of speaking as a strip, speeches and replies per
 * party, what the debate was about (the committee report and how each party voted on it, or
 * the issue areas its words point to), and every exchange in order: the speech, then each
 * reply and answer, with who answers whom.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { l } from '../../i18n'
import {
  PartyLogo,
  RIKSDAG_PARTIES,
  identity,
  partyName,
} from '../../parties/identity'
import type { Route } from '../../router'
import { useParties, withParties } from '../partySelection'
import { dayName, num } from '../controls'
import { Board, Card, Cards, Empty, Kpi, Kpis } from '../board/Board'
import Columns from '../board/Columns'
import DashBars from '../dash/DashBars'
import {
  exchanges,
  issuesIn,
  loadDebateIndex,
  loadSession,
  loadSpeeches,
  speakerName,
  type DebateIndex,
  type Exchange,
  type IssueDebate,
  type LeaderDebate,
  type Speech,
  type Turn,
} from './data'
import './debatter.css'

const excerpt = (text: string, length = 320) => {
  const clean = text.replace(/^(herr|fru) talman!\s*/i, '').replace(/\s+/g, ' ')
  return clean.length > length
    ? `${clean.slice(0, length).replace(/\s\S*$/, '')} …`
    : clean
}

export function debateHref(
  kind: 'sak' | 'partiledare',
  session: string,
  id: string,
) {
  return `#politik-debatt?typ=${kind}&riksmote=${encodeURIComponent(session)}&id=${id}`
}

export function IssueChips({
  keys,
  via,
  index,
}: {
  keys: string[]
  via: 'beslut' | 'ord'
  index: DebateIndex
}) {
  if (!keys.length) return <span className="dash-empty">–</span>
  return (
    <ul className="issue-chips">
      {keys.map((key) => {
        const issue = index.issues.find((i) => i.key === key)
        return (
          <li
            key={key}
            className={via === 'ord' ? 'word' : undefined}
            title={
              via === 'ord'
                ? l('Matched on words in the text', 'Matchat på ord i texten')
                : l(
                    'The committee that prepared the decision',
                    'Utskottet som beredde beslutet',
                  )
            }
          >
            <a href={`#issue-${key}`}>{issue ? l(issue.en, issue.sv) : key}</a>
          </li>
        )
      })}
    </ul>
  )
}

function Position({ value }: { value: string | undefined }) {
  const cls = value === 'Ja' ? 'yes' : value === 'Nej' ? 'no' : 'abstain'
  return <span className={`position ${value ? cls : ''}`}>{value ?? '–'}</span>
}

/**
 * One turn as a chat bubble from the party's logo: the opening speaker and their answers on the
 * left, the replies to them on the right, so an exchange reads like a conversation.
 */
function TurnView({ turn, index }: { turn: Turn; index: DebateIndex }) {
  const s = turn.speech
  const topics =
    turn.kind === 'anförande' ? issuesIn(s.speech_text, index.issues, 3) : []
  const known = !!s.party && RIKSDAG_PARTIES.includes(s.party)
  const side = turn.kind === 'replik' ? 'right' : 'left'
  return (
    <article
      className={`turn ${turn.kind} ${side}`}
      id={`tal-${s.speech_number}`}
      style={{
        ['--party' as string]: known ? identity(s.party!).color : '#9a9a9a',
      }}
    >
      <div className="turn-avatar round" aria-hidden="true">
        {known ? (
          <PartyLogo party={s.party!} size={30} />
        ) : (
          <span>{speakerName(s.speaker).slice(0, 1)}</span>
        )}
      </div>
      <div className="turn-bubble round">
        <header>
          <span className="turn-no">{s.speech_number}</span>
          <b>{speakerName(s.speaker)}</b>
          {known && <span className="turn-party">{s.party}</span>}
          <span className="turn-kind">
            {turn.kind === 'anförande'
              ? l('Speech', 'Anförande')
              : turn.kind === 'replik'
                ? `${l('Reply to', 'Replik till')} ${speakerName(turn.to?.speaker ?? '')}`
                : `${l('Answers', 'Svar till')} ${speakerName(turn.to?.speaker ?? '')}`}
          </span>
        </header>
        <p>{excerpt(s.speech_text)}</p>
        <details>
          <summary>{l('Read it all', 'Läs hela')}</summary>
          {s.speech_text.split(/\n+/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
          <a href={s.source_url} target="_blank" rel="noreferrer">
            {l('The protocol at riksdagen.se', 'Protokollet på riksdagen.se')} ↗
          </a>
        </details>
        {topics.length > 0 && (
          <IssueChips keys={topics} via="ord" index={index} />
        )}
      </div>
    </article>
  )
}

/** Someone is about to speak: three dots in their party's colour. */
function Typing({ turn }: { turn: Turn }) {
  const s = turn.speech
  const known = !!s.party && RIKSDAG_PARTIES.includes(s.party)
  return (
    <div
      className={`turn typing ${turn.kind === 'replik' ? 'right' : 'left'}`}
      style={{
        ['--party' as string]: known ? identity(s.party!).color : '#9a9a9a',
      }}
      aria-hidden="true"
    >
      <div className="turn-avatar round">
        {known && <PartyLogo party={s.party!} size={30} />}
      </div>
      <div className="turn-bubble round">
        <i className="round" />
        <i className="round" />
        <i className="round" />
      </div>
    </div>
  )
}

export default function DebateView({ route }: { route: Route }) {
  const kind = route.params.get('typ') === 'partiledare' ? 'partiledare' : 'sak'
  const session = route.params.get('riksmote') ?? ''
  const id = route.params.get('id') ?? ''
  const { selected } = useParties(route)
  const [index, setIndex] = useState<DebateIndex | null>(null)
  const [debate, setDebate] = useState<IssueDebate | LeaderDebate | null>(null)
  const [speeches, setSpeeches] = useState<Speech[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const total = useRef(0)
  // While playing, the next turn appears after a pause long enough to read the dots.
  useEffect(() => {
    if (step == null || paused || step >= total.current) return
    const timer = window.setTimeout(() => {
      setStep((c) => (c == null ? c : c + 1))
      requestAnimationFrame(() =>
        document
          .querySelector('.exchanges .turn:last-of-type')
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      )
    }, 1700)
    return () => window.clearTimeout(timer)
  }, [step, paused])

  useEffect(() => {
    setDebate(null)
    setSpeeches(null)
    loadDebateIndex()
      .then(async (ix) => {
        setIndex(ix)
        const found =
          kind === 'partiledare'
            ? ix.leaders.find((d) => d.id === id)
            : await (async () => {
                const s = ix.sessions.find((x) => x.session === session)
                if (!s) return undefined
                const file = await loadSession(s.path)
                return file.debates.find((d) => d.id === id)
              })()
        if (!found)
          throw new Error(
            l('The debate was not found.', 'Debatten hittades inte.'),
          )
        setDebate(found)
        const all = await loadSpeeches(found.path)
        setSpeeches(
          'first' in found
            ? all.filter(
                (s) =>
                  s.speech_number >= found.first &&
                  s.speech_number <= found.last,
              )
            : all,
        )
      })
      .catch((e: Error) => setError(e.message))
  }, [kind, session, id])

  const rounds = useMemo(
    () => (speeches ? exchanges(speeches) : []),
    [speeches],
  )
  const back =
    kind === 'partiledare'
      ? '#politik-partiledardebatter'
      : `#politik-sakdebatter?riksmote=${encodeURIComponent(session)}`

  if (error)
    return (
      <p role="alert" className="theme-error">
        {error} <a href={back}>{l('Back', 'Tillbaka')}</a>
      </p>
    )
  if (!index || !debate) return <Empty />

  const parties = RIKSDAG_PARTIES.filter((p) => debate.parties[p])
  const involved = (x: Exchange) =>
    !selected.length ||
    [x.opening, ...x.replies].some(
      (t) => t.speech.party && selected.includes(t.speech.party),
    )
  const shownRounds = rounds.filter(involved)
  // Play the debate: the turns appear one after another, each announced by typing dots.
  const sequence = shownRounds.flatMap((r) => [r.opening, ...r.replies])
  const order = new Map(sequence.map((t, i) => [t, i]))
  total.current = sequence.length
  const shown = (t: Turn) => step == null || (order.get(t) ?? 0) < step
  const next = step != null && step < sequence.length ? sequence[step] : null
  const issueDebate = 'issues' in debate ? debate : null
  const leaderTopics =
    !issueDebate && speeches
      ? index.issues
          .map((issue) => ({
            issue,
            count: rounds.filter(
              (r) =>
                issuesIn(r.opening.speech.speech_text, [issue], 1, 2).length,
            ).length,
          }))
          .filter((x) => x.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
      : []
  const longest = speeches?.length
    ? [...speeches].sort(
        (a, b) => b.speech_text.length - a.speech_text.length,
      )[0]
    : null

  return (
    <Board
      title={debate.title}
      sub={
        <>
          <a href={withParties(back, selected)}>
            ←{' '}
            {kind === 'partiledare'
              ? l('Party-leader debates', 'Partiledardebatter')
              : l('Issue debates', 'Sakdebatter')}
          </a>
          {' · '}
          {dayName(debate.date)} ·{' '}
          {kind === 'partiledare'
            ? l('party-leader debate', 'partiledardebatt')
            : l('issue debate', 'sakdebatt')}
          {issueDebate?.decision &&
            ` · ${l('report', 'betänkande')} ${issueDebate.decision.designation}`}
        </>
      }
    >
      <Kpis>
        <Kpi
          index={0}
          label={l('Speeches and replies', 'Anföranden och repliker')}
          value={debate.speeches}
          format={(v) => num(v)}
        />
        <Kpi
          index={1}
          label={l('Of which replies', 'Varav repliker')}
          value={debate.replies}
          format={(v) => num(v)}
          sub={
            debate.speeches
              ? `${num((debate.replies / debate.speeches) * 100)} %`
              : undefined
          }
        />
        <Kpi
          index={2}
          label={l('Parties speaking', 'Partier som talade')}
          value={parties.length}
          format={(v) => num(v)}
        />
        <Kpi
          index={3}
          label={l('Exchanges', 'Replikskiften')}
          value={rounds.length}
          format={(v) => num(v)}
          sub={l('speeches with their replies', 'anföranden med sina repliker')}
        />
        {longest && (
          <Kpi
            index={4}
            label={l('Longest speech', 'Längsta inlägget')}
            value={longest.speech_text.split(/\s+/).length}
            format={(v) => `${num(v)} ${l('words', 'ord')}`}
            sub={speakerName(longest.speaker)}
          />
        )}
      </Kpis>

      <Cards>
        <Card
          index={0}
          title={l('What the debate was about', 'Vad debatten gällde')}
          meta={
            issueDebate
              ? issueDebate.issues_via === 'beslut'
                ? l(
                    'Issue area from the committee that prepared the decision',
                    'Sakområde från utskottet som beredde beslutet',
                  )
                : l(
                    'Issue areas matched on words in the title; no decision is linked',
                    'Sakområden matchade på ord i rubriken; inget beslut är kopplat',
                  )
              : l(
                  'Issue areas the speeches mention (word matches), number of speeches',
                  'Sakområden som anförandena nämner (ordmatchning), antal anföranden',
                )
          }
        >
          {issueDebate ? (
            <>
              <IssueChips
                keys={issueDebate.issues}
                via={issueDebate.issues_via}
                index={index}
              />
              {issueDebate.decision ? (
                <div
                  className="board-table-wrap decision-table"
                  tabIndex={0}
                  role="region"
                  aria-label={l(
                    'How the parties voted',
                    'Hur partierna röstade',
                  )}
                >
                  <table className="board-table">
                    <caption className="visually-hidden">
                      {l(
                        'How the parties voted on each point',
                        'Hur partierna röstade i varje punkt',
                      )}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{l('Point', 'Punkt')}</th>
                        {RIKSDAG_PARTIES.map((p) => (
                          <th key={p} scope="col" className="num">
                            <abbr title={partyName(p)}>{p}</abbr>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {issueDebate.decision.points.map((point) => (
                        <tr key={point.id}>
                          <td>
                            {point.point != null && <b>{point.point}. </b>}
                            {point.heading}
                          </td>
                          {RIKSDAG_PARTIES.map((p) => (
                            <td key={p} className="num">
                              <Position value={point.positions[p]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="dash-empty">
                  {l(
                    'Decisions are linked for 2024/25 and later, where the debate’s title matches a decision.',
                    'Beslut kopplas för 2024/25 och senare, där debattens rubrik matchar ett beslut.',
                  )}
                </p>
              )}
            </>
          ) : speeches ? (
            <DashBars
              bars={leaderTopics.map((t) => ({
                key: t.issue.key,
                label: l(t.issue.en, t.issue.sv),
                value: t.count,
                tone: 'neutral' as const,
              }))}
              format={(v) => num(v)}
              label={l(
                'Issue areas in the speeches',
                'Sakområden i anförandena',
              )}
            />
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={1}
          title={l(
            'Speeches and replies per party',
            'Anföranden och repliker per parti',
          )}
          meta={l(
            'Darker: speeches · lighter: replies and answers',
            'Mörkare: anföranden · ljusare: repliker och svar',
          )}
        >
          <Columns
            categories={parties}
            series={[
              {
                key: 'a',
                label: l('Speeches', 'Anföranden'),
                values: parties.map((p) => debate.parties[p][0]),
              },
              {
                key: 'r',
                label: l('Replies', 'Repliker'),
                values: parties.map((p) => debate.parties[p][1]),
              },
            ]}
            stacked
            format={(v) => num(v)}
            label={l(
              'Speeches and replies per party',
              'Anföranden och repliker per parti',
            )}
          />
        </Card>

        <Card
          index={2}
          wide
          title={l('Order of speaking', 'Talordning')}
          meta={l(
            'One block per speech in order; tall blocks are speeches, short ones replies. Click to jump.',
            'Ett block per inlägg i ordning; höga block är anföranden, låga repliker. Klicka för att hoppa dit.',
          )}
        >
          {speeches ? (
            <ol
              className="speech-strip"
              aria-label={l('Order of speaking', 'Talordning')}
            >
              {speeches.map((s) => {
                const p = s.party ? identity(s.party) : null
                const dim =
                  selected.length > 0 &&
                  !(s.party && selected.includes(s.party))
                return (
                  <li
                    key={s.speech_id}
                    className={`${s.is_reply ? 'reply' : 'main'}${dim ? ' dim' : ''}`}
                  >
                    <a
                      href={`#tal-${s.speech_number}`}
                      onClick={(e) => {
                        e.preventDefault()
                        document
                          .getElementById(`tal-${s.speech_number}`)
                          ?.scrollIntoView({ block: 'start' })
                      }}
                      title={`${s.speech_number}. ${speakerName(s.speaker)}${s.party ? ` (${s.party})` : ''}${s.is_reply ? ` · ${l('reply', 'replik')}` : ''}`}
                      style={{
                        background: p?.color ?? '#9a9a9a',
                        outline: p?.casing
                          ? `1px solid ${p.casing}`
                          : undefined,
                      }}
                    >
                      <span className="visually-hidden">
                        {s.speech_number}. {speakerName(s.speaker)}
                      </span>
                    </a>
                  </li>
                )
              })}
            </ol>
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={3}
          wide
          title={l('Reply by reply', 'Replik för replik')}
          meta={
            selected.length
              ? l(
                  `Exchanges in which ${selected.join(', ')} take part`,
                  `Replikskiften där ${selected.join(', ')} deltar`,
                )
              : l(
                  'Every exchange in order: the speech, then each reply and answer',
                  'Varje replikskifte i ordning: anförandet, sedan varje replik och svar',
                )
          }
        >
          {!speeches ? (
            <Empty />
          ) : (
            <>
              <div className="debate-play">
                <button
                  type="button"
                  className="board-button"
                  onClick={() =>
                    setStep((current) =>
                      current == null || current >= sequence.length ? 1 : null,
                    )
                  }
                >
                  {step == null || step >= sequence.length
                    ? `▶ ${l('Play the debate', 'Spela upp debatten')}`
                    : `■ ${l('Show everything', 'Visa allt')}`}
                </button>
                {step != null && step < sequence.length && (
                  <>
                    <button type="button" onClick={() => setPaused((p) => !p)}>
                      {paused
                        ? `▶ ${l('Resume', 'Fortsätt')}`
                        : `❚❚ ${l('Pause', 'Pausa')}`}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setStep((c) => Math.min((c ?? 0) + 1, sequence.length))
                      }
                    >
                      {l('Next', 'Nästa')} →
                    </button>
                    <span className="debate-play-count">
                      {step} / {sequence.length}
                    </span>
                  </>
                )}
              </div>
              <ol className="exchanges">
                {shownRounds.map((round) => {
                  const turns = [round.opening, ...round.replies]
                  const visible = turns.filter((t) => shown(t))
                  if (!visible.length && !(next && turns.includes(next)))
                    return null
                  return (
                    <li key={round.opening.speech.speech_id}>
                      {shown(round.opening) && (
                        <TurnView turn={round.opening} index={index} />
                      )}
                      {next === round.opening && <Typing turn={next} />}
                      {round.replies.length > 0 && (
                        <ol className="replies">
                          {round.replies.map((turn) =>
                            shown(turn) ? (
                              <li key={turn.speech.speech_id}>
                                <TurnView turn={turn} index={index} />
                              </li>
                            ) : next === turn ? (
                              <li key={turn.speech.speech_id}>
                                <Typing turn={turn} />
                              </li>
                            ) : null,
                          )}
                        </ol>
                      )}
                    </li>
                  )
                })}
              </ol>
            </>
          )}
        </Card>
      </Cards>
    </Board>
  )
}
