/**
 * The job search hero's picture: new Data/IT job ads per month in Sweden, from the market file
 * the platform publishes (jobs/market.json, JobTech's archives and daily stream). It is the
 * market the job assistant reads; nothing is shown if the file cannot be read.
 */
import { l } from '../i18n'
import type { Market } from '../jobs/market'
import { ago, num, ok, useFile } from '../tech/techData'
import { MiniLine } from './mini/MiniChart'
import { Mini } from './mini/cardsPlatform'

export default function JobsPulse() {
  const market = useFile<Market>('jobs/market.json')
  if (!ok(market)) return null
  const field = market.fields.find((f) => f.name === 'Data/IT')
  const series = field ? market.monthly[field.id] : undefined
  if (!series || series.length < 2) return null
  const points = series.map(([month, ads], i) => ({
    x: i,
    y: ads,
    label: month,
  }))
  const [first] = series[0]
  const [last, lastAds] = series[series.length - 1]
  const peak = series.reduce((a, b) => (b[1] > a[1] ? b : a))
  const preliminary = market.preliminary?.includes(last)
  const ticks = series
    .map(([month], i) => ({ x: i, label: month.slice(0, 4), month }))
    .filter((t) => t.month.endsWith('-01') && Number(t.label) % 2 === 0)
  const head = l(
    `${num(lastAds)} new Data/IT job ads in ${last}, against a peak of ${num(peak[1])} in ${peak[0]}.`,
    `${num(lastAds)} nya Data/IT-annonser i ${last}, mot som mest ${num(peak[1])} i ${peak[0]}.`,
  )
  return (
    <Mini
      head={head}
      caption={l(
        `New Data/IT ads per month in Sweden, ${first} to ${last}${preliminary ? ' (latest month preliminary)' : ''}. jobs/market.json, built ${ago(market.generated_at)}.`,
        `Nya Data/IT-annonser per månad i Sverige, ${first} till ${last}${preliminary ? ' (senaste månaden preliminär)' : ''}. jobs/market.json, byggd för ${ago(market.generated_at)}.`,
      )}
    >
      <MiniLine
        series={[{ id: 'ads', name: 'ads', points }]}
        summary={head}
        format={(v) => `${num(v)} ${l('ads', 'annonser')}`}
        ticks={ticks}
      />
    </Mini>
  )
}
