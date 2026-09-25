import { currentLocale, l, t } from './i18n'
type Row = {
  session: string
  actor: string
  expenditure_area: number
  amount_msek: number
  deviation_msek: number
  source_url: string
}
const parties = ['C', 'KD', 'L', 'M', 'MP', 'S', 'SD', 'V']
const money = (n: number) =>
  `${n < 0 ? '−' : n > 0 ? '+' : ''}${(Math.abs(n) / 1000).toLocaleString(currentLocale() === 'sv' ? 'sv-SE' : 'en-GB', { maximumFractionDigits: 2 })} ${currentLocale() === 'sv' ? 'mdkr' : 'bn SEK'}`
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
  const sessionStart = Number(rows[0]?.session.slice(0, 4))
  const governing = sessionStart >= 2022 ? ['M', 'KD', 'L'] : ['S', 'MP']
  const agreement =
    sessionStart >= 2022
      ? ['SD']
      : sessionStart === 2019 || sessionStart === 2020
        ? ['C', 'L']
        : []
  return (
    <section className="budget-overview">
      <p className="eyebrow">{t('The budget in plain numbers')}</p>
      <h4>{t('What would each proposal change?')}</h4>
      <p>
        {t('Government expenditure frames total')}{' '}
        {(gov / 1000).toLocaleString(
          currentLocale() === 'sv' ? 'sv-SE' : 'en-GB',
          { maximumFractionDigits: 1 },
        )}{' '}
        {t(
          "billion SEK. Each card compares a party's proposal with the same year's\n        government proposal—not with last year's spending. These are proposed\n        expenditure frames, not actual spending or the full fiscal balance.\n      ",
        )}
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
                    {t('Net difference ·')}{' '}
                    {(total / 1000).toLocaleString(
                      currentLocale() === 'sv' ? 'sv-SE' : 'en-GB',
                      {
                        maximumFractionDigits: 1,
                      },
                    )}{' '}
                    {t('bn SEK total\n                  ')}
                  </p>
                  <div>
                    <b>{t('Largest increases')}</b>
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
                      <p>{t('No increases in these frames.')}</p>
                    )}
                  </div>
                  <div>
                    <b>{t('Largest reductions')}</b>
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
                      <p>{t('No reductions in these frames.')}</p>
                    )}
                  </div>
                  <a href={own[0].source_url} target="_blank" rel="noreferrer">
                    {t('Read budget table ↗\n                  ')}
                  </a>
                </>
              ) : (
                <p>
                  {governing.includes(p)
                    ? l(
                        'Part of the collective government proposal shown above. No separate amount is assigned to this party.',
                        'Del av regeringens gemensamma förslag ovan. Inget separat belopp tilldelas partiet.',
                      )
                    : agreement.includes(p)
                      ? l(
                          'Party to the budget agreement. No separate complete proposal is imported here; the collective frame is shown only once.',
                          'Part i budgetöverenskommelsen. Inget separat fullständigt förslag är importerat här; den gemensamma ramen visas bara en gång.',
                        )
                      : `${t('No separate complete party proposal in this export. The\n                  collective government frame is not assigned to ')}${p}.`}
                </p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
