/**
 * The job search hero's picture: new Data/IT job ads per month in Sweden, from the market file
 * the platform publishes (jobs/market.json, JobTech's archives and daily stream). It is the
 * market the job assistant reads; nothing is shown if the file cannot be read.
 */
import { l } from '../i18n'
import type { Market } from '../jobs/market'
import { ago, num, ok, useFile } from '../tech/techData'
import { Loading, MiniLine } from './mini/MiniChart'
import { Mini } from './mini/cardsPlatform'

export default function JobsPulse() {
  const market = useFile<Market>('jobs/market.json')
  if (market === null) return <Loading />
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
  // Ads are seasonal, so the latest month is set against the same month a year earlier.
  const yearAgo = `${Number(last.slice(0, 4)) - 1}${last.slice(4)}`
  const before = series.find(([month]) => month === yearAgo)
  const peak = series.reduce((a, b) => (b[1] > a[1] ? b : a))
  const preliminary = market.preliminary?.includes(last)
  const ticks = series
    .map(([month], i) => ({ x: i, label: month.slice(0, 4), month }))
    .filter((t) => t.month.endsWith('-01') && Number(t.label) % 2 === 0)
  const head = before
    ? l(
        `${num(lastAds)} new Data/IT job ads in ${last}, against ${num(before[1])} in ${yearAgo}.`,
        `${num(lastAds)} nya Data/IT-annonser i ${last}, mot ${num(before[1])} i ${yearAgo}.`,
      )
    : l(
        `${num(lastAds)} new Data/IT job ads in ${last}.`,
        `${num(lastAds)} nya Data/IT-annonser i ${last}.`,
      )
  return (
    <Mini
      head={head}
      caption={l(
        `New Data/IT ads per month in Sweden, ${first} to ${last}${preliminary ? ' (latest month preliminary)' : ''}; grey dot: the highest month. jobs/market.json, built ${ago(market.generated_at)}.`,
        `Nya Data/IT-annonser per månad i Sverige, ${first} till ${last}${preliminary ? ' (senaste månaden preliminär)' : ''}; grå punkt: högsta månaden. jobs/market.json, byggd för ${ago(market.generated_at)}.`,
      )}
    >
      <MiniLine
        series={[{ id: 'ads', name: 'ads', points }]}
        summary={head}
        format={(v) => `${num(v)} ${l('ads', 'annonser')}`}
        ticks={ticks}
        mark={{
          index: series.indexOf(peak),
          label: `${peak[0]} · ${num(peak[1])}`,
        }}
      />
    </Mini>
  )
}
