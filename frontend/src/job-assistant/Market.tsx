/**
 * The market tab (`?tab=market`): three key figures, new ads over time for the whole market and
 * for the Data/IT roles, and the cards in MarketCards. Its files load once, when the tab first
 * opens (loadMarket). A card whose file is missing, or whose rows are below the volume limit, is
 * not drawn. The slicers live in the address (useViewParams), so a link shares the view.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { useViewParams } from '../report/useViewParams'
import { ChartCard, DashGrid, SlicerSelect } from '../ui/dash/Dash'
import { Pick } from '../charts/feature/Feature'
import MultiLineChart from '../charts/MultiLineChart'
import { loadMarket, type Delivered } from './data'
import { cap, joinAnd, num } from './labels'
import {
  PERIODS,
  fieldIds,
  fieldSeries,
  gaps,
  roleSeries,
  type MarketFiles,
  type Period,
  type Point,
} from './market-figures'
import { Closing, Employers, Funnel, Technologies, Terms } from './MarketCards'
import Kpis from './MarketKpis'

/** The slicers' address keys and defaults; '' is the first value the file has. */
export const MARKET_VIEW = {
  period: 'month',
  field: 'all',
  family: 'all',
  tech: '',
  terms: '',
  close: 'before_deadline',
  employers: '',
}
export type MarketView = typeof MARKET_VIEW
export type SetView = (changes: Partial<MarketView>) => void

const FILES: Record<keyof MarketFiles, [string, string]> = {
  weekly: ['the weekly counts', 'veckoräkningen'],
  market: ['the monthly counts', 'månadsräkningen'],
  week: ['the archive weeks', 'arkivets veckor'],
  month: ['the archive months', 'arkivets månader'],
  year: ['the archive years', 'arkivets år'],
  skills: ['the technology shares', 'teknikandelarna'],
  terms: ['the rising and falling terms', 'orden som ökar och minskar'],
  employers: ['the employer list', 'arbetsgivarlistan'],
  closing: ['the time to close', 'tiden till stängning'],
}

export default function Market({
  route,
  data,
}: {
  route: Route
  data: Delivered
}) {
  const [view, setView] = useViewParams(route, MARKET_VIEW)
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadMarket>>>()
  useEffect(() => {
    let live = true
    loadMarket().then((r) => live && setLoaded(r))
    return () => {
      live = false
    }
  }, [])
  if (!loaded)
    return (
      <p className="ja-empty" role="status">
        {l('Loading the market figures…', 'Laddar marknadssiffrorna…')}
      </p>
    )
  const { files: f, missing } = loaded
  return (
    <div className="ja-market">
      {missing.length > 0 && (
        <p className="ja-notes" role="status">
          {cap(
            l(
              `${joinAnd(missing.map((m) => FILES[m][0]))} ${missing.length > 1 ? 'are' : 'is'} not available, so ${missing.length > 1 ? 'those cards are' : 'its cards are'} left out.`,
              `${joinAnd(missing.map((m) => FILES[m][1]))} finns inte att hämta, så de korten visas inte.`,
            ),
          )}
        </p>
      )}
      <Kpis f={f} />
      <DashGrid>
        <AdsOverTime f={f} view={view} set={setView} />
        <Closing t={f.closing} view={view} set={setView} />
        <Technologies s={f.skills} view={view} set={setView} />
        <Terms t={f.terms} view={view} set={setView} />
        <Employers e={f.employers} view={view} set={setView} />
        <Funnel data={data} />
      </DashGrid>
    </div>
  )
}

const PERIOD_NAMES: Record<Period, [string, string]> = {
  week: ['Week', 'Vecka'],
  month: ['Month', 'Månad'],
  year: ['Year', 'År'],
}

/** Two lines on their own scales: the whole market by field, and the Data/IT roles. */
function AdsOverTime({
  f,
  view,
  set,
}: {
  f: MarketFiles
  view: MarketView
  set: SetView
}) {
  const periods = PERIODS.filter((p) => fieldIds(f, p).length || f[p])
  if (!periods.length) return null
  const period = periods.find((p) => p === view.period) ?? periods[0]
  const fields = fieldIds(f, period)
  const field = fields.includes(view.field) ? view.field : 'all'
  const fieldName = (id: string) =>
    id === 'all'
      ? l('Whole market', 'Hela marknaden')
      : (f.market?.fields.find((x) => x.id === id)?.name ?? id)
  const roleFile = f[period]
  const roles = [...new Set((roleFile?.rows ?? []).map((r) => r.role_family))]
  const family = roles.includes(view.family) ? view.family : 'all'
  const familyName = (r: string) =>
    r === 'all' ? l('All Data/IT roles', 'Alla Data/IT-roller') : r
  const per = l(...PERIOD_NAMES[period]).toLocaleLowerCase()
  return (
    <ChartCard
      title={l(`New ads per ${per}`, `Nya annonser per ${per}`)}
      sub={l(
        'Ads counted by publication day. An ad is not a hire. The two lines have their own scales and sources.',
        'Annonser räknade efter publiceringsdag. En annons är inte en anställning. De två linjerna har egna skalor och källor.',
      )}
    >
      <Pick
        label={l('Period', 'Period')}
        value={period}
        options={periods.map((p) => ({
          value: p,
          label: l(...PERIOD_NAMES[p]),
        }))}
        onChange={(p) => set({ period: p })}
      />
      <div className="ja-market-pair">
        <Line
          title={l(
            'Whole market, by occupation field',
            'Hela marknaden, per yrkesområde',
          )}
          name={fieldName(field)}
          points={fieldSeries(f, period, field)}
          period={period}
          slicer={{
            label: l('Field', 'Yrkesområde'),
            value: field,
            options: fields
              .map((id) => ({ value: id, label: fieldName(id) }))
              .sort(
                (a, b) =>
                  Number(b.value === 'all') - Number(a.value === 'all') ||
                  a.label.localeCompare(b.label, 'sv'),
              ),
            onChange: (v) => set({ field: v }),
          }}
          source={
            period === 'week'
              ? l(
                  "JobTech's stream, the days it has read whole. Preliminary until the quarter's archive is published.",
                  'JobTechs ström, de dagar den har läst helt. Preliminärt tills kvartalets arkiv publiceras.',
                )
              : l(
                  "JobTech's historical archives from 2020, then its stream.",
                  'JobTechs historiska arkiv från 2020, sedan dess ström.',
                )
          }
        />
        <Line
          title={l(
            'Data/IT ads by role, from the archives',
            'Data/IT-annonser per roll, ur arkiven',
          )}
          name={familyName(family)}
          points={roleSeries(roleFile, family)}
          period={period}
          slicer={{
            label: l('Role', 'Roll'),
            value: family,
            options: roles.map((r) => ({ value: r, label: familyName(r) })),
            onChange: (v) => set({ family: v }),
          }}
          source={l(
            "JobTech's historical archives; the role is read from the ad title, and ads left as Other are not counted.",
            'JobTechs historiska arkiv; rollen läses ur annonsens titel, och annonser som blir Övrigt räknas inte.',
          )}
        />
      </div>
    </ChartCard>
  )
}

function Line({
  title,
  name,
  points,
  period,
  slicer,
  source,
}: {
  title: string
  period: Period
  name: string
  points: Point[]
  slicer: Parameters<typeof SlicerSelect>[0]['slicer']
  source: string
}) {
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
  if (!shown.length) return null
  const last = shown.at(-1)!
  return (
    <div className="ja-line">
      <div className="dk-card-head">
        <h3>{title}</h3>
        <SlicerSelect slicer={slicer} />
      </div>
      <MultiLineChart
        series={[{ key: 'ads', name, points: shown }]}
        label={l(
          `${title}: ${name}, new ads from ${shown[0].label} to ${last.label}; ${last.label}: ${num(last.value)}.`,
          `${title}: ${name}, nya annonser från ${shown[0].label} till ${last.label}; ${last.label}: ${num(last.value)}.`,
        )}
        format={(v) => num(v)}
        colorOf={() => 0}
      />
      <p className="dk-foot">
        {source}
        {left.length > 0 &&
          ' ' +
            l(
              `Left off the line as incomplete: ${left.slice(-3).join(', ')}${left.length > 3 ? ` and ${left.length - 3} more` : ''}.`,
              `Utelämnade som ofullständiga: ${left.slice(-3).join(', ')}${left.length > 3 ? ` och ${left.length - 3} till` : ''}.`,
            )}
        {absent.missing.length > 0 &&
          ' ' +
            l(
              `Missing from the file, so the line breaks: ${absent.missing.slice(0, 3).join(', ')}${absent.missing.length > 3 ? ` and ${absent.missing.length - 3} more` : ''}.`,
              `Saknas i filen, så linjen bryts: ${absent.missing.slice(0, 3).join(', ')}${absent.missing.length > 3 ? ` och ${absent.missing.length - 3} till` : ''}.`,
            )}
      </p>
    </div>
  )
}
