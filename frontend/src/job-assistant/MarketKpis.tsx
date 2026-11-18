/**
 * The market tab's three key figures: new ads in the latest complete week (market-weekly.json),
 * the median days from publication to removal (time-to-close.json) and the technology whose share
 * grew the most among roles with at least KPI_MIN_ROLE_ADS ads in both months (skill-trends.json).
 * A figure whose file or row is missing is not drawn.
 */
import { l } from '../i18n'
import { monthName, num } from './labels'
import {
  latestWeek,
  medianClose,
  topRise,
  type MarketFiles,
} from './market-figures'

/** Exactly three figures, each drawn only when its file gives it. */
export default function Kpis({ f }: { f: MarketFiles }) {
  const week = latestWeek(f.weekly)
  const close = medianClose(f.closing)
  const rise = topRise(f.skills)
  const items = [
    week && {
      key: 'week',
      label: l(
        `New ads, week ${week.week.iso_week}`,
        `Nya annonser, vecka ${week.week.iso_week}`,
      ),
      value: num(week.week.ads),
    },
    close && {
      key: 'close',
      label: l(
        'Median days to removal, Data/IT',
        'Mediandagar till borttagning, Data/IT',
      ),
      value: l(
        `${num(close.median_days_open!, 1)} days`,
        `${num(close.median_days_open!, 1)} dagar`,
      ),
    },
    rise && {
      key: 'rise',
      label: l(
        `Largest rise in share, ${monthName(f.skills!.month)}: ${rise.skill}, ${rise.role_family}`,
        `Största andelsökning, ${monthName(f.skills!.month)}: ${rise.skill}, ${rise.role_family}`,
      ),
      value: l(
        `+${num(rise.share_yoy_pp, 1)} pp`,
        `+${num(rise.share_yoy_pp, 1)} p.e.`,
      ),
    },
  ].filter((k) => !!k)
  if (!items.length) return null
  return (
    <dl className="dk-kpis ja-kpis">
      {items.map((k) => (
        <div key={k.key} className="dk-kpi">
          <dt>{k.label}</dt>
          <dd>{k.value}</dd>
        </div>
      ))}
    </dl>
  )
}
