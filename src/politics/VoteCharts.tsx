import { l, t } from '../i18n'
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
        <p className="eyebrow">{t("01 / Recorded positions")}</p>
        <h4>{t("How do parties vote?")}</h4>
        <p>
          {t("The most common cast vote in each party, per roll call. Yes means\n          support for the committee proposal, which may itself reject a bill.\n        ")}</p>
        <div className="vote-key">
          <span>{t("● Yes")}</span>
          <span>{t("● No")}</span>
          <span>{t("● Abstain")}</span>
        </div>
        {stats.map((s) => (
          <button
            className="vote-stack-row"
            key={s.party}
            onClick={() => onParty(s.party)}
            aria-label={l(`${s.party}: ${s.yes} yes, ${s.no} no, ${s.abstain} abstain, ${s.rows} roll calls`, `${s.party}: ${s.yes} ja, ${s.no} nej, ${s.abstain} avstod, ${s.rows} voteringar`)}
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
          {t("Unclassified or tied positions remain outside the three coloured\n          categories. Select a party to inspect decisions.\n        ")}</small>
      </section>
      <section className="politics-card">
        <p className="eyebrow">{t("02 / Voting together")}</p>
        <h4>{t("Where do parties agree?")}</h4>
        <p>
          {t("Same yes/no position divided by roll calls where both parties have a\n          yes/no position. Abstentions are excluded; this is not ideological\n          distance.\n        ")}</p>
        <div
          className="agreement-scroll"
          tabIndex={0}
          aria-label={t("Party agreement matrix")}
        >
          <table className="agreement-matrix">
            <caption>
              {t("Agreement percentage · select a cell to see the denominator\n            ")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("Party")}</th>
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
                            aria-label={l(`${a} and ${b}: ${pct == null ? 'unavailable' : pct.toFixed(0) + '%'}, ${paired.length} comparable roll calls`, `${a} och ${b}: ${pct == null ? 'saknas' : pct.toFixed(0) + '%'}, ${paired.length} jämförbara voteringar`)}
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
    </div>
  )
}
