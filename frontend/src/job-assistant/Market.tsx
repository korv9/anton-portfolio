/**
 * The market tab (`?tab=market`): three key figures and one chart. A slicer picks what the chart
 * shows (new ads over time, time to close, technologies, words, employers, fit) and each view
 * adds its own slicers; method and caveats fold away under the chart. The files load once, when
 * the tab first opens (loadMarket); a view whose file is missing is not offered. The slicers
 * live in the address (useViewParams), so a link shares the view.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { useViewParams } from '../report/useViewParams'
import { Feature, Pick } from '../charts/feature/Feature'
import { loadMarket, type Delivered } from './data'
import { cap, joinAnd } from './labels'
import type { MarketFiles } from './market-figures'
import { adsSpec } from './market-ads'
import {
  closeSpec,
  employersSpec,
  fitSpec,
  techSpec,
  termsSpec,
} from './market-ranks'
import Kpis from './MarketKpis'

/** The slicers' address keys and defaults; '' is the first value the file has. */
export const MARKET_VIEW = {
  show: 'ads',
  period: 'month',
  field: 'all',
  tech: '',
  terms: '',
  dir: 'up',
  close: 'before_deadline',
  employers: '',
}
export type MarketView = typeof MARKET_VIEW
export type SetView = (changes: Partial<MarketView>) => void
/** One view of the chart: its title, its own slicers, the chart, the folded notes, the source. */
export type Spec = {
  title: string
  controls?: ReactNode
  chart: ReactNode
  notes?: ReactNode
  source: string
}

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

const SHOWS: [string, [string, string]][] = [
  ['ads', ['New ads', 'Nya annonser']],
  ['close', ['Time to close', 'Tid till stängning']],
  ['tech', ['Technologies', 'Tekniker']],
  ['terms', ['Words', 'Ord']],
  ['employers', ['Employers', 'Arbetsgivare']],
  ['fit', ['Fit', 'Passform']],
]

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
  const p = { view, set: setView }
  const specs: Record<string, Spec | null> = {
    ads: adsSpec(f, view, setView),
    close: closeSpec({ ...p, t: f.closing }),
    tech: techSpec({ ...p, s: f.skills }),
    terms: termsSpec({ ...p, t: f.terms }),
    employers: employersSpec({ ...p, e: f.employers }),
    fit: fitSpec(data),
  }
  const shows = SHOWS.filter(([k]) => specs[k])
  const show = shows.find(([k]) => k === view.show)?.[0] ?? shows[0]?.[0]
  const spec = show ? specs[show] : null
  return (
    <div className="ja-market">
      {missing.length > 0 && (
        <p className="ja-notes" role="status">
          {cap(
            l(
              `${joinAnd(missing.map((m) => FILES[m][0]))} could not be loaded.`,
              `${joinAnd(missing.map((m) => FILES[m][1]))} gick inte att hämta.`,
            ),
          )}
        </p>
      )}
      <Kpis f={f} />
      {spec && (
        <Feature
          id="ja-market-chart"
          title={spec.title}
          controls={
            <>
              <div className="ja-market-show">
                <Pick
                  label={l('Show', 'Visa')}
                  value={show!}
                  options={shows.map(([k, name]) => ({
                    value: k,
                    label: l(...name),
                  }))}
                  onChange={(k) => setView({ show: k })}
                />
              </div>
              {spec.controls}
            </>
          }
          notes={spec.notes}
          source={spec.source}
        >
          {spec.chart}
        </Feature>
      )}
    </div>
  )
}
