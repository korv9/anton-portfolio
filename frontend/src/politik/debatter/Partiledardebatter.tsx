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
import { Board, Card, Cards, Empty, Kpi, Kpis } from '../board/Board'
import Heatmap from '../dash/Heatmap'
import { debateHref } from './DebateView'
import {
  issuesIn,
  loadDebateIndex,
  loadIssueLexicon,
  loadSpeeches,
  type DebateIndex,
  type Speech,
} from './data'
import DebateTimeline from './DebateTimeline'
import TopicBars from './TopicBars'
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

  const given = present.map((p) => ({
    party: p,
    n: Object.values(debate.replied_to[p] ?? {}).reduce((s, v) => s + v, 0),
  }))
  const received = present.map((p) => ({
    party: p,
    n: present.reduce((s, q) => s + (debate.replied_to[q]?.[p] ?? 0), 0),
  }))
  const topGiven = [...given].sort((a, b) => b.n - a.n)[0]
  const topReceived = [...received].sort((a, b) => b.n - a.n)[0]
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
        `${all.length} party-leader debates since ${all[0].date.slice(0, 4)}. The chosen debate: ${dayName(debate.date)}.`,
        `${all.length} partiledardebatter sedan ${all[0].date.slice(0, 4)}. Vald debatt: ${dayName(debate.date)}.`,
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
      <Kpis>
        <Kpi
          index={2}
          label={l('Replies most', 'Replikerar mest')}
          value={topGiven?.n ?? 0}
          format={(v) => `${topGiven?.party ?? ''} ${num(v)}`}
          sub={topGiven ? partyName(topGiven.party) : undefined}
        />
        <Kpi
          index={3}
          label={l('Replied to most', 'Får flest repliker')}
          value={topReceived?.n ?? 0}
          format={(v) => `${topReceived?.party ?? ''} ${num(v)}`}
          sub={topReceived ? partyName(topReceived.party) : undefined}
        />
      </Kpis>

      <p className="board-cta">
        <a
          className="board-button"
          href={debateHref('partiledare', debate.session, debate.id)}
        >
          {l(
            'Read the debate reply by reply',
            'Läs debatten replik för replik',
          )}
        </a>
      </p>

      <Cards>
        <Card
          index={0}
          wide
          title={l(
            'What the parties talked about, compared with the debate before',
            'Vad partierna pratade om, jämfört med debatten innan',
          )}
          meta={l(
            `Share of each party's words in ${dayName(debate.date)}, by issue area read from the words${earlierDebate ? `, dashed frame: ${dayName(earlierDebate.date)}` : ''}`,
            `Andel av partiets ord ${dayName(debate.date)}, per sakområde som orden pekar på${earlierDebate ? `, streckad ram: ${dayName(earlierDebate.date)}` : ''}`,
          )}
        >
          {speeches && lexicon ? (
            <TopicBars
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
          index={1}
          wide
          title={l(
            'Who spoke when, and about what',
            'Vem som talade när, och om vad',
          )}
          meta={l(
            `${dayName(debate.date)}, one lane per party, each block a speech as long as its words, the issue areas are read from the words`,
            `${dayName(debate.date)}, en rad per parti, varje block ett inlägg lika långt som sina ord, ämnena läses ur orden`,
          )}
        >
          {speeches && lexicon ? (
            <DebateTimeline
              speeches={speeches}
              issues={index.issues}
              parties={parties}
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

        <Card
          index={6}
          wide
          title={l('All party-leader debates', 'Alla partiledardebatter')}
          meta={l('Newest first', 'Nyast först')}
        >
          <div
            className="board-table-wrap"
            tabIndex={0}
            role="region"
            aria-label={l(
              'Table of all party-leader debates',
              'Tabell över alla partiledardebatter',
            )}
          >
            <table className="board-table">
              <thead>
                <tr>
                  <th scope="col">{l('Date', 'Datum')}</th>
                  <th scope="col">{l('Session', 'Riksmöte')}</th>
                  <th scope="col" className="num">
                    {l('Speeches', 'Inlägg')}
                  </th>
                  <th scope="col" className="num">
                    {l('Replies', 'Repliker')}
                  </th>
                  <th scope="col">{l('Read', 'Läs')}</th>
                </tr>
              </thead>
              <tbody>
                {[...all].reverse().map((d) => (
                  <tr key={d.id}>
                    <td>{dayName(d.date)}</td>
                    <td>{d.session}</td>
                    <td className="num">{num(d.speeches)}</td>
                    <td className="num">{num(d.replies)}</td>
                    <td>
                      <a href={debateHref('partiledare', d.session, d.id)}>
                        {l('Reply by reply', 'Replik för replik')}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Cards>
    </Board>
  )
}
