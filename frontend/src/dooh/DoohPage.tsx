/**
 * När kommer publiken fram? (#publiken): Stockholm's metro stations read as screen locations for
 * digital out-of-home. A head with KPIs, then one chart whose "Show" slicer picks one of five
 * views (where the audience is, its hours, commuter against shopping locations, the planned
 * stations' audience, when they open); method and limits fold away under the chart. The
 * slicers live in the address, so a link shares the view.
 */
import { l } from '../i18n'
import { count } from '../format'
import type { Route } from '../router'
import { LoadNote, loaded, useJson } from '../useJson'
import { useViewParams } from '../report/useViewParams'
import PageHead, { Method, type Kpi } from '../ui/PageHead'
import { Feature, Pick } from '../charts/feature/Feature'
import { hoursSpec, profilesSpec, stationsSpec, type Spec } from './views'
import { newSpec, openingSpec } from './predictions'
import type { Dayparts, NewStations, Stations, Timing } from './types'
import './dooh.css'

const VIEW = { show: 'stations', measure: 'level', at: 'opening' }

const SHOWS: [string, [string, string]][] = [
  ['stations', ['Stations', 'Stationer']],
  ['hours', ['Hours', 'Timmar']],
  ['profiles', ['Commuter or shopping', 'Pendling eller handel']],
  ['new', ['New stations', 'Nya stationer']],
  ['opening', ['Opening', 'Öppning']],
]

export default function DoohPage({ route }: { route: Route }) {
  const [view, setView] = useViewParams(route, VIEW)
  const files = {
    stations: useJson<Stations>('dooh/stations.json'),
    dayparts: useJson<Dayparts>('dooh/dayparts.json'),
    planned: useJson<NewStations>('dooh/new-stations.json'),
    timing: useJson<Timing>('dooh/timing.json'),
  }
  const s = loaded(files.stations)
  const d = loaded(files.dayparts)
  const n = loaded(files.planned)
  const t = loaded(files.timing)
  const names = Object.fromEntries(
    (s?.stations ?? []).map((x) => [x.station_key, x.station_name]),
  )
  const last = s ? s.years.length - 1 : 0
  const median = s
    ? [...s.stations.map((x) => x.boardings[last])].sort((a, b) => a - b)[
        Math.floor(s.stations.length / 2)
      ]
    : 0
  const specs: Record<string, Spec | null> = {
    stations:
      s && stationsSpec(s, view.measure, (m) => setView({ measure: m })),
    hours: s && d && hoursSpec(d, names),
    profiles: d && profilesSpec(d),
    new: s && n && newSpec(n, median, view.at, (a) => setView({ at: a })),
    opening: t && openingSpec(t),
  }
  const shows = SHOWS.filter(([k]) => specs[k])
  const show = shows.find(([k]) => k === view.show)?.[0] ?? shows[0]?.[0]
  const spec = show ? specs[show] : null
  const kpis: Kpi[] = []
  if (s) {
    kpis.push({
      value: count(s.totals[last]),
      label: l(
        `metro boardings per winter weekday, ${s.years[last]}`,
        `påstigande i tunnelbanan per vintervardag, ${s.years[last]}`,
      ),
    })
    kpis.push({
      value: count(s.stations.length),
      label: l(
        'stations, each a screen location',
        'stationer, var och en en skärmplats',
      ),
    })
  }
  if (n) {
    const fresh = n.stations.filter((p) => p.kind === 'new').length
    kpis.push({
      value: count(n.stations.length),
      label: l(
        `planned stations, ${fresh} of them new places`,
        `planerade stationer, varav ${fresh} nya platser`,
      ),
    })
  }
  if (t) {
    const first = Math.min(...t.branches.map((b) => b.range.p50 ?? Infinity))
    if (Number.isFinite(first))
      kpis.push({
        value: String(Math.floor(first)),
        label: l(
          'median year the first branch opens, at the forecasts’ past pace',
          'medianår då första sträckan öppnar, i prognosernas hittillsvarande takt',
        ),
      })
  }
  return (
    <article className="project-page dooh">
      <PageHead
        title={l('When does the audience arrive?', 'När kommer publiken fram?')}
        sentence={l(
          'A metro station is a screen location, priced by who passes. Where is Stockholm’s public-transport audience, at what hours, and how large will it be at stations not yet built?',
          'En tunnelbanestation är en skärmplats, prissatt efter vilka som passerar. Var finns Stockholms kollektivtrafikpublik, vilka timmar, och hur stor blir den vid stationer som inte är byggda än?',
        )}
        kpis={kpis}
      />
      <LoadNote files={Object.values(files)} />
      {spec && (
        <Feature
          id="dooh-chart"
          title={spec.title}
          controls={
            <>
              <Pick
                label={l('Show', 'Visa')}
                value={show!}
                options={shows.map(([k, name]) => ({
                  value: k,
                  label: l(...name),
                }))}
                onChange={(k) => setView({ show: k })}
              />
              {spec.controls}
            </>
          }
          table={spec.table}
          notes={spec.notes}
          source={spec.source}
        >
          {spec.chart}
        </Feature>
      )}
      <Method
        summary={l(
          'Limits · sources · method',
          'Begränsningar · källor · metod',
        )}
      >
        <p>
          {l(
            'Boardings are not unique people, and no price, revenue or screen data is used: this is the audience a media owner would sell, not what it is worth. The counts are of an average winter weekday by hand; summer, weekends and events are not in them. Employed residents are counted where they live, since open DeSO statistics do not say who works where.',
            'Påstigande är inte unika personer, och inga priser, intäkter eller skärmdata används: det här är publiken en mediaägare skulle sälja, inte vad den är värd. Räkningarna gäller en genomsnittlig vintervardag och görs för hand; sommar, helger och evenemang finns inte med. Sysselsatta räknas där de bor, eftersom öppen DeSO-statistik inte säger vem som arbetar var.',
          )}
        </p>
        <p>
          {l(
            'Sources: Region Stockholm, Fakta om SL och länet 2013–2022 (the 2013–2018 editions from the Internet Archive’s copies of sll.se); Trafiklab GTFS Regional for SL (CC0), read from the Mobility Database copy; SCB DeSO 2025 statistics and boundaries and retail areas (CC0); Region Stockholm and Trafikverket documents for the planned stations and every forecast; Region Stockholm, Befolkningsprognos 2026 per planning area. All three predictions were pre-registered before they were computed. Region Stockholm’s last per-station count is the 2022 edition: the series ends in 2026, so no newer boardings exist.',
            'Källor: Region Stockholm, Fakta om SL och länet 2013–2022 (utgåvorna 2013–2018 från Internet Archives kopior av sll.se); Trafiklab GTFS Regional för SL (CC0), läst från Mobility Databases kopia; SCB:s DeSO-statistik och gränser 2025 och handelsområden (CC0); Region Stockholms och Trafikverkets dokument för de planerade stationerna och varje prognos; Region Stockholm, Befolkningsprognos 2026 per planområde. Alla tre förutsägelserna förregistrerades innan de beräknades. Region Stockholms senaste räkning per station är utgåvan 2022: serien läggs ned 2026, så nyare påstigandedata finns inte.',
          )}
        </p>
      </Method>
    </article>
  )
}
