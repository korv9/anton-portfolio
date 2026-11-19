/**
 * The three observed views of the outdoor page's one chart: where the audience is and how it
 * moved, its hours, and commuter against shopping locations (the predicted two are in
 * predictions.tsx). Each returns a title, its own slicer, the chart, a table, folded notes and
 * a source line.
 */
import type { ReactNode } from 'react'
import { l } from '../i18n'
import { count, fixed } from '../format'
import RankBars from '../charts/RankBars'
import { Pick } from '../charts/feature/Feature'
import { Heatmap, HourLines } from './charts'
import type { Dayparts, Stations } from './types'

export type Spec = {
  title: string
  controls?: ReactNode
  chart: ReactNode
  table: ReactNode
  notes: ReactNode
  source: string
}

export const SL = 'Region Stockholm, Fakta om SL och länet 2013–2022'
const pct = (logRatio: number) => (Math.exp(logRatio) - 1) * 100
const signed = (v: number) => `${v > 0 ? '+' : ''}${fixed(v)} %`

const BRANCHES: Record<string, [string, string]> = {
  barkarby: ['Akalla–Barkarby', 'Akalla–Barkarby'],
  arenastaden: ['Odenplan–Arenastaden', 'Odenplan–Arenastaden'],
  nacka_soderort: [
    'Kungsträdgården–Nacka and Söderort',
    'Kungsträdgården–Nacka och Söderort',
  ],
  alvsjo: ['Fridhemsplan–Älvsjö', 'Fridhemsplan–Älvsjö'],
}
export const branchName = (b: string) => (BRANCHES[b] ? l(...BRANCHES[b]) : b)

export function stationsSpec(
  s: Stations,
  measure: string,
  set: (m: string) => void,
): Spec {
  const last = s.years.length - 1
  const i13 = s.years.indexOf(2013)
  const i19 = s.years.indexOf(2019)
  const measures: Record<
    string,
    [string, (x: Stations['stations'][number]) => number]
  > = {
    level: [
      l(
        `Boardings per winter weekday, ${s.years[last]}`,
        `Påstigande per vintervardag, ${s.years[last]}`,
      ),
      (x) => x.boardings[last],
    ],
    growth: [
      l(
        'Change in boardings 2013–2019, %',
        'Förändring i påstigande 2013–2019, %',
      ),
      (x) => pct(x.change_2013_2019),
    ],
    recovery: [
      l(
        'Change in boardings 2019–2022, %',
        'Förändring i påstigande 2019–2022, %',
      ),
      (x) => pct(x.change_2019_2022),
    ],
  }
  const [title, value] = measures[measure] ?? measures.level
  const rows = [...s.stations].sort((a, b) => value(b) - value(a))
  return {
    title,
    controls: (
      <Pick
        label={l('Measure', 'Mått')}
        value={measures[measure] ? measure : 'level'}
        options={[
          { value: 'level', label: l('Audience', 'Publik') },
          { value: 'growth', label: '2013–2019' },
          { value: 'recovery', label: '2019–2022' },
        ]}
        onChange={set}
      />
    ),
    chart: (
      <RankBars
        label={title}
        limit={20}
        format={(v) =>
          measure === 'level' || !measures[measure] ? count(v) : signed(v)
        }
        rows={rows.map((x) => ({
          key: x.station_key,
          label: x.station_name,
          value: value(x),
        }))}
      />
    ),
    table: (
      <table className="dk-table">
        <thead>
          <tr>
            <th>{l('Station', 'Station')}</th>
            {s.years.map((y) => (
              <th key={y}>{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.station_key}>
              <th scope="row">{x.station_name}</th>
              {x.boardings.map((b, i) => (
                <td key={i}>{count(b)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
    notes: (
      <p>
        {l(
          `Boardings are counted by hand on an average winter weekday. They are not unique people: a trip out and back is two boardings, and a change of train counts again. 2020 and 2021 were counted during the pandemic. The whole metro had ${count(s.totals[i13])} boardings in 2013, ${count(s.totals[i19])} in 2019 and ${count(s.totals[last])} in ${s.years[last]}. Region Stockholm ended the series with the 2022 edition.`,
          `Påstigande räknas för hand en genomsnittlig vintervardag. De är inte unika personer: en resa dit och hem är två påstigningar, och ett byte räknas igen. 2020 och 2021 räknades under pandemin. Hela tunnelbanan hade ${count(s.totals[i13])} påstigande 2013, ${count(s.totals[i19])} 2019 och ${count(s.totals[last])} ${s.years[last]}. Region Stockholm avslutade serien med 2022 års utgåva.`,
        )}
      </p>
    ),
    source: SL,
  }
}

export function hoursSpec(d: Dayparts, names: Record<string, string>): Spec {
  const rows = [...d.stations]
    .sort((a, b) => b.morning_share - a.morning_share)
    .map((x) => ({
      key: x.station_key,
      label: names[x.station_key] ?? x.station_key,
      values: x.index,
    }))
  return {
    title: l(
      `Audience index per station and hour, winter weekday ${d.year}`,
      `Publikindex per station och timme, vintervardag ${d.year}`,
    ),
    chart: <Heatmap rows={rows} max={400} />,
    table: (
      <table className="dk-table">
        <thead>
          <tr>
            <th>{l('Station', 'Station')}</th>
            {d.stations[0].index.map((_, h) => (
              <th key={h}>{String(h).padStart(2, '0')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              {r.values.map((v, h) => (
                <td key={h}>{v > 0 ? fixed(v) : '–'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
    notes: (
      <p>
        {l(
          `Index 100 is the mean hour of all stations: ${count(Math.round(d.mean_hourly_boardings))} boardings. Stations are sorted by their morning share, so places people leave from in the morning come first. Only four bands are counted (06–09, 07.30–08.30, 15–18, 16.30–17.30); within a band, and over the rest of the day, boardings follow the station's scheduled departures on ${d.service_date}. The shape inside the bands is a model, not a count.`,
          `Index 100 är alla stationers medeltimme: ${count(Math.round(d.mean_hourly_boardings))} påstigande. Stationerna är sorterade efter morgonandel, så platser man reser från på morgonen kommer först. Bara fyra band är räknade (06–09, 07.30–08.30, 15–18, 16.30–17.30); inom ett band, och under resten av dagen, följer påstigandet stationens avgångar enligt tidtabellen ${d.service_date}. Formen inom banden är en modell, inte en räkning.`,
        )}
      </p>
    ),
    source: `${SL}; Trafiklab GTFS Regional (SL)`,
  }
}

export function profilesSpec(d: Dayparts): Spec {
  const g = d.groups
  const series = (['shopping', 'other'] as const).map((k) => ({
    key: k,
    name:
      k === 'shopping'
        ? l(
            `Shopping locations (${g[k].stations})`,
            `Handelsplatser (${g[k].stations})`,
          )
        : l(
            `Other stations (${g[k].stations})`,
            `Övriga stationer (${g[k].stations})`,
          ),
    values: g[k].share_mean,
    focal: k === 'shopping',
  }))
  const share = (v: number) => `${fixed(v * 100)} %`
  return {
    title: l(
      `Share of a station’s weekday boardings by hour: shopping locations against other stations, ${d.year}`,
      `Andel av en stations vardagspåstigande per timme: handelsplatser mot övriga stationer, ${d.year}`,
    ),
    chart: (
      <HourLines
        label={l(
          'Share of the day’s boardings by hour',
          'Andel av dagens påstigande per timme',
        )}
        series={series}
      />
    ),
    table: (
      <table className="dk-table">
        <thead>
          <tr>
            <th />
            <th>{l('Stations', 'Stationer')}</th>
            <th>{l('Median share 06–09', 'Medianandel 06–09')}</th>
            <th>{l('Median share 15–18', 'Medianandel 15–18')}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.key}>
              <th scope="row">{s.name}</th>
              <td>{g[s.key].stations}</td>
              <td>{share(g[s.key].morning_share_median)}</td>
              <td>{share(g[s.key].afternoon_share_median)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
    notes: (
      <p>
        {l(
          `A shopping location has an SCB retail area (handelsområde 2020) with at least 500 employees within 300 m. At the median, ${share(g.other.morning_share_median)} of other stations' boardings fall 06–09 and ${share(g.other.afternoon_share_median)} 15–18; at shopping locations ${share(g.shopping.morning_share_median)} and ${share(g.shopping.afternoon_share_median)}. A boarding is someone leaving the place: people board at home in the morning and at work or the shops in the afternoon.`,
          `En handelsplats har ett av SCB:s handelsområden (2020) med minst 500 anställda inom 300 m. I median faller ${share(g.other.morning_share_median)} av övriga stationers påstigande 06–09 och ${share(g.other.afternoon_share_median)} 15–18; vid handelsplatserna ${share(g.shopping.morning_share_median)} och ${share(g.shopping.afternoon_share_median)}. Ett påstigande är någon som lämnar platsen: man kliver på hemma på morgonen och vid jobbet eller affärerna på eftermiddagen.`,
        )}
      </p>
    ),
    source: `${SL}; SCB handelsområden 2020; Trafiklab GTFS Regional (SL)`,
  }
}
