/**
 * The market tab's three key figures: new ads in the latest complete week (market-weekly.json),
 * the median days from publication to removal (time-to-close.json) and the technology whose share
 * grew the most among roles with at least KPI_MIN_ROLE_ADS ads in both months (skill-trends.json).
 * A figure whose file or row is missing is not drawn.
 */
import { l } from '../i18n'
import { cap, monthName, num, pct } from './labels'
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
  const change = week?.before
    ? Math.round(((week.week.ads - week.before.ads) / week.before.ads) * 100)
    : null
  const items = [
    week && {
      key: 'week',
      label: l(
        `New ads, week ${week.week.iso_week}`,
        `Nya annonser, vecka ${week.week.iso_week}`,
      ),
      value: num(week.week.ads),
      note: week.before
        ? l(
            `${change! > 0 ? '+' : ''}${pct(change!)} against ${week.before.iso_week} (${num(week.before.ads)})`,
            `${change! > 0 ? '+' : ''}${pct(change!)} mot ${week.before.iso_week} (${num(week.before.ads)})`,
          )
        : l('Week before incomplete', 'Veckan före ofullständig'),
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
      note: l(
        `${num(close.ads)} ads removed, last ${f.closing!.window_days} days`,
        `${num(close.ads)} borttagna annonser, senaste ${f.closing!.window_days} dagarna`,
      ),
    },
    rise && {
      key: 'rise',
      label: l(
        `Largest rise in share: ${rise.skill}, ${rise.role_family}`,
        `Största andelsökning: ${rise.skill}, ${rise.role_family}`,
      ),
      value: l(
        `+${num(rise.share_yoy_pp, 1)} pp`,
        `+${num(rise.share_yoy_pp, 1)} p.e.`,
      ),
      note: l(
        `${cap(monthName(f.skills!.month))}: ${pct(rise.skill_share * 100)} of ${num(rise.total_ads)} ads, from ${pct(rise.previous_year_share * 100)}`,
        `${cap(monthName(f.skills!.month))}: ${pct(rise.skill_share * 100)} av ${num(rise.total_ads)} annonser, från ${pct(rise.previous_year_share * 100)}`,
      ),
    },
  ].filter((k) => !!k)
  if (!items.length) return null
  return (
    <dl className="dk-kpis ja-kpis">
      {items.map((k) => (
        <div key={k.key} className="dk-kpi">
          <dt>{k.label}</dt>
          <dd>
            {k.value}
            <div className="dk-note">{k.note}</div>
          </dd>
        </div>
      ))}
    </dl>
  )
}
