import { useEffect, useState } from 'react'
import { l } from '../i18n'
import MultiLineChart, { type Series } from '../charts/MultiLineChart'
import { DecisionList } from './NowPage'
import {
  PARTY_NAMES,
  PARTY_ORDER,
  load,
  partyLabel,
  percent,
  sessionDate,
  type Issue,
  type Issues,
} from './data'
import '../welfare/welfare.css'
import './parliament.css'

const number = (value: number, digits = 0) =>
  value.toLocaleString('sv-SE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

/** Plain-language summary of one issue, written from its data. */
function summary(issue: Issue) {
  const last = issue.per_session.at(-1)
  const total = issue.per_session.reduce((sum, row) => sum + row.decisions, 0)
  const lines = [
    `${issue.issue_name_sv} bereds i ${issue.committees.join(', ')}. Riksdagen har fattat ${number(total)} beslut genom votering i frågan sedan 1993/94${last ? `, ${last.decisions} av dem under ${last.session}` : ''}.`,
  ]
  const parties = issue.parties.filter((p) => p.with_government_pct != null)
  if (parties.length) {
    const opposition = [...parties]
      .filter((p) => p.role === 'opposition')
      .sort((a, b) => a.with_government_pct! - b.with_government_pct!)
    if (opposition.length) {
      const most = opposition[0]
      const least = opposition.at(-1)!
      lines.push(
        `Under den nuvarande regeringen röstade ${PARTY_NAMES[most.party] ?? most.party} oftast emot regeringen bland oppositionspartierna (samma ståndpunkt i ${percent(most.with_government_pct, 0)} av besluten) och ${PARTY_NAMES[least.party] ?? least.party} oftast med den (${percent(least.with_government_pct, 0)}).`,
      )
    }
  }
  const budget = issue.budget_outturn_msek
  if (budget.length > 1) {
    const first =
      budget.find((b) => b.year >= budget.at(-1)!.year - 10) ?? budget[0]
    const change = (budget.at(-1)!.outturn_msek / first.outturn_msek - 1) * 100
    lines.push(
      `Statens utgifter på området var ${number(budget.at(-1)!.outturn_msek / 1000, 1)} miljarder kronor ${budget.at(-1)!.year}, ${change >= 0 ? 'upp' : 'ned'} ${number(Math.abs(change), 0)} % sedan ${first.year} i löpande priser.`,
    )
  }
  return lines
}

export default function IssuePage({ issueKey }: { issueKey: string }) {
  const [issues, setIssues] = useState<Issues | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    load<Issues>('parliament/issues.json')
      .then(setIssues)
      .catch((reason: Error) => setError(reason.message))
  }, [])
  const issue = issues?.issues.find((i) => i.issue_key === issueKey)

  if (error) return <p role="alert">{error}</p>
  if (!issues) return <div className="loading">{l('Loading…', 'Laddar…')}</div>
  if (!issue)
    return (
      <div className="project-page">
        <p>{l('No such issue.', 'Sakfrågan finns inte.')}</p>
        <a href="#now-issues">{l('All issues →', 'Alla sakfrågor →')}</a>
      </div>
    )

  const decisionSeries: Series[] = [
    {
      key: 'government_won',
      name: l('Government side won', 'Regeringssidan vann'),
      points: issue.per_session
        .filter((row) => row.government_won_pct != null)
        .map((row) => ({
          date: sessionDate(row.session),
          label: `${row.session} · ${row.decisions} beslut`,
          value: row.government_won_pct!,
        })),
    },
  ]
  const budgetSeries: Series[] = [
    {
      key: 'outturn',
      name: l('Outturn, SEK bn', 'Utfall, miljarder kr'),
      points: issue.budget_outturn_msek.map((row) => ({
        date: `${row.year}-07-01`,
        label: String(row.year),
        value: row.outturn_msek / 1000,
      })),
    },
  ]
  const sessions = [...new Set(issue.speeches.map((s) => s.session))].sort()
  const recentSessions = sessions.slice(-4)
  const speechTotals = PARTY_ORDER.map((party) => ({
    party,
    speeches: issue.speeches
      .filter((s) => s.party === party && recentSessions.includes(s.session))
      .reduce((sum, s) => sum + s.speeches, 0),
  })).filter((row) => row.speeches > 0)
  const speechMax = Math.max(1, ...speechTotals.map((row) => row.speeches))

  return (
    <div className="project-page welfare-page politics-issue">
      <div className="page-lead">
        <p className="eyebrow">
          <a href="#now-issues">{l('Issues', 'Sakfrågor')}</a> ·{' '}
          {issue.committees.join(', ')}
        </p>
        <h1>{issue.issue_name_sv}</h1>
        <p>{issue.summary_sv}</p>
      </div>

      <section
        className="report welfare-section now-summary"
        aria-label={l('Summary', 'Sammanfattning')}
      >
        <p className="eyebrow">{l('In short', 'I korthet')}</p>
        <ul className="plain-summary" data-testid="issue-summary">
          {summary(issue).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section
        className="report welfare-section"
        aria-labelledby="issue-decisions"
      >
        <p className="eyebrow">{l('Decisions', 'Beslut')}</p>
        <h2 id="issue-decisions">
          {l('The latest decisions', 'De senaste besluten')}
        </h2>
        <DecisionList decisions={issue.recent_decisions} />
        <h3 className="analysis-subhead">
          {l(
            'How often the government side won, per session',
            'Hur ofta regeringssidan vann, per riksmöte',
          )}
        </h3>
        <MultiLineChart
          series={decisionSeries}
          label={l(
            'Government side won, share of decisions',
            'Regeringssidan vann, andel av besluten',
          )}
          format={(v) => percent(v, 0)}
          colorOf={() => 0}
          yFrom={0}
        />
      </section>

      {issue.parties.length > 0 && (
        <section
          className="report welfare-section"
          aria-labelledby="issue-parties"
        >
          <p className="eyebrow">{l('The parties', 'Partierna')}</p>
          <h2 id="issue-parties">
            {l(
              'Under the current government',
              'Under den nuvarande regeringen',
            )}
          </h2>
          <div className="table-scroll">
            <table className="welfare-table compact">
              <thead>
                <tr>
                  <th>{l('Party', 'Parti')}</th>
                  <th>{l('Decisions', 'Beslut')}</th>
                  <th>
                    {l(
                      'Same position as the government',
                      'Samma ståndpunkt som regeringen',
                    )}
                  </th>
                  <th>{l('On the winning side', 'På vinnande sidan')}</th>
                </tr>
              </thead>
              <tbody>
                {PARTY_ORDER.map((party) =>
                  issue.parties.find((p) => p.party === party),
                )
                  .filter(Boolean)
                  .map((p) => (
                    <tr key={p!.party}>
                      <td>{PARTY_NAMES[p!.party] ?? p!.party}</td>
                      <td>{p!.decisions}</td>
                      <td>
                        <span
                          className="cell-bar"
                          style={{ width: `${p!.with_government_pct ?? 0}%` }}
                        />
                        <span className="cell-value">
                          {percent(p!.with_government_pct, 0)}
                        </span>
                      </td>
                      <td>{percent(p!.on_winning_side_pct, 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {issue.budget_outturn_msek.length > 0 && (
        <section
          className="report welfare-section"
          aria-labelledby="issue-budget"
        >
          <p className="eyebrow">{l('Money', 'Pengarna')}</p>
          <h2 id="issue-budget">
            {l('State spending on the issue', 'Statens utgifter på området')}
          </h2>
          <MultiLineChart
            series={budgetSeries}
            label={l('Budget outturn', 'Budgetutfall')}
            format={(v) => `${number(v, 0)} mdr`}
            colorOf={() => 0}
          />
          <p className="welfare-note">
            {l(
              `Outturn of expenditure areas ${issue.expenditure_areas.join(', ')} (Statskontoret), current prices.`,
              `Utfall för utgiftsområde ${issue.expenditure_areas.join(', ')} (Statskontoret), löpande priser.`,
            )}{' '}
            <a href="#budget-outturn">
              {l('Budget in depth →', 'Budgeten i detalj →')}
            </a>
          </p>
        </section>
      )}

      {issue.welfare.length > 0 && (
        <section
          className="report welfare-section"
          aria-labelledby="issue-welfare"
        >
          <p className="eyebrow">{l('How it is going', 'Hur det går')}</p>
          <h2 id="issue-welfare">
            {l('What the statistics show', 'Vad statistiken visar')}
          </h2>
          {issue.welfare.map((w) => (
            <div key={w.indicator_key} className="issue-indicator">
              <h3 className="analysis-subhead">{w.indicator_name}</h3>
              <MultiLineChart
                series={[
                  {
                    key: w.indicator_key,
                    name: w.indicator_name,
                    points: w.series.map((row) => ({
                      date: `${row.year}-07-01`,
                      label: String(row.year),
                      value: row.value,
                    })),
                  },
                ]}
                label={w.indicator_name}
                format={(v) =>
                  w.unit?.startsWith('procent')
                    ? percent(v, 1)
                    : number(v, v < 100 ? 1 : 0)
                }
                colorOf={() => 0}
              />
            </div>
          ))}
          <p className="welfare-note">
            {l(
              'Sweden as a whole, annual. Read side by side with the decisions, not as their effect: many things move these figures.',
              'Hela riket, per år. Läs dem bredvid besluten, inte som deras effekt: många saker påverkar siffrorna.',
            )}{' '}
            <a href="#sweden">
              {l('All welfare data →', 'All välfärdsdata →')}
            </a>
          </p>
        </section>
      )}

      {speechTotals.length > 0 && (
        <section
          className="report welfare-section"
          aria-labelledby="issue-debate"
        >
          <p className="eyebrow">{l('The debate', 'Debatten')}</p>
          <h2 id="issue-debate">
            {l('Who speaks in the debates', 'Vem som talar i debatterna')} ·{' '}
            {recentSessions[0]}–{recentSessions.at(-1)}
          </h2>
          <ul className="speech-bars">
            {speechTotals.map((row) => (
              <li key={row.party}>
                <span className="speech-party">{partyLabel(row.party)}</span>
                <span
                  className="speech-bar"
                  style={{ width: `${(row.speeches / speechMax) * 100}%` }}
                />
                <span className="speech-count">{row.speeches}</span>
              </li>
            ))}
          </ul>
          <p className="welfare-note">
            {l(
              `Speeches in debates on the issue’s committee reports. About ${Math.round(issues.speech_link_coverage * 100)} % of issue-debate speeches can be linked to a report by title; the rest are not counted here.`,
              `Tal i debatter om frågans betänkanden. Omkring ${Math.round(issues.speech_link_coverage * 100)} % av talen i sakdebatter kan kopplas till ett betänkande via rubriken; övriga räknas inte här.`,
            )}{' '}
            <a href="#debates">{l('Read the speeches →', 'Läs talen →')}</a>
          </p>
        </section>
      )}
    </div>
  )
}
