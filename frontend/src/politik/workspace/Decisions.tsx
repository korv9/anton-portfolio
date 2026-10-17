import type { Route } from '../../router'
import { Feature } from '../../charts/feature/Feature'
import { useViewParams } from '../useViewParams'
import { useParties } from '../partySelection'
import { Select, num, dayName } from '../controls'
import { PartyTag } from '../../parties/identity'
import { DataState } from './Workspace'
import { useDataset, type RollCall, type Workspace } from './data'
import { CONTEXT_DEFAULTS, inContext, workspaceHref } from './logic'
import type { IssueDebate } from '../debatter/data'

const defaults = { ...CONTEXT_DEFAULTS, rost: '', sok: '', visade: '20' }
export default function DecisionExplorer({
  route,
  data,
}: {
  route: Route
  data: Workspace
}) {
  const [view, set] = useViewParams(route, defaults)
  const { selected } = useParties(route)
  const validSessions = data.sessions.filter((s) =>
    data.decision_coverage.some(
      (c) => c.session === s.session && inContext(c, { ...view, riksmote: '' }),
    ),
  )
  const session = validSessions.some((s) => s.session === view.riksmote)
    ? view.riksmote
    : validSessions.at(-1)?.session
  const { data: votes, error } = useDataset<RollCall[]>(
    session
      ? `parliament/workspace/decisions/${session.replace('/', '-')}.json`
      : null,
  )
  const { data: debates } = useDataset<{ debates: IssueDebate[] }>(
    session
      ? `politics/parliament/debate-stats/${session.replace('/', '-')}.json`
      : null,
  )
  const query = view.sok.trim().toLocaleLowerCase()
  const rows = (votes ?? [])
    .filter(
      (v) =>
        inContext(v, view) &&
        (!query ||
          `${v.title} ${v.designation} ${v.roll_call_id}`
            .toLocaleLowerCase()
            .includes(query)),
    )
    .sort(
      (a, b) =>
        b.vote_date.localeCompare(a.vote_date) ||
        a.roll_call_id.localeCompare(b.roll_call_id),
    )
  const active = rows.find((v) => v.roll_call_id === view.rost)
  const limit = Math.max(20, Math.min(500, Number(view.visade) || 20))
  const related = active
    ? (debates?.debates ?? []).filter((d) =>
        d.decision?.points.some((p) => p.id === active.roll_call_id),
      )
    : []
  return (
    <Feature
      id="decision-explorer"
      title="What did Parliament decide?"
      lead={`${num(rows.length)} substantive roll calls in ${session ?? 'this context'}. Search and select a decision to inspect its evidence.`}
      controls={
        <>
          <Select
            label="Decision session"
            value={session ?? ''}
            options={[...validSessions]
              .reverse()
              .map((s) => ({ value: s.session, label: s.session }))}
            onChange={(riksmote) => set({ riksmote, rost: '', visade: '20' })}
          />
          <label className="theme-select">
            <span>Search decisions</span>
            <input
              type="search"
              name="decision-search"
              autoComplete="off"
              value={view.sok}
              onChange={(e) => set({ sok: e.target.value, visade: '20' })}
              placeholder="Title, report or vote ID…"
            />
          </label>
        </>
      }
      source={
        <a href="https://data.riksdagen.se/">
          Riksdagen official committee reports and roll calls
        </a>
      }
    >
      {!votes ? (
        <DataState error={error}>
          {session ? 'Loading this session…' : 'No sessions match the period.'}
        </DataState>
      ) : (
        <>
          <div
            className="po-table-scroll"
            tabIndex={0}
            aria-label="Parliamentary decision list"
          >
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Committee report and decision point</th>
                  <th>Yes</th>
                  <th>No</th>
                  <th>Abstain</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((v) => (
                  <tr
                    key={v.roll_call_id}
                    className={
                      active?.roll_call_id === v.roll_call_id
                        ? 'is-selected'
                        : ''
                    }
                  >
                    <td>{v.vote_date}</td>
                    <th scope="row">
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() => set({ rost: v.roll_call_id })}
                      >
                        {v.title ?? v.designation}
                        <small>
                          {v.session}:{v.designation} · point {v.point}
                        </small>
                      </button>
                    </th>
                    <td>{v.yes}</td>
                    <td>{v.no}</td>
                    <td>{v.abstain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p>No decisions match the selected context and search.</p>
          )}
          {rows.length > limit && (
            <button
              className="btn-text"
              type="button"
              onClick={() => set({ visade: String(limit + 20) })}
            >
              Show 20 more decisions
            </button>
          )}
        </>
      )}
      {active && (
        <section
          className="po-decision-detail"
          aria-labelledby="decision-detail-title"
        >
          <h3 id="decision-detail-title">
            {active.title ?? active.designation}
          </h3>
          <p>
            {dayName(active.vote_date)} · {active.session}:{active.designation},
            point {active.point}. {active.yes} yes, {active.no} no,{' '}
            {active.abstain} abstain, {active.absent} absent.
          </p>
          <p className="po-note">
            {!active.source_complete && (
              <>The published source totals do not cover all 349 seats. </>
            )}
            Ordinary committee roll call. A “yes” vote concerns this decision
            point; it is not a prime minister appointment rule.
          </p>
          {active.parties ? (
            <div className="po-table-scroll">
              <table>
                <caption>Party votes; selected parties are emphasized</caption>
                <thead>
                  <tr>
                    <th>Party</th>
                    <th>Plurality</th>
                    <th>Yes</th>
                    <th>No</th>
                    <th>Abstain</th>
                    <th>Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {active.parties.map((p) => (
                    <tr
                      key={p.party}
                      className={
                        selected.length && !selected.includes(p.party)
                          ? 'po-dim'
                          : ''
                      }
                    >
                      <th>
                        <PartyTag party={p.party} />
                      </th>
                      <td>{p.position ?? 'Tied / unavailable'}</td>
                      <td>{p.yes}</td>
                      <td>{p.no}</td>
                      <td>{p.abstain}</td>
                      <td>{p.absent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>
              Detailed party counts are not part of this delivered historical
              session. Aggregate totals and the official source remain
              available.
            </p>
          )}
          <nav className="po-related" aria-label="Decision context">
            {active.report_url && (
              <a href={active.report_url} target="_blank" rel="noreferrer">
                Official committee report ↗
              </a>
            )}
            {active.issue_key && (
              <>
                <a
                  href={workspaceHref('#politik-budget', route.params, {
                    omrade: active.issue_key,
                    riksmote: active.session,
                  })}
                >
                  Related expenditure areas →
                </a>
                <a
                  href={workspaceHref('#politik-tal', route.params, {
                    omrade: active.issue_key,
                    riksmote: active.session,
                  })}
                >
                  Debates in this policy area →
                </a>
              </>
            )}
            {active.government_key && (
              <a
                href={workspaceHref('#politik-riksdag', route.params, {
                  regering: active.government_key,
                  riksmote: active.session,
                })}
              >
                Government at the vote date →
              </a>
            )}
          </nav>
          <div className="po-evidence">
            <section>
              <h4>Cited bills</h4>
              {active.links.bills.length ? (
                <ul>
                  {active.links.bills.map((b) => (
                    <li key={b.url}>
                      <a href={b.url}>
                        {b.reference}: {b.title}
                      </a>
                      <small>
                        Document-level explicit citation; not proof of this
                        point’s enactment.
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No bill link is available in this delivered evidence set.</p>
              )}
            </section>
            <section>
              <h4>Studies named in those bills</h4>
              {active.links.studies.length ? (
                <ul>
                  {active.links.studies.map((s) => (
                    <li key={s.url}>
                      <a href={s.url}>
                        {s.designation}
                        {s.title ? `: ${s.title}` : ''}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No study link is available in the delivered recent-bill
                  register.
                </p>
              )}
            </section>
          </div>
          {!!related.length && (
            <section>
              <h4>Debates matched by report title</h4>
              <ul>
                {related.map((d) => (
                  <li key={d.id}>
                    <a
                      href={workspaceHref('#politik-debatt', route.params, {
                        id: d.id,
                        riksmote: session ?? '',
                        typ: 'sak',
                      })}
                    >
                      {d.title} · {d.date}
                    </a>
                    <small>
                      Title-matched candidate connection; inspect the original
                      speech.
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!!active.links.speech_candidates.length && (
            <details>
              <summary>
                Experimental speech candidates (
                {active.links.speech_candidates.length})
              </summary>
              <ul>
                {active.links.speech_candidates.map((s) => (
                  <li key={s.speech_id}>
                    <a href={s.url}>{s.speech_id}</a> · cosine similarity{' '}
                    {num(s.similarity, 3)}. Retrieval candidate; no causal or
                    confirmed procedural relationship.
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      <p className="po-note">
        Party selection highlights available party records; it does not remove
        decisions without published party counts. Source completeness can vary;
        missing counts are not converted to zero.
      </p>
    </Feature>
  )
}
