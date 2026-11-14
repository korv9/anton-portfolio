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
        `New ads in the whole market, week ${week.week.iso_week}`,
        `Nya annonser på hela marknaden, vecka ${week.week.iso_week}`,
      ),
      value: num(week.week.ads),
      note: week.before
        ? l(
            `${change! > 0 ? '+' : ''}${pct(change!)} against week ${week.before.iso_week} (${num(week.before.ads)}). JobStream, preliminary.`,
            `${change! > 0 ? '+' : ''}${pct(change!)} mot vecka ${week.before.iso_week} (${num(week.before.ads)}). JobStream, preliminärt.`,
          )
        : l(
            'The week before is incomplete, so it is not compared.',
            'Veckan före är ofullständig, så den jämförs inte.',
          ),
    },
    close && {
      key: 'close',
      label: l(
        `Median days from publication to removal, Data/IT ads removed in the last ${f.closing!.window_days} days`,
        `Mediandagar från publicering till borttagning, Data/IT-annonser borttagna de senaste ${f.closing!.window_days} dagarna`,
      ),
      value: l(
        `${num(close.median_days_open!, 1)} days`,
        `${num(close.median_days_open!, 1)} dagar`,
      ),
      note: l(
        `Of ${num(close.ads)} ads. Counting only removals in the last ${f.closing!.window_days} days gives long-running ads more weight than a full cohort would.`,
        `Av ${num(close.ads)} annonser. Att bara räkna borttagningar de senaste ${f.closing!.window_days} dagarna ger annonser som legat länge större vikt än en hel årgång skulle.`,
      ),
    },
    rise && {
      key: 'rise',
      label: l(
        `Largest rise in a technology's share: ${rise.skill}, ${rise.role_family} ads`,
        `Största ökningen av en tekniks andel: ${rise.skill}, ${rise.role_family}-annonser`,
      ),
      value: l(
        `+${num(rise.share_yoy_pp, 1)} pp`,
        `+${num(rise.share_yoy_pp, 1)} p.e.`,
      ),
      note: l(
        `${cap(monthName(f.skills!.month))} against a year before: ${num(rise.ads_with_skill)} of ${num(rise.total_ads)} ads (${pct(rise.skill_share * 100)}), from ${num(rise.previous_year_skill_ads)} of ${num(rise.previous_year_total_ads)} (${pct(rise.previous_year_share * 100)}).`,
        `${cap(monthName(f.skills!.month))} mot ett år före: ${num(rise.ads_with_skill)} av ${num(rise.total_ads)} annonser (${pct(rise.skill_share * 100)}), från ${num(rise.previous_year_skill_ads)} av ${num(rise.previous_year_total_ads)} (${pct(rise.previous_year_share * 100)}).`,
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
