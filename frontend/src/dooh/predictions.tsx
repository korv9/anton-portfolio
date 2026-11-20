/**
 * The two predicted views of the dooh page: the planned stations' audience and when they
 * open (docs/research/preregistrations/outdoor-preregistration.md).
 */
import { l } from '../i18n'
import { count, fixed } from '../format'
import { Pick } from '../charts/feature/Feature'
import { IntervalRows, YearRows } from './charts'
import type { NewStations, Timing } from './types'
import { SL, branchName, type Spec } from './views'

export function newSpec(
  n: NewStations,
  median: number,
  at: string,
  set: (at: string) => void,
): Spec {
  const opening = at !== 'today'
  const rows = n.at_opening.stations
    .map((p) => {
      const a = opening ? p.median : p.today
      return {
        key: p.station,
        label: p.station,
        note: opening
          ? l(
              `${branchName(p.branch)} · ${p.median.year}${p.median.capped ? '+' : ''} · ${count(a.reach)} residents within 1 km`,
              `${branchName(p.branch)} · ${p.median.year}${p.median.capped ? '+' : ''} · ${count(a.reach)} boende inom 1 km`,
            )
          : l(
              `${branchName(p.branch)} · ${count(a.reach)} residents within 1 km`,
              `${branchName(p.branch)} · ${count(a.reach)} boende inom 1 km`,
            ),
        value: a.boardings,
        low: a.interval80[0],
        high: a.interval80[1],
        p,
      }
    })
    .sort((a, b) => b.value - a.value)
  const c = n.check
  const last = n.at_opening.last_year
  const shared = n.stations
    .filter((p) => p.kind === 'interchange')
    .map((p) => p.station)
  const caveat =
    c.label === 'model'
      ? ''
      : l(
          ': the model did not beat the median station as pre-registered',
          ': modellen slog inte medianstationen enligt förregistreringen',
        )
  return {
    title: opening
      ? l(
          `Predicted boardings at the planned stations in their likely opening year, 80 % intervals${caveat}`,
          `Förutsagda påstigande vid de planerade stationerna det år de troligen öppnar, 80 %-intervall${caveat}`,
        )
      : l(
          `Predicted boardings at the planned stations among today's residents, 80 % intervals${caveat}`,
          `Förutsagda påstigande vid de planerade stationerna bland dagens boende, 80 %-intervall${caveat}`,
        ),
    controls: (
      <Pick
        label={l('Audience', 'Publik')}
        value={opening ? 'opening' : 'today'}
        options={[
          { value: 'opening', label: l('At opening', 'Vid öppning') },
          { value: 'today', label: l('Today', 'I dag') },
        ]}
        onChange={set}
      />
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
            <th>{l('Opening year used', 'Öppningsår som används')}</th>
            <th>
              {l('Residents within 1 km, today', 'Boende inom 1 km, i dag')}
            </th>
            <th>{l('At opening', 'Vid öppning')}</th>
            <th>{l('Boardings, today', 'Påstigande, i dag')}</th>
            <th>{l('At opening', 'Vid öppning')}</th>
            <th>{l('80 % interval', '80 %-intervall')}</th>
            <th>
              {l('At official forecast year', 'Vid officiellt prognosår')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p }) => (
            <tr key={p.station}>
              <th scope="row">{p.station}</th>
              <td>{branchName(p.branch)}</td>
              <td>
                {p.median.year}
                {p.median.capped ? '+' : ''}
              </td>
              <td>{count(p.today.reach)}</td>
              <td>{count(p.median.reach)}</td>
              <td>{count(p.today.boardings)}</td>
              <td>{count(p.median.boardings)}</td>
              <td>
                {count(p.median.interval80[0])}–{count(p.median.interval80[1])}
              </td>
              <td>
                {count(p.official.boardings)} ({p.official.year}
                {p.official.capped ? '+' : ''})
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
            `At opening, also pre-registered: residents and employed residents within 1 km grow as Region Stockholm projects for the station's planning area, from ${n.at_opening.base_year} to the branch's median opening year in the Opening view, at most ${last} (marked ${last}+). The same model, not refitted, gives the boardings. Potential reach is the residents within 1 km: people who could pass, not people who see a screen. Inside Stockholm a planning area is a whole district, so a fast-growing corner gets its district's average, and jobs stay as today, since no official projection exists below the region.`,
            `Vid öppning, också förregistrerat: boende och sysselsatta boende inom 1 km växer som Region Stockholm prognostiserar för stationens planområde, från ${n.at_opening.base_year} till sträckans medianår för öppning i vyn Öppning, högst ${last} (markerat ${last}+). Samma modell, inte omskattad, ger påstigandena. Tänkbar räckvidd är de boende inom 1 km: personer som kan passera, inte personer som ser en skärm. Inom Stockholms stad är ett planområde en hel stadsdel, så ett hörn som växer snabbt får stadsdelens snitt, och arbetsplatserna är dagens, eftersom ingen officiell prognos finns under regionnivå.`,
          )}
        </p>
        <p>
          {l(
            `A new station takes travellers from nearby ones, and its audience grows for some years after opening; neither is modelled. New platforms at existing stations are not predicted: ${shared.join(', ') || '–'}.`,
            `En ny station tar resenärer från stationer i närheten, och publiken växer några år efter öppningen; inget av det modelleras. Nya plattformar vid befintliga stationer förutsägs inte: ${shared.join(', ') || '–'}.`,
          )}
        </p>
      </>
    ),
    source: `${SL}; SCB DeSO; Region Stockholm, Befolkningsprognos 2026; Nya tunnelbanan`,
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
