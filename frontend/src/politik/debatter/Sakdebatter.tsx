/**
 * Sakdebatter: the Riksdag's debates on committee reports, one riksmöte at a time. How many
 * and when, which issue areas, who speaks and who replies, how the parties then voted on the
 * reports that were debated, and every debate in a list that opens replik för replik.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { RIKSDAG_PARTIES, identity, partyName } from '../../parties/identity'
import type { Route } from '../../router'
import { shownParties, useParties } from '../partySelection'
import { useViewParams } from '../useViewParams'
import { Select, dayName, num } from '../controls'
import { Board, Card, Cards, Empty, Kpi, Kpis } from '../board/Board'
import Columns from '../board/Columns'
import RankBars from '../../charts/RankBars'
import { IssueChips, debateHref } from './DebateView'
import DebateRanking from '../features/DebateRanking'
import SakAnalys from './SakAnalys'
import './debatter.css'
import {
  loadDebateIndex,
  loadSession,
  totalFor,
  type DebateIndex,
  type IssueDebate,
} from './data'

const DEFAULTS = { riksmote: '', omrade: '', sok: '' }

/**
 * The page: the analysis of the chosen party (or the Riksdag) first, then the riksmöte-level
 * explorer (leaderboard, the votes on the debated reports, every debate) behind "Fördjupa".
 */
export default function Sakdebatter({ route }: { route: Route }) {
  return (
    <>
      <SakAnalys route={route} />
      <details className="sak-deeper" id="fordjupa">
        <summary>
          {l(
            'Go deeper: the debates riksmöte by riksmöte: leaderboard, votes on the reports and every debate',
            'Fördjupa analysen: debatterna riksmöte för riksmöte: topplista, röster på betänkandena och alla debatter',
          )}
        </summary>
        <Explorer route={route} />
      </details>
    </>
  )
}

function Explorer({ route }: { route: Route }) {
  const [view, setView] = useViewParams(route, DEFAULTS)
  const { selected } = useParties(route)
  const [index, setIndex] = useState<DebateIndex | null>(null)
  const [debates, setDebates] = useState<IssueDebate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState(view.sok)

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

  if (error)
    return (
      <p role="alert" className="theme-error">
        {error}
      </p>
    )
  if (!index || !current) return <Empty />

  const parties = shownParties(selected)
  const words = query.trim().toLowerCase()
  const filtered = (debates ?? []).filter(
    (d) =>
      (!view.omrade || d.issues.includes(view.omrade)) &&
      (!selected.length || selected.some((p) => d.parties[p])) &&
      (!words || d.title.toLowerCase().includes(words)),
  )
  const issueName = (key: string) => {
    const issue = index.issues.find((i) => i.key === key)
    return issue ? l(issue.en, issue.sv) : key
  }
  const linked = filtered.filter((d) => d.decision)

  // Issue areas, by number of debates.
  const areaCounts = index.issues
    .map((issue) => ({
      issue,
      count: filtered.filter((d) => d.issues.includes(issue.key)).length,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
  // How the parties voted on the debated reports: share of points with Ja, Nej, Avstår.
  const votes = (party: string, position: string) => {
    const points = linked.flatMap((d) => d.decision!.points)
    const withParty = points.filter((p) => p.positions[party])
    return withParty.length
      ? (withParty.filter((p) => p.positions[party] === position).length /
          withParty.length) *
          100
      : null
  }

  return (
    <Board
      level={2}
      title={l(
        `The debates of ${current.session}`,
        `Debatterna under ${current.session}`,
      )}
      sub={l(
        `Debates on committee reports in riksmötet ${current.session}. Choose parties in the bar above to see the debates they take part in.`,
        `Debatter om utskottens betänkanden under riksmötet ${current.session}. Välj partier i raden ovanför för att se debatterna de deltar i.`,
      )}
      slicers={
        <>
          <Select
            label={l('Session', 'Riksmöte')}
            value={current.session}
            options={[...sessions]
              .reverse()
              .map((s) => ({ value: s.session, label: s.session }))}
            onChange={(riksmote) => setView({ riksmote })}
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
            onChange={(omrade) => setView({ omrade })}
          />
          <label className="board-search">
            <span>{l('Search titles', 'Sök i rubriker')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setView({ sok: e.target.value })
              }}
              placeholder={l('e.g. school', 't.ex. skola')}
            />
          </label>
        </>
      }
    >
      {debates && (
        <DebateRanking
          debates={debates}
          session={current.session}
          preferred={selected[0]}
        />
      )}
      <Kpis>
        <Kpi
          index={0}
          label={l('Debates', 'Debatter')}
          value={filtered.length}
          format={(v) => num(v)}
          sub={current.session}
        />
        <Kpi
          index={4}
          label={l('Linked to a decision', 'Kopplade till beslut')}
          value={linked.length}
          format={(v) => num(v)}
          sub={linked.length ? undefined : l('from 2024/25', 'från 2024/25')}
        />
      </Kpis>

      <Cards>
        <Card
          index={2}
          title={l('Issue areas debated', 'Sakområden som debatterades')}
          meta={l(
            'Number of debates, from the deciding committee, otherwise from words in the title',
            'Antal debatter, från utskottet som beslutade, annars från ord i rubriken',
          )}
        >
          {debates ? (
            <RankBars
              rows={areaCounts.slice(0, 10).map((a) => ({
                key: a.issue.key,
                label: l(a.issue.en, a.issue.sv),
                value: a.count,
              }))}
              format={(v) => num(v)}
              label={l('Debates per issue area', 'Debatter per sakområde')}
            />
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={4}
          wide
          title={l(
            'How the parties voted on the debated reports',
            'Hur partierna röstade om de debatterade betänkandena',
          )}
          meta={l(
            `Share of decision points, ${linked.length} linked debates, darkest: yes, then no, lightest: abstained`,
            `Andel beslutspunkter, ${linked.length} kopplade debatter, mörkast: ja, sedan nej, ljusast: avstår`,
          )}
        >
          {linked.length ? (
            <Columns
              categories={parties}
              series={[
                {
                  key: 'ja',
                  label: l('Yes', 'Ja'),
                  values: parties.map((p) => votes(p, 'Ja')),
                },
                {
                  key: 'nej',
                  label: l('No', 'Nej'),
                  values: parties.map((p) => votes(p, 'Nej')),
                },
                {
                  key: 'avst',
                  label: l('Abstained', 'Avstår'),
                  values: parties.map((p) => votes(p, 'Avstår')),
                },
              ]}
              stacked
              format={(v) => `${num(v)} %`}
              label={l(
                'Positions per party on the debated reports',
                'Ställningstaganden per parti i de debatterade betänkandena',
              )}
            />
          ) : (
            <Empty>
              {l(
                'No decisions are linked for this riksmöte; the decision files cover 2024/25 and later.',
                'Inga beslut är kopplade för det här riksmötet; beslutsfilerna täcker 2024/25 och senare.',
              )}
            </Empty>
          )}
        </Card>

        <Card
          index={5}
          wide
          title={l('The debates', 'Debatterna')}
          meta={l(
            `${filtered.length} debates, newest first, open one to read it reply by reply`,
            `${filtered.length} debatter, nyast först, öppna en för att läsa replik för replik`,
          )}
        >
          {debates ? (
            <div
              className="board-table-wrap"
              tabIndex={0}
              role="region"
              aria-label={l('Table of the debates', 'Tabell över debatterna')}
            >
              <table className="board-table">
                <thead>
                  <tr>
                    <th scope="col">{l('Date', 'Datum')}</th>
                    <th scope="col">{l('Debate', 'Debatt')}</th>
                    <th scope="col">{l('Issue area', 'Sakområde')}</th>
                    <th scope="col" className="num">
                      {l('Speeches', 'Inlägg')}
                    </th>
                    <th scope="col" className="num">
                      {l('Replies', 'Repliker')}
                    </th>
                    <th scope="col">{l('Parties', 'Partier')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filtered]
                    .reverse()
                    .slice(0, 200)
                    .map((d) => (
                      <tr key={d.id}>
                        <td>{dayName(d.date)}</td>
                        <td>
                          <a href={debateHref('sak', current.session, d.id)}>
                            {d.title}
                          </a>
                          {d.decision && (
                            <small className="dash-empty">
                              {' '}
                              , {d.decision.designation}
                            </small>
                          )}
                        </td>
                        <td>
                          <IssueChips
                            keys={d.issues}
                            via={d.issues_via}
                            index={index}
                          />
                        </td>
                        <td className="num">{num(d.speeches)}</td>
                        <td className="num">{num(d.replies)}</td>
                        <td>
                          <span className="party-dots">
                            {RIKSDAG_PARTIES.filter((p) => d.parties[p]).map(
                              (p) => (
                                <abbr
                                  key={p}
                                  title={`${partyName(p)}: ${totalFor(d.parties, p)}`}
                                  style={{
                                    borderBottomColor: identity(p).color,
                                  }}
                                >
                                  {p}
                                </abbr>
                              ),
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty />
          )}
          {view.omrade && (
            <p className="dash-empty">
              {l('Filtered on', 'Filtrerat på')} {issueName(view.omrade)},{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => setView({ omrade: '' })}
              >
                {l('Show all areas', 'Visa alla områden')}
              </button>
            </p>
          )}
        </Card>
      </Cards>
    </Board>
  )
}
