/**
 * The job search hero's picture: new Data/IT job ads per month in Sweden, from the market file
 * the platform publishes (jobs/market.json, JobTech's archives and daily stream). It is the
 * market the job assistant reads, drawn small; nothing is shown if the file cannot be read.
 */
import { l } from '../i18n'
import type { Market } from '../jobs/market'
import { ago, num, ok, useFile } from '../tech/techData'

const W = 560
const H = 168
const PAD = { top: 12, right: 12, bottom: 24, left: 8 }

export default function JobsPulse() {
  const market = useFile<Market>('jobs/market.json')
  if (!ok(market)) return null
  const field = market.fields.find((f) => f.name === 'Data/IT')
  const series = field ? market.monthly[field.id] : undefined
  if (!series || series.length < 2) return null
  const max = Math.max(...series.map(([, ads]) => ads))
  const x = (i: number) =>
    PAD.left + (i / (series.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom)
  const line = series
    .map(
      ([, ads], i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(ads).toFixed(1)}`,
    )
    .join('')
  const area = `${line}L${x(series.length - 1).toFixed(1)},${H - PAD.bottom}L${x(0).toFixed(1)},${H - PAD.bottom}Z`
  const [first] = series[0]
  const [last, lastAds] = series[series.length - 1]
  const peak = series.reduce((a, b) => (b[1] > a[1] ? b : a))
  const preliminary = market.preliminary?.includes(last)
  const years = series
    .map(([month], i) => [month, i] as const)
    .filter(([month]) => month.endsWith('-01'))
  return (
    <figure className="hub-pulse">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby="hub-pulse-title hub-pulse-desc"
      >
        <title id="hub-pulse-title">
          {l(
            'New Data/IT job ads per month in Sweden',
            'Nya Data/IT-annonser per månad i Sverige',
          )}
        </title>
        <desc id="hub-pulse-desc">
          {l(
            `From ${first} to ${last}: highest in ${peak[0]} with ${num(peak[1])} ads, ${num(lastAds)} in ${last}.`,
            `Från ${first} till ${last}: flest i ${peak[0]} med ${num(peak[1])} annonser, ${num(lastAds)} i ${last}.`,
          )}
        </desc>
        <path className="hub-pulse-area" d={area} />
        <path className="hub-pulse-line" d={line} />
        <circle
          className="hub-pulse-now"
          cx={x(series.length - 1)}
          cy={y(lastAds)}
          r="4"
        />
        {years.map(([month, i]) => (
          <text
            key={month}
            className="hub-pulse-year"
            data-odd={Number(month.slice(0, 4)) % 2 === 1 || undefined}
            x={x(i)}
            y={H - 6}
          >
            {month.slice(0, 4)}
          </text>
        ))}
      </svg>
      <figcaption>
        {l(
          `New Data/IT ads per month, ${first} to ${last}${preliminary ? ' (latest month preliminary)' : ''}; ${num(lastAds)} in ${last}, peak ${num(peak[1])} in ${peak[0]}. jobs/market.json, built ${ago(market.generated_at)}.`,
          `Nya Data/IT-annonser per månad, ${first} till ${last}${preliminary ? ' (senaste månaden preliminär)' : ''}; ${num(lastAds)} i ${last}, som mest ${num(peak[1])} i ${peak[0]}. jobs/market.json, byggd för ${ago(market.generated_at)}.`,
        )}
      </figcaption>
    </figure>
  )
}
