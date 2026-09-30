/**
 * Läget på jobbmarknaden, as one screen: key figures, ads per month (the large card), which
 * fields and occupations grow, where the jobs are and on what terms. Every card answers for the
 * fields chosen in the field bar. The latest year is partial, so every change compares the same
 * months of the year before.
 */
import type { ReactNode } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { useViewParams } from '../politik/useViewParams'
import { Select } from '../politik/controls'
import DashBars from '../politik/dash/DashBars'
import { CountUp } from '../politik/dash/motion'
import { MonthColumns } from './charts'
import Treemap from './Treemap'
import {
  change,
  conditionsOf,
  countyAds,
  fieldName,
  monthShort,
  monthlyAds,
  number,
  occupationsIn,
  pctOf,
  share,
  signedPct,
  yearAds,
  ytdLabel,
  type Market,
} from './data'
import { withFields } from './selection'

function Card({
  title,
  meta,
  href,
  index,
  children,
  className = '',
}: {
  title: string
  meta: string
  href: string
  index: number
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`dash-card ${className}`}
      style={{ ['--i' as string]: index }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <a href={href} aria-label={l(`More: ${title}`, `Mer: ${title}`)}>
          {l('More', 'Mer')} →
        </a>
      </header>
      <p className="dash-meta">{meta}</p>
      <div className="dash-body">{children}</div>
    </section>
  )
}

function Kpi({
  label,
  value,
  format,
  sub,
  index,
}: {
  label: string
  value: number
  format: (v: number) => string
  sub?: string
  index: number
}) {
  return (
    <div className="dash-kpi" style={{ ['--i' as string]: index }}>
      <dt>{label}</dt>
      <dd>
        <CountUp value={value} format={format} />
      </dd>
      {sub && <dd className="dash-kpi-sub">{sub}</dd>}
    </div>
  )
}

const SLICERS = { period: '36', jamfor: 'ytd', minsta: '100' }

export default function Dashboard({
  route,
  data,
  fields,
}: {
  route: Route
  data: Market
  fields: string[]
}) {
  const [view, setView] = useViewParams(route, SLICERS)
  const latest = data.latest_year
  const previous = latest - 1
  const period = l(
    `${ytdLabel(data.ytd_months)} ${latest}`,
    `${ytdLabel(data.ytd_months)} ${latest}`,
  )
  const chosenNames = fields.map((id) =>
    fieldName(data.fields.find((f) => f.id === id)?.name ?? id),
  )
  const scope = fields.length
    ? chosenNames.join(', ')
    : l('the whole market', 'hela marknaden')

  // ---- Ads now and a year ago, the same months ----
  const now = yearAds(data, fields, latest)
  const before = yearAds(data, fields, previous)
  const all = yearAds(data, [], latest)
  const monthly = monthlyAds(data, fields)
  const shown =
    view.period === 'alla' ? monthly : monthly.slice(-Number(view.period))

  // ---- Fields: change against the same months last year ----
  const fieldRows = data.fields
    .filter((f) => !fields.length || fields.includes(f.id))
    .map((f) => {
      const a = yearAds(data, [f.id], latest)
      const b = yearAds(data, [f.id], previous)
      return { id: f.id, name: fieldName(f.name), now: a, change: change(a, b) }
    })
    .filter((f) => f.change != null && f.now > 0)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
  const largest = [...fieldRows].sort((a, b) => b.now - a.now)[0]
  const fieldBars =
    fieldRows.length > 10
      ? [...fieldRows.slice(0, 5), ...fieldRows.slice(-5)]
      : fieldRows

  // ---- Occupations that grow the most, with a floor so tiny groups do not top the list ----
  const floor = Number(view.minsta)
  const occupations = occupationsIn(data, fields)
    .map((o) => ({
      ...o,
      now: o.ytd[String(latest)] ?? 0,
      before: o.ytd[String(previous)] ?? 0,
    }))
    .filter((o) => o.before >= floor)
    .map((o) => ({ ...o, change: change(o.now, o.before) ?? 0 }))
    .sort((a, b) => b.change - a.change)
  const growers = occupations.slice(0, 7)
  const top = [...occupationsIn(data, fields)].sort(
    (a, b) => (b.ytd[String(latest)] ?? 0) - (a.ytd[String(latest)] ?? 0),
  )[0]

  // ---- Counties ----
  const counties = countyAds(data, fields, latest)
    .map((c) => {
      const b = countyAds(data, fields, previous).find(
        (x) => x.region === c.region,
      )?.ads
      return { ...c, change: change(c.ads, b) }
    })
    .sort((a, b) => b.ads - a.ads)
  const countyTotal = counties.reduce((s, c) => s + c.ads, 0)

  // ---- Conditions ----
  const cNow = conditionsOf(data, fields, latest)
  const cBefore = conditionsOf(data, fields, previous)
  const fullTime = (c: typeof cNow) =>
    pctOf(
      c.hours['Heltid'] ?? 0,
      Object.values(c.hours).reduce((s, v) => s + v, 0),
    )
  const regular = (c: typeof cNow) =>
    pctOf(
      c.employment['Vanlig anställning'] ?? 0,
      Object.values(c.employment).reduce((s, v) => s + v, 0),
    )
  const experience = (c: typeof cNow) =>
    pctOf(
      c.experience['yes'] ?? 0,
      (c.experience['yes'] ?? 0) + (c.experience['no'] ?? 0),
    )
  const conditionBars = [
    {
      key: 'heltid',
      label: l('Full time', 'Heltid'),
      value: fullTime(cNow),
      ref: fullTime(cBefore),
    },
    {
      key: 'vanlig',
      label: l('Regular employment', 'Vanlig anställning'),
      value: regular(cNow),
      ref: regular(cBefore),
    },
    {
      key: 'erfarenhet',
      label: l('Experience required', 'Erfarenhet krävs'),
      value: experience(cNow),
      ref: experience(cBefore),
    },
  ]

  return (
    <>
      <Treemap data={data} fields={fields} />
      <div className="dash jobb-dash">
        <header className="dash-head">
          <div>
            <h1>{l('The job market now', 'Läget på jobbmarknaden')}</h1>
            <p className="dash-sub">
              {l('Job ads in', 'Jobbannonser')} {period} · {scope} ·{' '}
              {l(
                `updated to ${monthShort(data.last_month)}`,
                `till och med ${monthShort(data.last_month)}`,
              )}
            </p>
          </div>
          <div className="dash-slicers" aria-label={l('Filters', 'Filter')}>
            <Select
              label={l('Months shown', 'Månader')}
              value={view.period}
              options={[
                { value: '24', label: l('Last 24', 'Senaste 24') },
                { value: '36', label: l('Last 36', 'Senaste 36') },
                { value: 'alla', label: l('Since 2020', 'Sedan 2020') },
              ]}
              onChange={(period) => setView({ period })}
            />
            <Select
              label={l('Smallest occupation', 'Minsta yrke')}
              value={view.minsta}
              options={['25', '100', '500'].map((v) => ({
                value: v,
                label: l(`${v}+ ads`, `${v}+ annonser`),
              }))}
              onChange={(minsta) => setView({ minsta })}
            />
          </div>
        </header>

        <dl className="dash-kpis">
          <Kpi
            index={0}
            label={l('Job ads', 'Jobbannonser')}
            value={now}
            format={number}
            sub={period}
          />
          <Kpi
            index={1}
            label={l('Against a year ago', 'Mot i fjol')}
            value={change(now, before) ?? 0}
            format={(v) => signedPct(v)}
            sub={l(`same months ${previous}`, `samma månader ${previous}`)}
          />
          <Kpi
            index={2}
            label={
              fields.length
                ? l('Share of all ads', 'Andel av alla annonser')
                : l('Largest field', 'Största område')
            }
            value={fields.length ? pctOf(now, all) : (largest?.now ?? 0)}
            format={(v) => (fields.length ? share(v, 1) : number(v))}
            sub={fields.length ? String(latest) : largest?.name}
          />
          <Kpi
            index={3}
            label={l('Most ads', 'Flest annonser')}
            value={top?.ytd[String(latest)] ?? 0}
            format={number}
            sub={top?.name}
          />
          <Kpi
            index={4}
            label={l('Largest county', 'Största län')}
            value={pctOf(counties[0]?.ads ?? 0, countyTotal)}
            format={(v) => share(v)}
            sub={counties[0]?.region}
          />
          <Kpi
            index={5}
            label={l('Full time', 'Heltid')}
            value={fullTime(cNow)}
            format={(v) => share(v)}
            sub={l('of ads stating hours', 'av annonser med arbetstid')}
          />
        </dl>

        <div className="dash-grid">
          <Card
            index={0}
            className="dash-budget"
            title={l(
              'How ads develop, month by month',
              'Hur annonserna utvecklas, månad för månad',
            )}
            meta={l(
              `New ads per month · ${scope} · ${latest} darker`,
              `Nya annonser per månad · ${scope} · ${latest} mörkare`,
            )}
            href={withFields('#jobb-trender', fields)}
          >
            <MonthColumns
              months={shown}
              highlight={`${latest}-01`}
              label={l(
                `New job ads per month, ${scope}: ${number(now)} in ${period}, ${signedPct(change(now, before))} against the same months of ${previous}`,
                `Nya jobbannonser per månad, ${scope}: ${number(now)} ${period}, ${signedPct(change(now, before))} mot samma månader ${previous}`,
              )}
            />
            <p className="jobb-takeaway">
              {l(
                `${number(now)} ads in ${period}: ${signedPct(change(now, before))} against the same months of ${previous}.`,
                `${number(now)} annonser ${period}: ${signedPct(change(now, before))} mot samma månader ${previous}.`,
              )}
            </p>
          </Card>

          <Card
            index={1}
            title={l('Which fields grow', 'Vilka områden växer')}
            meta={l(
              `Change against the same months of ${previous}`,
              `Förändring mot samma månader ${previous}`,
            )}
            href={withFields('#jobb-trender', fields)}
          >
            <DashBars
              bars={fieldBars.map((f) => ({
                key: f.id,
                label: f.name,
                value: f.change ?? 0,
                tone: 'neutral' as const,
              }))}
              format={(v) => signedPct(v)}
              label={l(
                'Change in ads per field',
                'Förändring i annonser per område',
              )}
            />
          </Card>

          <Card
            index={2}
            title={l('Occupations growing the most', 'Yrken som växer mest')}
            meta={l(
              `Occupations with ${floor}+ ads a year ago · ${period}`,
              `Yrken med minst ${floor} annonser i fjol · ${period}`,
            )}
            href={withFields('#jobb-yrken', fields)}
          >
            {growers.length ? (
              <DashBars
                bars={growers.map((o) => ({
                  key: o.id,
                  label: o.name,
                  value: o.change,
                  tone: 'neutral' as const,
                  note: ` ${number(o.now)}`,
                }))}
                format={(v) => signedPct(v)}
                label={l(
                  'Occupations growing the most',
                  'Yrken som växer mest',
                )}
              />
            ) : (
              <p className="dash-empty">
                {l(
                  'No occupation this large in the chosen fields.',
                  'Inget så stort yrke i valda områden.',
                )}
              </p>
            )}
          </Card>

          <Card
            index={3}
            title={l('Where the jobs are', 'Var jobben finns')}
            meta={l(
              `Share of ads per county · ${period}`,
              `Andel av annonserna per län · ${period}`,
            )}
            href={withFields('#jobb-lan', fields)}
          >
            <DashBars
              bars={counties.slice(0, 6).map((c) => ({
                key: c.region,
                label: c.region,
                value: pctOf(c.ads, countyTotal),
                tone: 'neutral' as const,
              }))}
              format={(v) => share(v, 1)}
              label={l(
                'Share of ads per county',
                'Andel av annonserna per län',
              )}
            />
          </Card>

          <Card
            index={4}
            title={l('On what terms', 'På vilka villkor')}
            meta={l(
              `Share of ads ${latest} · tick: ${previous}`,
              `Andel av annonserna ${latest} · streck: ${previous}`,
            )}
            href={withFields('#jobb-villkor', fields)}
          >
            <DashBars
              bars={conditionBars.map((c) => ({
                ...c,
                tone: 'neutral' as const,
              }))}
              format={(v) => share(v)}
              max={100}
              label={l('Terms of employment', 'Anställningsvillkor')}
            />
          </Card>
        </div>
        <p className="dash-foot">
          {l('Source', 'Källa')}: Arbetsförmedlingen, JobTech ·{' '}
          {l(
            'An ad is not a hire; an ad without a number of vacancies counts as one.',
            'En annons är inte en anställning; en annons utan antal platser räknas som en.',
          )}{' '}
          <a href="#jobb-kallor">
            {l('Sources and method', 'Källor och metod')}
          </a>
        </p>
      </div>
    </>
  )
}
