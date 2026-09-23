type Row = {
  actor: string
  expenditure_area: number
  amount_msek: number
  deviation_msek: number
  source_url: string
}
const parties = ['C', 'KD', 'L', 'M', 'MP', 'S', 'SD', 'V']
const money = (n: number) =>
  `${n < 0 ? '−' : n > 0 ? '+' : ''}${(Math.abs(n) / 1000).toLocaleString('en-GB', { maximumFractionDigits: 2 })} bn SEK`
export default function BudgetOverview({
  rows,
  nameOf,
  select,
}: {
  rows: Row[]
  nameOf: (n: number) => string
  select: (party: string, area: number) => void
}) {
  const gov = rows
    .filter((r) => r.actor === 'GOV')
    .reduce((n, r) => n + r.amount_msek, 0)
  return (
    <section className="budget-overview">
      <p className="eyebrow">The budget in plain numbers</p>
      <h4>What would each proposal change?</h4>
      <p>
        Government expenditure frames total{' '}
        {(gov / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })}{' '}
        billion SEK. Each card compares a party's proposal with the same year's
        government proposal—not with last year's spending. These are proposed
        expenditure frames, not actual spending or the full fiscal balance.
      </p>
      <div className="budget-overview-grid">
        {parties.map((p) => {
          const own = rows.filter((r) => r.actor === p)
          const total = own.reduce((n, r) => n + r.amount_msek, 0)
          const delta = own.reduce((n, r) => n + r.deviation_msek, 0)
          const up = [...own]
            .filter((r) => r.deviation_msek > 0)
            .sort((a, b) => b.deviation_msek - a.deviation_msek)
            .slice(0, 2)
          const down = [...own]
            .filter((r) => r.deviation_msek < 0)
            .sort((a, b) => a.deviation_msek - b.deviation_msek)
            .slice(0, 2)
          return (
            <article key={p}>
              <h5>{p}</h5>
              {own.length === 27 ? (
                <>
                  <strong className="budget-net">{money(delta)}</strong>
                  <p>
                    Net difference ·{' '}
                    {(total / 1000).toLocaleString('en-GB', {
                      maximumFractionDigits: 1,
                    })}{' '}
                    bn SEK total
                  </p>
                  <div>
                    <b>Largest increases</b>
                    {up.length ? (
                      up.map((r) => (
                        <button
                          key={r.expenditure_area}
                          onClick={() => select(p, r.expenditure_area)}
                        >
                          <span>{nameOf(r.expenditure_area)}</span>
                          <strong>{money(r.deviation_msek)}</strong>
                        </button>
                      ))
                    ) : (
                      <p>No increases in these frames.</p>
                    )}
                  </div>
                  <div>
                    <b>Largest reductions</b>
                    {down.length ? (
                      down.map((r) => (
                        <button
                          key={r.expenditure_area}
                          onClick={() => select(p, r.expenditure_area)}
                        >
                          <span>{nameOf(r.expenditure_area)}</span>
                          <strong>{money(r.deviation_msek)}</strong>
                        </button>
                      ))
                    ) : (
                      <p>No reductions in these frames.</p>
                    )}
                  </div>
                  <a href={own[0].source_url} target="_blank" rel="noreferrer">
                    Read budget table ↗
                  </a>
                </>
              ) : (
                <p>
                  No separate complete party proposal in this export. The
                  collective government frame is not assigned to {p}.
                </p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
