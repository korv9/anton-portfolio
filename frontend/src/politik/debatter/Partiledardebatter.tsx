/**
 * Partiledardebatter: every party-leader debate since 1993/94. How the debates have changed
 * (speeches and replies per debate), who replies to whom in the chosen debate, each party's
 * part in it, and each party's replies across debates as small column charts. Every debate
 * opens replik för replik.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { partyName } from '../../parties/identity'
import type { Route } from '../../router'
import { shownParties, useParties } from '../partySelection'
import { useViewParams } from '../useViewParams'
import { Select, dayName, num } from '../controls'
import { Board, Card, Cards, Empty } from '../board/Board'
import Heatmap from '../dash/Heatmap'
import {
  issuesIn,
  loadDebateIndex,
  loadIssueLexicon,
  loadSpeeches,
  type DebateIndex,
  type Speech,
} from './data'
import DebateChat from './DebateChat'
import TopicMatrix from './TopicMatrix'
import './debatter.css'

const DEFAULTS = { debatt: '' }

export default function Partiledardebatter({ route }: { route: Route }) {
  const [view, setView] = useViewParams(route, DEFAULTS)
  const { selected } = useParties(route)
  const [index, setIndex] = useState<DebateIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speeches, setSpeeches] = useState<Speech[] | null>(null)
  const [speechError, setSpeechError] = useState(false)
  const [earlier, setEarlier] = useState<Speech[] | null>(null)
  // The learned issue lexicon; the topic charts wait for it so they classify once.
  const [lexicon, setLexicon] = useState(false)
  useEffect(() => {
    loadIssueLexicon().then(() => setLexicon(true))
  }, [])
  useEffect(() => {
    loadDebateIndex()
      .then(setIndex)
      .catch((e: Error) => setError(e.message))
  }, [])
  // The chosen debate's speeches, for the timeline.
  const chosenAt = index
    ? Math.max(
        0,
        index.leaders.findIndex((d) => d.id === view.debatt) === -1
          ? index.leaders.length - 1
          : index.leaders.findIndex((d) => d.id === view.debatt),
      )
    : -1
  const chosenPath = index?.leaders[chosenAt]?.path
  const earlierPath = index?.leaders[chosenAt - 1]?.path
  useEffect(() => {
    setEarlier(null)
    if (!earlierPath) return
    let live = true
    loadSpeeches(earlierPath)
      .then((s) => live && setEarlier(s))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [earlierPath])
  useEffect(() => {
    if (!chosenPath) return
    let live = true
    setSpeeches(null)
    setSpeechError(false)
    loadSpeeches(chosenPath)
      .then((s) => live && setSpeeches(s))
      .catch(() => live && setSpeechError(true))
    return () => {
      live = false
    }
  }, [chosenPath])
  if (error)
    return (
      <p role="alert" className="theme-error">
        {error}
      </p>
    )
  if (!index) return <Empty />

  const all = index.leaders
  const debate = all.find((d) => d.id === view.debatt) ?? all.at(-1)!
  const parties = shownParties(selected)
  const present = parties.filter((p) => debate.parties[p])

  const earlierDebate = all[all.indexOf(debate) - 1]

  // What each party talked about: the share of its words in speeches whose words point to each
  // issue area, in this debate and in the one before.
  const topicShare = (list: Speech[] | null) => {
    const out = new Map<string, number>()
    if (!list) return out
    const totals = new Map<string, number>()
    for (const sp of list) {
      if (!sp.party) continue
      const words =
        (sp as Speech & { word_count?: number }).word_count ??
        sp.speech_text.split(/\s+/).length
      totals.set(sp.party, (totals.get(sp.party) ?? 0) + words)
      const [issue] = issuesIn(sp.speech_text, index.issues, 1, 2)
      if (issue)
        out.set(
          `${issue}|${sp.party}`,
          (out.get(`${issue}|${sp.party}`) ?? 0) + words,
        )
    }
    for (const [key, words] of out)
      out.set(key, (words / (totals.get(key.split('|')[1]) ?? 1)) * 100)
    return out
  }
  const nowTopics = topicShare(lexicon ? speeches : null)
  const earlierTopics = topicShare(lexicon ? earlier : null)
  const topicRows = index.issues
    .map((issue) => ({
      key: issue.key,
      label: l(issue.en, issue.sv),
      weight: parties.reduce(
        (s, p) => s + (nowTopics.get(`${issue.key}|${p}`) ?? 0),
        0,
      ),
    }))
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8)

  return (
    <Board
      title={l('Party-leader debates', 'Partiledardebatter')}
      sub={l(
        `${all.length} party-leader debates since ${all[0].date.slice(0, 4)}. Pick a debate to see what each party talked about and read it turn by turn.`,
        `${all.length} partiledardebatter sedan ${all[0].date.slice(0, 4)}. Välj en debatt för att se vad varje parti pratade om och läsa den inlägg för inlägg.`,
      )}
      slicers={
        <>
          <Select
            label={l('Debate', 'Debatt')}
            value={debate.id}
            options={[...all]
              .reverse()
              .map((d) => ({ value: d.id, label: `${d.date}, ${d.session}` }))}
            onChange={(debatt) => setView({ debatt })}
          />
        </>
      }
    >
      <Cards>
        <Card
          index={0}
          wide
          title={l('What the parties talked about', 'Vad partierna pratade om')}
          meta={l(
            `Share of each party's words in ${dayName(debate.date)}, by issue area read from the words${earlierDebate ? `, dashed frame: ${dayName(earlierDebate.date)}` : ''}`,
            `Andel av partiets ord ${dayName(debate.date)}, per sakområde som orden pekar på${earlierDebate ? `, streckad ram: ${dayName(earlierDebate.date)}` : ''}`,
          )}
        >
          {speeches && lexicon ? (
            <TopicMatrix
              rows={topicRows}
              parties={present}
              value={(row, p) => nowTopics.get(`${row}|${p}`) ?? null}
              previous={
                earlier
                  ? (row, p) => earlierTopics.get(`${row}|${p}`) ?? null
                  : undefined
              }
              previousLabel={
                earlierDebate ? dayName(earlierDebate.date) : undefined
              }
              unit={l('% of words', '% av orden')}
            />
          ) : speechError ? (
            <p className="dash-empty">
              {l(
                'The speeches could not be loaded.',
                'Anförandena kunde inte hämtas.',
              )}
            </p>
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={3}
          title={l('Who replies to whom', 'Vem replikerar på vem')}
          meta={l(
            `Rows reply to columns, replies and answers, ${dayName(debate.date)}`,
            `Raden replikerar på kolumnen, repliker och svar, ${dayName(debate.date)}`,
          )}
        >
          <Heatmap
            rows={present.map((p) => ({ key: p, label: partyName(p) }))}
            rowHeader="party"
            parties={present}
            value={(row, col) =>
              row === col ? null : (debate.replied_to[row]?.[col] ?? 0)
            }
            format={(v) => num(v)}
            caption={l(
              'Replies from the row party to the column party',
              'Repliker från radens parti till kolumnens parti',
            )}
          />
        </Card>
      </Cards>

      <section className="chat-section" aria-labelledby="leader-chat-title">
        <h2 id="leader-chat-title">
          {l('The debate, turn by turn', 'Debatten, inlägg för inlägg')}
        </h2>
        <p className="chat-meta">
          {dayName(debate.date)}, {num(debate.speeches)}{' '}
          {l('speeches', 'anföranden')}, {num(debate.replies)}{' '}
          {l('replies', 'repliker')}
        </p>
        {speeches ? (
          <DebateChat key={debate.id} speeches={speeches} parties={selected} />
        ) : speechError ? (
          <p className="dash-empty">
            {l(
              'The speeches could not be loaded.',
              'Anförandena kunde inte hämtas.',
            )}
          </p>
        ) : (
          <Empty />
        )}
      </section>
    </Board>
  )
}
