import { PARTIES, partyStats, type Decision } from './data'

export default function VoteCharts({
  decisions,
  onParty,
}: {
  decisions: Decision[]
  onParty: (party: string) => void
}) {
  const stats = PARTIES.map((party) => ({
    party,
    ...partyStats(decisions, party),
  }))
  return (
    <div className="politics-grid">
      <section className="politics-card">
        <p className="eyebrow">01 / Recorded positions</p>
        <h4>How do parties vote?</h4>
        <p>
          The most common cast vote in each party, per roll call. Yes means
          support for the committee proposal, which may itself reject a bill.
        </p>
        <div className="vote-key">
          <span>● Yes</span>
          <span>● No</span>
          <span>● Abstain</span>
        </div>
        {stats.map((s) => (
          <button
            className="vote-stack-row"
            key={s.party}
            onClick={() => onParty(s.party)}
            aria-label={`${s.party}: ${s.yes} yes, ${s.no} no, ${s.abstain} abstain, ${s.rows} roll calls`}
          >
            <b>{s.party}</b>
            <span className="vote-stack">
              <i style={{ width: `${s.rows ? (s.yes / s.rows) * 100 : 0}%` }} />
              <i style={{ width: `${s.rows ? (s.no / s.rows) * 100 : 0}%` }} />
              <i
                style={{ width: `${s.rows ? (s.abstain / s.rows) * 100 : 0}%` }}
              />
            </span>
            <span>
              {s.yes} / {s.no} / {s.abstain}
            </span>
          </button>
        ))}
        <small>
          Unclassified or tied positions remain outside the three coloured
          categories. Select a party to inspect decisions.
        </small>
      </section>
      <section className="politics-card">
        <p className="eyebrow">02 / Voting together</p>
        <h4>Where do parties agree?</h4>
        <p>
          Same yes/no position divided by roll calls where both parties have a
          yes/no position. Abstentions are excluded; this is not ideological
          distance.
        </p>
        <div
          className="agreement-scroll"
          tabIndex={0}
          aria-label="Party agreement matrix"
        >
          <table className="agreement-matrix">
            <caption>
              Agreement percentage · select a cell to see the denominator
            </caption>
            <thead>
              <tr>
                <th scope="col">Party</th>
                {PARTIES.map((p) => (
                  <th scope="col" key={p}>
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PARTIES.map((a) => (
                <tr key={a}>
                  <th scope="row">{a}</th>
                  {PARTIES.map((b) => {
                    const paired = decisions
                      .map((d) => [
                        d.parties.find((p) => p.party === a)?.party_position,
                        d.parties.find((p) => p.party === b)?.party_position,
                      ])
                      .filter((p) => p.every((v) => v === 'Ja' || v === 'Nej'))
                    const same = paired.filter((p) => p[0] === p[1]).length
                    const pct = paired.length
                      ? (same / paired.length) * 100
                      : null
                    return (
                      <td
                        key={b}
                        style={{
                          background: `rgba(0,104,100,${pct == null ? 0 : (pct / 100) * 0.45})`,
                        }}
                      >
                        <details>
                          <summary
                            aria-label={`${a} and ${b}: ${pct == null ? 'unavailable' : pct.toFixed(0) + '%'}, ${paired.length} comparable roll calls`}
                          >
                            {pct == null ? '—' : pct.toFixed(0)}
                          </summary>
                          <span>
                            {same}/{paired.length}
                          </span>
                        </details>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="politics-card">
        <p className="eyebrow">03 / Internal agreement</p>
        <h4>How unified are the recorded votes?</h4>
        <p>
          Sum of each roll call's largest party vote group ÷ all cast party
          votes. Attendance is cast votes ÷ cast plus recorded absences; pairing
          arrangements are not known.
        </p>
        {stats.map((s) => (
          <div className="cohesion-row" key={s.party}>
            <b>{s.party}</b>
            <span className="metric-track">
              <i style={{ width: `${s.cohesion ?? 0}%` }} />
            </span>
            <span>{s.cohesion?.toFixed(1) ?? '—'}% cohesion</span>
            <span>{s.attendance?.toFixed(1) ?? '—'}% attendance</span>
          </div>
        ))}
      </section>
    </div>
  )
}
