/**
 * The two predicted views of the outdoor page: the planned stations' audience and when they
 * open (docs/research/preregistrations/outdoor-preregistration.md).
 */
import { l } from '../i18n'
import { count, fixed } from '../format'
import { IntervalRows, YearRows } from './charts'
import type { NewStations, Timing } from './types'
import { SL, branchName, type Spec } from './views'

export function newSpec(n: NewStations, median: number): Spec {
  const rows = n.stations
    .filter((p) => p.kind === 'new' && p.boardings !== undefined)
    .sort((a, b) => b.boardings! - a.boardings!)
    .map((p) => ({
      key: p.station,
      label: p.station,
      note: branchName(p.branch),
      value: p.boardings!,
      low: p.interval80![0],
      high: p.interval80![1],
    }))
  const c = n.check
  const shared = n.stations
    .filter((p) => p.kind === 'interchange')
    .map((p) => p.station)
  return {
    title:
      c.label === 'model'
        ? l(
            'Predicted boardings per winter weekday at the planned stations, with 80 % intervals',
            'Förutsagda påstigande per vintervardag vid de planerade stationerna, med 80 %-intervall',
          )
        : l(
            'Predicted boardings at the planned stations, 80 % intervals: the model did not beat the median station as pre-registered',
            'Förutsagda påstigande vid de planerade stationerna, 80 %-intervall: modellen slog inte medianstationen enligt förregistreringen',
          ),
    chart: (
      <IntervalRows
        rows={rows}
        reference={median}
        referenceLabel={l(
          `median of today's 100 stations, ${n.target_year}: ${count(median)}`,
          `median för dagens 100 stationer, ${n.target_year}: ${count(median)}`,
        )}
      />
    ),
    table: (
      <table className="dk-table">
        <thead>
          <tr>
            <th>{l('Station', 'Station')}</th>
            <th>{l('Branch', 'Sträcka')}</th>
            <th>{l('Predicted', 'Förutsagt')}</th>
            <th>{l('80 % interval', '80 %-intervall')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              <td>{r.note}</td>
              <td>{count(r.value)}</td>
              <td>
                {count(r.low)}–{count(r.high)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
    notes: (
      <>
        <p>
          {l(
            `Pre-registered before the fit: ordinary least squares on log boardings ${n.target_year} at today's 100 stations, from residents and employed residents within 1 km (SCB DeSO), retail employees within 1 km, distance to T-Centralen, rail and tram routes within 400 m, and whether the station ends a line. Intervals are 80 % jackknife+.`,
            `Förregistrerat före skattningen: minsta kvadrat på log påstigande ${n.target_year} vid dagens 100 stationer, från boende och sysselsatta boende inom 1 km (SCB DeSO), anställda i handelsområden inom 1 km, avstånd till T-Centralen, spår- och spårvagnslinjer inom 400 m och om stationen är en ändstation. Intervallen är 80 % jackknife+.`,
          )}
        </p>
        <p>
          {l(
            `Check: leave-one-out median error ${fixed(c.loo_median_abs_log_error * 100)} % in log terms against ${fixed(c.null_median_abs_log_error * 100)} % for the median station, coverage ${fixed(c.coverage * 100)} %. Label: ${c.label === 'model' ? 'the model beats the median as pre-registered' : 'not better than the median, so read the numbers as such'}.`,
            `Kontroll: lämna-en-utanför-medianfel ${fixed(c.loo_median_abs_log_error * 100)} % i log mot ${fixed(c.null_median_abs_log_error * 100)} % för medianstationen, täckning ${fixed(c.coverage * 100)} %. Etikett: ${c.label === 'model' ? 'modellen slår medianen enligt förregistreringen' : 'inte bättre än medianen, läs siffrorna så'}.`,
          )}
        </p>
        <p>
          {l(
            `Residents are today's, not the housing planned around the stations, and a new station takes travellers from nearby ones. New platforms at existing stations are not predicted: ${shared.join(', ') || '–'}.`,
            `De boende är dagens, inte de bostäder som planeras kring stationerna, och en ny station tar resenärer från stationer i närheten. Nya plattformar vid befintliga stationer förutsägs inte: ${shared.join(', ') || '–'}.`,
          )}
        </p>
      </>
    ),
    source: `${SL}; SCB DeSO; Region Stockholm, Nya tunnelbanan`,
  }
}

export function openingSpec(t: Timing): Spec {
  const now = Number(t.now.slice(0, 4)) + (Number(t.now.slice(5, 7)) - 0.5) / 12
  const point = (f: Timing['branches'][number]['forecasts'][number]) =>
    f.opening_year +
    (f.opening_month
      ? (f.opening_month - 0.5) / 12
      : f.opening_quarter
        ? (f.opening_quarter - 0.5) / 4
        : 0.5)
  const rows = t.branches.map((b) => ({
    key: b.branch,
    label: branchName(b.branch),
    forecasts: b.forecasts.map(point),
    latest: b.latest_forecast,
    ...b.range,
  }))
  return {
    title: l(
      'Opening year per branch if the forecasts keep slipping as they have',
      'Öppningsår per sträcka om prognoserna fortsätter glida som hittills',
    ),
    chart: <YearRows rows={rows} from={2015} to={2060} now={now} />,
    table: (
      <table className="dk-table">
        <thead>
          <tr>
            <th>{l('Branch', 'Sträcka')}</th>
            <th>{l('Stated', 'Angiven')}</th>
            <th>{l('Opening forecast', 'Prognos för trafikstart')}</th>
            <th>{l('Source', 'Källa')}</th>
          </tr>
        </thead>
        <tbody>
          {t.branches.flatMap((b) =>
            b.forecasts.map((f, i) => (
              <tr key={`${b.branch}-${i}`}>
                <th scope="row">{branchName(b.branch)}</th>
                <td>{f.statement_date}</td>
                <td>
                  {f.opening_year}
                  {f.opening_quarter ? ` Q${f.opening_quarter}` : ''}
                  {f.opening_month
                    ? `-${String(f.opening_month).padStart(2, '0')}`
                    : ''}
                </td>
                <td>
                  <a href={f.source_url} rel="noreferrer">
                    {f.source_title}
                  </a>
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    ),
    notes: (
      <p>
        {l(
          `Pre-registered: the slip rate is the change in the forecast opening per year between two statements. ${t.resamples.toLocaleString('en')} bootstrap draws of all branches' revisions give a rate; a branch then opens when the moving forecast meets the calendar. A rate of one year per year or more never opens and counts as after 2060. Why a forecast moved is not modelled, and past slips need not repeat.`,
          `Förregistrerat: glidningstakten är förändringen i prognosen för trafikstart per år mellan två besked. ${t.resamples.toLocaleString('sv')} bootstrapdragningar av alla sträckors revideringar ger en takt; en sträcka öppnar när den rörliga prognosen möter kalendern. En takt på ett år per år eller mer öppnar aldrig och räknas som efter 2060. Varför en prognos flyttades modelleras inte, och gamla förseningar behöver inte upprepas.`,
        )}
      </p>
    ),
    source: l(
      'Official forecasts, one source per row (table)',
      'Officiella prognoser, en källa per rad (tabell)',
    ),
  }
}
