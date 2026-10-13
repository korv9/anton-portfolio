/**
 * Issue debates: the Riksdag's debates on committee reports, read as a chat. The reader picks a
 * riksmöte, an issue area and a debate; the debate plays turn by turn, and one chart shows which
 * areas the riksmöte debated most. From politics/parliament/debate-stats.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import type { Route } from '../../router'
import { useParties } from '../partySelection'
import { useViewParams } from '../useViewParams'
import { Select, dayName, num } from '../controls'
import { Board, Card, Cards, Empty } from '../board/Board'
import RankBars from '../../charts/RankBars'
import DebateChat from './DebateChat'
import './debatter.css'
import {
  loadDebateIndex,
  loadSession,
  loadSpeeches,
  type DebateIndex,
  type IssueDebate,
  type Speech,
} from './data'

const DEFAULTS = { riksmote: '', omrade: '', debatt: '' }

export default function Sakdebatter({ route }: { route: Route }) {
  const [view, setView] = useViewParams(route, DEFAULTS)
  const { selected } = useParties(route)
  const [index, setIndex] = useState<DebateIndex | null>(null)
  const [debates, setDebates] = useState<IssueDebate[] | null>(null)
  const [speeches, setSpeeches] = useState<Speech[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDebateIndex()
      .then(setIndex)
      .catch((e: Error) => setError(e.message))
  }, [])
  const sessions = index?.sessions ?? []
  const current =
    sessions.find((s) => s.session === view.riksmote) ?? sessions.at(-1)
  useEffect(() => {
    if (!current) return
    setDebates(null)
    loadSession(current.path)
      .then((f) => setDebates(f.debates))
      .catch((e: Error) => setError(e.message))
  }, [current?.path])

  // Newest first; a debate needs replies to read as a conversation.
  const listed = (debates ?? [])
    .filter(
      (d) =>
        d.replies > 0 &&
        (!view.omrade || d.issues.includes(view.omrade)) &&
        (!selected.length || selected.some((p) => d.parties[p])),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
  const debate = listed.find((d) => d.id === view.debatt) ?? listed[0]
  useEffect(() => {
    setSpeeches(null)
    if (!debate) return
    let live = true
    loadSpeeches(debate.path)
      .then(
        (all) =>
          live &&
          setSpeeches(
            all.filter(
              (s) =>
                s.speech_number >= debate.first &&
                s.speech_number <= debate.last,
            ),
          ),
      )
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [debate?.id])

  if (error)
    return (
      <p role="alert" className="theme-error">
        {error}
      </p>
    )
  if (!index || !current) return <Empty />

  const areas = index.issues
    .map((issue) => ({
      key: issue.key,
      label: l(issue.en, issue.sv),
      value: (debates ?? []).filter((d) => d.issues.includes(issue.key)).length,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <Board
      title={l('Issue debates', 'Sakdebatter')}
      sub={l(
        `The Riksdag’s debates on committee reports in ${current.session}. Pick an issue area and a debate to read it turn by turn.`,
        `Riksdagens debatter om utskottens betänkanden under ${current.session}. Välj ett sakområde och en debatt för att läsa den inlägg för inlägg.`,
      )}
      slicers={
        <>
          <Select
            label={l('Session', 'Riksmöte')}
            value={current.session}
            options={[...sessions]
              .reverse()
              .map((s) => ({ value: s.session, label: s.session }))}
            onChange={(riksmote) => setView({ riksmote, debatt: '' })}
          />
          <Select
            label={l('Issue area', 'Sakområde')}
            value={view.omrade}
            options={[
              { value: '', label: l('All areas', 'Alla områden') },
              ...index.issues.map((i) => ({
                value: i.key,
                label: l(i.en, i.sv),
              })),
            ]}
            onChange={(omrade) => setView({ omrade, debatt: '' })}
          />
          {debate && (
            <Select
              label={l('Debate', 'Debatt')}
              value={debate.id}
              options={listed.map((d) => ({
                value: d.id,
                label: `${d.date} ${d.title.length > 70 ? `${d.title.slice(0, 70)}…` : d.title}`,
              }))}
              onChange={(debatt) => setView({ debatt })}
            />
          )}
        </>
      }
    >
      <section className="chat-section" aria-labelledby="sak-chat-title">
        {debate ? (
          <>
            <h2 id="sak-chat-title">{debate.title}</h2>
            <p className="chat-meta">
              {dayName(debate.date)}, {num(debate.speeches)}{' '}
              {l('speeches', 'anföranden')}, {num(debate.replies)}{' '}
              {l('replies', 'repliker')}
              {debate.decision && `, ${debate.decision.designation}`}
            </p>
            {speeches ? (
              <DebateChat
                key={debate.id}
                speeches={speeches}
                parties={selected}
              />
            ) : (
              <Empty />
            )}
          </>
        ) : debates ? (
          <p className="dash-empty">
            {l(
              'No debate with replies matches the filters.',
              'Ingen debatt med repliker matchar filtren.',
            )}
          </p>
        ) : (
          <Empty />
        )}
      </section>

      <Cards>
        <Card
          index={0}
          title={l('Issue areas debated', 'Sakområden som debatterades')}
          meta={l(
            `Number of debates in ${current.session}, from the committee that decided, otherwise from words in the title. Pick a bar to read those debates.`,
            `Antal debatter under ${current.session}, från utskottet som beslutade, annars från ord i rubriken. Välj en stapel för att läsa de debatterna.`,
          )}
        >
          <RankBars
            rows={areas}
            format={(v) => num(v)}
            picked={view.omrade || null}
            onPick={(key) =>
              setView({ omrade: key === view.omrade ? '' : key, debatt: '' })
            }
            label={l('Debates per issue area', 'Debatter per sakområde')}
          />
        </Card>
      </Cards>
    </Board>
  )
}
