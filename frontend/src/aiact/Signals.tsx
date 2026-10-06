/**
 * The AI governance timeline (#ai-act-signals): the Act's milestones, AI in the Riksdag and AI
 * in job ads on one shared time axis, each series in its own panel with its own scale (small
 * multiples; series are never added together or drawn against two scales). It shows when
 * things changed together, which is temporal overlap, not cause.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { loadSignals } from './data'
import type { Signals as SignalsData } from './jobsTypes'
import { yearlyFromMonths } from './logic'
import { Kind } from './shared'
import {
  chartMilestones,
  MilestoneKey,
  sharePct,
  TimePanel,
} from './TimeSeries'
import type { AiActData } from './types'

export function Signals({ data }: { data: AiActData }) {
  const [signals, setSignals] = useState<SignalsData | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    loadSignals()
      .then(setSignals)
      .catch(() => setFailed(true))
  }, [])
  if (failed)
    return (
      <p className="aa-lede">
        {l(
          'The timeline could not be loaded.',
          'Tidslinjen kunde inte laddas.',
        )}
      </p>
    )
  if (!signals) return <p className="aa-muted">{l('Loading…', 'Laddar…')}</p>
  const months = signals.series.flatMap((s) => s.rows.map((r) => r[0]))
  const domain: [string, string] = [
    months.reduce((a, b) => (a < b ? a : b)),
    months.reduce((a, b) => (a > b ? a : b)),
  ]
  const milestones = chartMilestones(data.timeline, domain[1])
  const series = signals.series.map((s) => {
    const points = s.rows.map(([month, numerator, denominator, , rolling]) => ({
      month,
      numerator,
      denominator,
      value: rolling,
    }))
    return { ...s, points, yearly: yearlyFromMonths(points) }
  })
  const years = [
    ...new Set(series.flatMap((s) => s.yearly.map((y) => y.year))),
  ].sort()

  return (
    <div className="aa-signals">
      <p className="aa-lede">
        {l(
          'Three domains on one time axis: the AI Act’s milestones (numbered lines), how often the Riksdag talks about AI and the Act, and how often job ads use the words. Each panel has its own scale, because the levels differ by orders of magnitude; read each for its own shape.',
          'Tre områden på en tidsaxel: AI-förordningens milstolpar (numrerade linjer), hur ofta riksdagen talar om AI och förordningen, och hur ofta jobbannonser använder orden. Varje panel har sin egen skala, eftersom nivåerna skiljer sig med tiopotenser; läs var och en för sin egen form.',
        )}{' '}
        <Kind type="derived" />
      </p>
      <MilestoneKey milestones={milestones} />
      <div className="aa-panels">
        {series.map((s, i) => (
          <div key={s.series_id}>
            <TimePanel
              label={l(s.label_en, s.label_sv)}
              note={l(
                `${s.domain === 'politics' ? 'Riksdag' : 'job ads'}, three-month rolling`,
                `${s.domain === 'politics' ? 'riksdagen' : 'jobbannonser'}, rullande tre månader`,
              )}
              points={s.points}
              domain={domain}
              milestones={milestones}
              numbered={i === 0}
              height={130}
              digits={
                s.series_id.endsWith('_any') || s.series_id === 'riksdag_ai'
                  ? 1
                  : 3
              }
              numeratorWord={l(s.numerator_en, s.numerator_sv)}
              denominatorWord={l(s.denominator_en, s.denominator_sv)}
            />
            <p className="aa-small aa-muted aa-panel-source">
              <a href={`#${s.route}`}>
                {l('How this is counted', 'Hur detta räknas')}
              </a>{' '}
              · <code>gold.{s.source_model}</code>
            </p>
          </div>
        ))}
      </div>
      <p className="aa-caveat">
        {l(
          `${signals.caveat_en} AI rose in public attention for many reasons over these years, above all the launch of generative AI in late 2022, and none of these series can separate the Act's effect from that.`,
          `${signals.caveat_sv} AI fick mer uppmärksamhet av många skäl under de här åren, framför allt när generativ AI lanserades i slutet av 2022, och ingen av serierna kan skilja förordningens effekt från det.`,
        )}
      </p>
      <div
        className="aa-table-wrap"
        tabIndex={0}
        aria-label={l('Per year', 'Per år')}
      >
        <table className="aa-table">
          <caption>
            {l(
              'Per year: share (numerator / denominator, summed over the year), with the count in brackets',
              'Per år: andel (täljare / nämnare, summerat över året), med antalet inom parentes',
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Series', 'Serie')}</th>
              {years.map((y) => (
                <th scope="col" key={y}>
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.series_id}>
                <th scope="row">{l(s.label_en, s.label_sv)}</th>
                {years.map((y) => {
                  const r = s.yearly.find((x) => x.year === y)
                  return (
                    <td
                      key={y}
                      title={r ? `${r.numerator}/${r.denominator}` : undefined}
                    >
                      {r ? (
                        <>
                          {sharePct(r.share, 3)}{' '}
                          <small className="aa-muted">
                            ({r.numerator.toLocaleString(l('en-GB', 'sv-SE'))})
                          </small>
                        </>
                      ) : (
                        '–'
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
