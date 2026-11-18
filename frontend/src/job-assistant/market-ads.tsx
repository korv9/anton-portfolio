/**
 * The market chart's line: new ads per week, month or year for one selection, the whole market,
 * one occupation field (jobs/market*.json) or one Data/IT role (jobs/ads-*.json). One slicer
 * holds all three, so the chart always draws one series on one scale.
 */
import { l } from '../i18n'
import { Pick } from '../charts/feature/Feature'
import MultiLineChart from '../charts/MultiLineChart'
import { SlicerSelect } from '../ui/dash/Dash'
import { num } from './labels'
import {
  PERIODS,
  fieldIds,
  fieldSeries,
  gaps,
  roleSeries,
  type MarketFiles,
  type Period,
} from './market-figures'
import type { MarketView, SetView, Spec } from './Market'

const PERIOD_NAMES: Record<Period, [string, string]> = {
  week: ['Week', 'Vecka'],
  month: ['Month', 'Månad'],
  year: ['Year', 'År'],
}
const ROLE = 'role:'

const few = (labels: string[], n = 3) =>
  labels.slice(0, n).join(', ') +
  (labels.length > n
    ? l(` and ${labels.length - n} more`, ` och ${labels.length - n} till`)
    : '')

export function adsSpec(
  f: MarketFiles,
  view: MarketView,
  set: SetView,
): Spec | null {
  const periods = PERIODS.filter((p) => fieldIds(f, p).length || f[p])
  if (!periods.length) return null
  const period = periods.find((p) => p === view.period) ?? periods[0]
  const fieldName = (id: string) =>
    id === 'all'
      ? l('Whole market', 'Hela marknaden')
      : (f.market?.fields.find((x) => x.id === id)?.name ?? id)
  const roleFile = f[period]
  const roles = [...new Set((roleFile?.rows ?? []).map((r) => r.role_family))]
  const options = [
    ...fieldIds(f, period)
      .map((id) => ({ value: id, label: fieldName(id) }))
      .sort(
        (a, b) =>
          Number(b.value === 'all') - Number(a.value === 'all') ||
          a.label.localeCompare(b.label, 'sv'),
      ),
    ...roles.map((r) => ({
      value: ROLE + r,
      label:
        r === 'all'
          ? l('Data/IT: all roles', 'Data/IT: alla roller')
          : `Data/IT: ${r}`,
    })),
  ]
  const series = options.some((o) => o.value === view.field)
    ? view.field
    : 'all'
  const role = series.startsWith(ROLE)
  const name = options.find((o) => o.value === series)?.label ?? series
  const points = role
    ? roleSeries(roleFile, series.slice(ROLE.length))
    : fieldSeries(f, period, series)
  // Incomplete and absent periods are left off the line, and the line breaks where one was.
  const absent = gaps(points, period)
  const shown = points.flatMap((p, i) =>
    p.complete
      ? [
          {
            date: p.start,
            label: p.label,
            value: p.ads,
            breakBefore:
              (i > 0 && !points[i - 1].complete) || absent.after.has(i),
          },
        ]
      : [],
  )
  const left = points.filter((p) => !p.complete).map((p) => p.label)
  const per = l(...PERIOD_NAMES[period]).toLocaleLowerCase()
  const title = l(
    `New ads per ${per}: ${name}`,
    `Nya annonser per ${per}: ${name}`,
  )
  const last = shown.at(-1)
  return {
    title,
    controls: (
      <>
        <Pick
          label={l('Period', 'Period')}
          value={period}
          options={periods.map((p) => ({
            value: p,
            label: l(...PERIOD_NAMES[p]),
          }))}
          onChange={(p) => set({ period: p })}
        />
        <SlicerSelect
          slicer={{
            label: l('Selection', 'Urval'),
            value: series,
            options,
            onChange: (v) => set({ field: v }),
          }}
        />
      </>
    ),
    chart: last ? (
      <MultiLineChart
        series={[{ key: 'ads', name, points: shown }]}
        label={l(
          `${name}, new ads from ${shown[0].label} to ${last.label}; ${last.label}: ${num(last.value)}.`,
          `${name}, nya annonser från ${shown[0].label} till ${last.label}; ${last.label}: ${num(last.value)}.`,
        )}
        format={(v) => num(v)}
        colorOf={() => 0}
      />
    ) : (
      <p className="ja-empty">
        {l(
          'No complete period for this selection.',
          'Ingen hel period för urvalet.',
        )}
      </p>
    ),
    notes: (
      <>
        <p>
          {l(
            'Ads counted by publication day. An ad is not a hire.',
            'Annonser räknade efter publiceringsdag. En annons är inte en anställning.',
          )}
          {role &&
            ' ' +
              l(
                'The role is read from the ad title; ads left as Other are not counted.',
                'Rollen läses ur annonsens titel; annonser som blir Övrigt räknas inte.',
              )}
        </p>
        {left.length > 0 && (
          <p>
            {l(
              `Left off as incomplete: ${few(left.slice().reverse())}.`,
              `Utelämnade som ofullständiga: ${few(left.slice().reverse())}.`,
            )}
          </p>
        )}
        {absent.missing.length > 0 && (
          <p>
            {l(
              `Missing from the file, so the line breaks: ${few(absent.missing)}.`,
              `Saknas i filen, så linjen bryts: ${few(absent.missing)}.`,
            )}
          </p>
        )}
      </>
    ),
    source: role
      ? l("JobTech's historical archives", 'JobTechs historiska arkiv')
      : period === 'week'
        ? l('JobTech JobStream, preliminary', 'JobTech JobStream, preliminärt')
        : l(
            "JobTech's archives from 2020, then JobStream",
            'JobTechs arkiv från 2020, sedan JobStream',
          ),
  }
}
