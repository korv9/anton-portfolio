/**
 * The market tab's three key figures: new ads in the latest complete week (market-weekly.json),
 * the median days from publication to removal (time-to-close.json) and the technology whose share
 * grew the most (skill-trends.json). A figure whose file or row is missing is not drawn.
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
            `${change! > 0 ? '+' : ''}${change} % against week ${week.before.iso_week} (${num(week.before.ads)}). JobStream, preliminary.`,
            `${change! > 0 ? '+' : ''}${change} % mot vecka ${week.before.iso_week} (${num(week.before.ads)}). JobStream, preliminärt.`,
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
        `Over ${num(close.ads)} ads.`,
        `Över ${num(close.ads)} annonser.`,
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
        `${monthName(f.skills!.month)} against a year before: ${num(rise.skill_share * 100)} % of ${num(rise.total_ads)} ads, from ${num(rise.previous_year_share * 100)} %.`,
        `${monthName(f.skills!.month)} mot ett år före: ${num(rise.skill_share * 100)} % av ${num(rise.total_ads)} annonser, från ${num(rise.previous_year_share * 100)} %.`,
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
