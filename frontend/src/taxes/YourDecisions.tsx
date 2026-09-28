import { useMemo } from 'react'
import { l } from '../i18n'
import MultiLineChart from '../charts/MultiLineChart'
import type { TaxInput } from './calculator'
import { changesByYear, taxByYear, YEARS } from './history'
import type { Decisions } from './Decisions'

const kr = (value: number) => `${Math.round(value).toLocaleString('sv-SE')} kr`
const signedKr = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(Math.round(value)).toLocaleString('sv-SE')} kr`

/**
 * Your tax under every year's rules, and what each year's decisions did to it: the same
 * person, the same age and the same real income, the change split by the part of the rules
 * that changed and tied to the decisions that changed it.
 */
export default function YourDecisions({
  input,
  decisions,
}: {
  input: TaxInput
  decisions: Decisions
}) {
  const byYear = useMemo(() => taxByYear(input), [input])
  const changes = useMemo(() => changesByYear(input), [input])
  const first = byYear[0]
  const last = byYear.at(-1)!
  const difference = last.taxToday - first.taxToday

  if (last.income <= 0)
    return (
      <p className="welfare-note">
        {l(
          'Enter an income above to see how the decisions since 2006 changed your tax.',
          'Fyll i en inkomst ovan för att se hur besluten sedan 2006 har ändrat din skatt.',
        )}
      </p>
    )

  return (
    <div className="your-decisions" data-testid="your-decisions">
      <p className="lead-figure">
        {l(
          `With ${first.year}'s rules you would pay ${kr(first.taxToday)} a year; with ${last.year}'s, ${kr(last.taxToday)}: ${kr(Math.abs(difference))} ${difference < 0 ? 'less' : 'more'}.`,
          `Med ${first.year} års regler hade du betalat ${kr(first.taxToday)} om året; med ${last.year} års ${kr(last.taxToday)}: ${kr(Math.abs(difference))} ${difference < 0 ? 'mindre' : 'mer'}.`,
        )}
      </p>
      <MultiLineChart
        series={[
          {
            key: 'tax',
            name: l(
              'Your tax, in today’s kronor',
              'Din skatt, i dagens kronor',
            ),
            points: byYear.map((y) => ({
              date: `${y.year}-07-01`,
              label: `${y.year}: ${kr(y.taxToday)} (${y.averageRate.toFixed(1)} %)`,
              value: y.taxToday,
            })),
          },
        ]}
        label={l(
          'Your tax under each year’s rules',
          'Din skatt med varje års regler',
        )}
        format={(v) =>
          `${(v / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} ${l('k kr', 'tkr')}`
        }
        colorOf={() => 0}
      />
      <table className="welfare-table tax-changes" data-testid="tax-changes">
        <thead>
          <tr>
            <th>{l('Year', 'År')}</th>
            <th>{l('Change for you', 'Ändring för dig')}</th>
            <th>{l('Because of', 'På grund av')}</th>
          </tr>
        </thead>
        <tbody>
          {[...changes].reverse().map((change) => (
            <tr key={change.year}>
              <td>{change.year}</td>
              <td
                className={
                  change.total < 0 ? 'lower' : change.total > 0 ? 'higher' : ''
                }
              >
                {Math.abs(change.total) < 1
                  ? l('no change', 'ingen ändring')
                  : signedKr(change.total)}
              </td>
              <td>
                {change.parts.length === 0 && Math.abs(change.total) < 1 && (
                  <span className="muted">
                    {l(
                      'The rules only followed prices.',
                      'Reglerna följde bara prisutvecklingen.',
                    )}
                  </span>
                )}
                <ul className="change-parts">
                  {change.parts
                    .filter(
                      (p) =>
                        Math.abs(p.change) >= 200 ||
                        decisions.decisions.some(
                          (d) =>
                            d.year === change.year &&
                            d.components.includes(p.part),
                        ),
                    )
                    .map((p) => {
                      const made = decisions.decisions.filter(
                        (d) =>
                          d.year === change.year &&
                          d.components.includes(p.part),
                      )
                      return (
                        <li key={p.part}>
                          <strong>
                            {l(
                              ...(decisions.components[p.part] ?? [
                                p.part,
                                p.part,
                              ]),
                            )}
                          </strong>{' '}
                          {signedKr(p.change)}
                          {made.length > 0 ? (
                            <>
                              {': '}
                              {made
                                .map(
                                  (d) =>
                                    `${l(d.title_en, d.title_sv)} (${d.bill ? `${l('bill', 'prop.')} ${d.bill}` : d.report})`,
                                )
                                .join('; ')}
                            </>
                          ) : (
                            <span className="muted">
                              {' '}
                              {p.part === 'temporary_work_reduction' &&
                              p.change > 0
                                ? l(
                                    '– the temporary reduction ended, as decided when it began',
                                    '– den tillfälliga reduktionen upphörde, som beslutat när den infördes',
                                  )
                                : l(
                                    '– amounts moved differently from prices, without a new decision that year',
                                    '– beloppen följde inte prisutvecklingen, utan nytt beslut det året',
                                  )}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  {(() => {
                    // Small moves without a decision, and what the parts leave, in one line.
                    const small =
                      change.rest +
                      change.parts
                        .filter(
                          (p) =>
                            Math.abs(p.change) < 200 &&
                            !decisions.decisions.some(
                              (d) =>
                                d.year === change.year &&
                                d.components.includes(p.part),
                            ),
                        )
                        .reduce((sum, p) => sum + p.change, 0)
                    return Math.abs(small) >= 1 ? (
                      <li className="muted">
                        {l(
                          'Small adjustments of amounts, interaction and rounding',
                          'Små justeringar av belopp, samspel och avrundning',
                        )}{' '}
                        {signedKr(small)}
                      </li>
                    ) : null
                  })()}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="welfare-note">
        {l(
          `The same person in every year from ${YEARS[0]}: the same age and the same real income, moved with the price base amount, and your municipal tax rate. A year's change is the tax with that year's rules less the tax with last year's rules moved as the law moves them without a decision (prices; the state tax threshold prices plus two points, approximated with the price base amount). Each part is then put back as it was to see what it did. Tax on work, pensions, benefits and capital; VAT, fuel and employer contributions are below.`,
          `Samma person varje år från ${YEARS[0]}: samma ålder och samma reala inkomst, uppräknad med prisbasbeloppet, och din kommunalskatt. Ett års ändring är skatten med årets regler minus skatten med förra årets regler uppräknade som lagen gör utan beslut (priserna; skiktgränsen priserna plus två procentenheter, approximerat med prisbasbeloppet). Varje del sätts sedan tillbaka som den var för att se vad den gjorde. Skatt på arbete, pension, ersättningar och kapital; moms, drivmedel och arbetsgivaravgifter finns nedan.`,
        )}
      </p>
    </div>
  )
}
