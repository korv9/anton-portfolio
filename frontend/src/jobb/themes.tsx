/**
 * The job-market themes, each one question on the politics template (ThemeLayout): a question,
 * why it matters, key figures, one chart, the table and the sources. Every theme answers for
 * the fields chosen in the field bar.
 */
import { l } from '../i18n'
import { ProductQuality } from '../quality/QualityPanel'
import ThemeLayout from '../politik/ThemeLayout'
import Bars from '../politik/Bars'
import { Select } from '../politik/controls'
import { useViewParams } from '../politik/useViewParams'
import { EMPLOYMENT_EN, HOURS_EN } from '../jobs/JobMarketPage'
import { HeatTable, MonthColumns, SmallMultiples } from './charts'
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
import type { JobsTheme, ThemeProps } from './JobsProduct'

const SOURCES = [
  {
    name: 'Arbetsförmedlingen, JobTech: historiska annonser',
    url: 'https://data.arbetsformedlingen.se/annonser/historiska/',
  },
]

function context(data: Market, fields: string[]) {
  const latest = data.latest_year
  const previous = latest - 1
  const period = `${ytdLabel(data.ytd_months)} ${latest}`
  const names = fields.map((id) =>
    fieldName(data.fields.find((f) => f.id === id)?.name ?? id),
  )
  const scope = fields.length
    ? names.join(', ')
    : l('the whole market', 'hela marknaden')
  return { latest, previous, period, scope }
}

/** Years as columns: full years, and the latest as its months so far. */
const yearColumns = (data: Market) =>
  data.years.map((y) => ({
    key: String(y),
    label: y === data.latest_year && data.ytd_months < 12 ? `${y}*` : String(y),
  }))

function Trender({ route, data, fields }: ThemeProps) {
  const [view, setView] = useViewParams(route, { diagram: 'manad' })
  const { latest, previous, period, scope } = context(data, fields)
  const monthly = monthlyAds(data, fields)
  const now = yearAds(data, fields, latest)
  const before = yearAds(data, fields, previous)
  const peak = [...monthly].sort((a, b) => b[1] - a[1])[0]
  // Small multiples: the chosen fields, or the six largest when none are chosen.
  const size = (id: string) => yearAds(data, [id], latest)
  const multipleFields = fields.length
    ? fields
    : [...data.fields]
        .sort((a, b) => size(b.id) - size(a.id))
        .slice(0, 6)
        .map((f) => f.id)
  const multiples = multipleFields.map((id) => {
    const a = yearAds(data, [id], latest)
    const b = yearAds(data, [id], previous)
    return {
      key: id,
      name: fieldName(data.fields.find((f) => f.id === id)?.name ?? id),
      months: monthlyAds(data, [id]),
      value: number(a),
      change: signedPct(change(a, b)),
    }
  })
  const perField = view.diagram === 'omraden'
  return (
    <ThemeLayout
      question={l(
        'How are job ads developing?',
        'Hur utvecklas jobbannonserna?',
      )}
      why={l(
        'New ads are the earliest sign of where employers want to hire, long before statistics on employment arrive.',
        'Nya annonser är den tidigaste signalen om var arbetsgivare vill anställa, långt innan statistiken om sysselsättning kommer.',
      )}
      kpis={[
        ...(peak
          ? [
              {
                value: number(peak[1]),
                label: l(
                  `the most in one month: ${monthShort(peak[0])}`,
                  `flest på en månad: ${monthShort(peak[0])}`,
                ),
              },
            ]
          : []),
      ]}
      filters={
        <Select
          label={l('Chart', 'Diagram')}
          value={perField ? 'omraden' : 'manad'}
          options={[
            {
              value: 'manad',
              label: l('All together, per month', 'Samlat, per månad'),
            },
            {
              value: 'omraden',
              label: l('One chart per field', 'Ett diagram per område'),
            },
          ]}
          onChange={(diagram) => setView({ diagram })}
        />
      }
      chartTitle={
        perField
          ? l(
              'Ads per month, one chart per field',
              'Annonser per månad, ett diagram per område',
            )
          : l(`New ads per month, ${scope}`, `Nya annonser per månad, ${scope}`)
      }
      chartMeta={l(
        `Number of ads · ${monthShort(monthly[0]?.[0] ?? '2020-01')}–${monthShort(data.last_month)}${perField ? ' · each chart on its own scale; value and change for ' + period : ''}`,
        `Antal annonser · ${monthShort(monthly[0]?.[0] ?? '2020-01')}–${monthShort(data.last_month)}${perField ? ' · varje diagram har egen skala; värde och förändring för ' + period : ''}`,
      )}
      chart={
        perField ? (
          <SmallMultiples
            series={multiples}
            note={
              fields.length
                ? undefined
                : l(
                    'The six largest fields. Choose fields in the bar above to compare others.',
                    'De sex största områdena. Välj områden i raden ovanför för att jämföra andra.',
                  )
            }
          />
        ) : (
          <MonthColumns
            months={monthly}
            highlight={`${latest}-01`}
            height={280}
            label={l(
              `New job ads per month, ${scope}`,
              `Nya jobbannonser per månad, ${scope}`,
            )}
          />
        )
      }
      takeaway={l(
        `${number(now)} ads in ${period}, ${signedPct(change(now, before))} against the same months of ${previous}.`,
        `${number(now)} annonser ${period}, ${signedPct(change(now, before))} mot samma månader ${previous}.`,
      )}
      meaning={
        <p>
          {l(
            'Each column is the ads published that month. Ads follow the seasons, with more in spring, so compare a month with the same month a year earlier rather than with the month before.',
            'Varje stapel är de annonser som publicerades den månaden. Annonserna följer säsongen, med fler på våren, så jämför en månad med samma månad året innan snarare än med månaden före.',
          )}
        </p>
      }
      table={
        <HeatTable
          rows={(fields.length ? fields : data.fields.map((f) => f.id)).map(
            (id) => ({
              key: id,
              label: fieldName(
                data.fields.find((f) => f.id === id)?.name ?? id,
              ),
            }),
          )}
          columns={yearColumns(data)}
          value={(id, year) =>
            yearAds(data, [id], Number(year), Number(year) === latest)
          }
          format={number}
          caption={l(
            'Ads per field and year (* months so far)',
            'Annonser per område och år (* månader hittills)',
          )}
        />
      }
      sources={SOURCES}
      updated={monthShort(data.last_month)}
      method={<p>{data.method}</p>}
      deepLinks={[
        {
          href: '#job-market',
          label: l(
            'Every field, month by month',
            'Alla områden, månad för månad',
          ),
        },
      ]}
    />
  )
}

function Yrken({ route, data, fields }: ThemeProps) {
  const [view, setView] = useViewParams(route, {
    minsta: '100',
    ordning: 'vaxer',
  })
  const { latest, previous, period, scope } = context(data, fields)
  const floor = Number(view.minsta)
  const rows = occupationsIn(data, fields)
    .map((o) => ({
      ...o,
      now: o.ytd[String(latest)] ?? 0,
      before: o.ytd[String(previous)] ?? 0,
    }))
    .filter((o) => o.before >= floor || o.now >= floor)
    .map((o) => ({ ...o, change: change(o.now, o.before) }))
  // Growth is measured only for occupations that were already this large a year ago, as on
  // the dashboard, so a small occupation cannot top the list on a few ads.
  const byChange = rows
    .filter((o) => o.before >= floor)
    .filter((o) => o.change != null)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
  const shown =
    view.ordning === 'storst'
      ? [...rows].sort((a, b) => b.now - a.now).slice(0, 15)
      : view.ordning === 'minskar'
        ? byChange.slice(-15).reverse()
        : byChange.slice(0, 15)
  const count = view.ordning === 'storst'
  return (
    <ThemeLayout
      question={l('Which occupations are growing?', 'Vilka yrken växer?')}
      why={l(
        'The fields hide large differences: within one field some occupations are hiring more while others shrink.',
        'Områdena döljer stora skillnader: inom samma område kan vissa yrken annonsera mer medan andra krymper.',
      )}
      kpis={[
        ...(byChange.at(-1)
          ? [
              {
                value: signedPct(byChange.at(-1)!.change),
                label: l(
                  `${byChange.at(-1)!.name}, the largest fall`,
                  `${byChange.at(-1)!.name}, störst minskning`,
                ),
              },
            ]
          : []),
        {
          value: number(rows.length),
          label: l(
            `occupations with ${floor}+ ads, ${scope}`,
            `yrken med minst ${floor} annonser, ${scope}`,
          ),
        },
      ]}
      filters={
        <>
          <Select
            label={l('Show', 'Visa')}
            value={view.ordning}
            options={[
              { value: 'vaxer', label: l('Growing the most', 'Växer mest') },
              {
                value: 'minskar',
                label: l('Falling the most', 'Minskar mest'),
              },
              { value: 'storst', label: l('Most ads', 'Flest annonser') },
            ]}
            onChange={(ordning) => setView({ ordning })}
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
        </>
      }
      chartTitle={
        count
          ? l(
              `Occupations with the most ads, ${scope}`,
              `Yrken med flest annonser, ${scope}`,
            )
          : l(
              `Change in ads per occupation, ${scope}`,
              `Förändring i annonser per yrke, ${scope}`,
            )
      }
      chartMeta={
        count
          ? l(`Number of ads · ${period}`, `Antal annonser · ${period}`)
          : l(
              `${period} against the same months of ${previous} · number of ads after the bar`,
              `${period} mot samma månader ${previous} · antal annonser efter stapeln`,
            )
      }
      chart={
        <Bars
          bars={shown.map((o) => ({
            key: o.id,
            label: o.name,
            value: count ? o.now : (o.change ?? 0),
            note: count
              ? signedPct(o.change)
              : `${number(o.now)} ${l('ads', 'annonser')}`,
          }))}
          format={count ? number : (v) => signedPct(v)}
          description={l(
            'Occupations and their ads',
            'Yrken och deras annonser',
          )}
          neutral="#3a3b3f"
        />
      }
      takeaway={
        byChange[0]
          ? l(
              `${byChange[0].name} grew the most: ${number(byChange[0].before)} → ${number(byChange[0].now)} ads.`,
              `${byChange[0].name} ökade mest: ${number(byChange[0].before)} → ${number(byChange[0].now)} annonser.`,
            )
          : ''
      }
      meaning={
        <p>
          {l(
            'An occupation is an SSYK group, the classification Statistics Sweden and Arbetsförmedlingen use. Small occupations swing a lot in per cent, so the smallest are left out; change the limit above.',
            'Ett yrke är en SSYK-grupp, den indelning SCB och Arbetsförmedlingen använder. Små yrken svänger mycket i procent, så de minsta är bortvalda; ändra gränsen ovanför.',
          )}
        </p>
      }
      table={
        <table className="data-table">
          <caption className="visually-hidden">
            {l('Ads per occupation and year', 'Annonser per yrke och år')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Occupation', 'Yrke')}</th>
              {data.years.map((y) => (
                <th scope="col" key={y}>
                  {y === latest && data.ytd_months < 12 ? `${y}*` : y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => b.now - a.now)
              .map((o) => (
                <tr key={o.id}>
                  <th scope="row">{o.name}</th>
                  {data.years.map((y) => (
                    <td key={y}>
                      {number((y === latest ? o.ytd : o.ads)[String(y)] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      }
      sources={SOURCES}
      updated={monthShort(data.last_month)}
      method={<p>{data.method}</p>}
      deepLinks={[
        {
          href: '#job-market-occupations',
          label: l(
            'Every occupation, with its own chart',
            'Alla yrken, med eget diagram',
          ),
        },
        {
          href: '#job-market-tech',
          label: l('Tech in data and IT ads', 'Teknik i data- och IT-annonser'),
        },
      ]}
    />
  )
}

function Lan({ route, data, fields }: ThemeProps) {
  const [view, setView] = useViewParams(route, { ar: '' })
  const { latest, previous, period, scope } = context(data, fields)
  const year = data.years.includes(Number(view.ar)) ? Number(view.ar) : latest
  const ytd = year === latest
  const counties = countyAds(data, fields, year, ytd)
  const before = countyAds(data, fields, year - 1, ytd)
  const total = counties.reduce((s, c) => s + c.ads, 0)
  const rows = counties
    .map((c) => ({
      ...c,
      change: change(c.ads, before.find((b) => b.region === c.region)?.ads),
    }))
    .sort((a, b) => b.ads - a.ads)
  const top3 = rows.slice(0, 3).reduce((s, c) => s + c.ads, 0)
  const grew = rows
    .filter((c) => c.change != null && c.region !== 'Okänt län')
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0]
  const label = ytd ? period : String(year)
  return (
    <ThemeLayout
      question={l('Where are the jobs?', 'Var finns jobben?')}
      why={l(
        'Most ads are in the three metropolitan counties, but the growth is not always there.',
        'De flesta annonserna finns i de tre storstadslänen, men ökningen finns inte alltid där.',
      )}
      kpis={[
        {
          value: share(pctOf(top3, total)),
          label: l('in the three largest counties', 'i de tre största länen'),
        },
        ...(grew
          ? [
              {
                value: signedPct(grew.change),
                label: l(
                  `${grew.region}, the best change on ${year - 1}`,
                  `${grew.region}, bäst utveckling mot ${year - 1}`,
                ),
              },
            ]
          : []),
      ]}
      filters={
        <Select
          label={l('Year', 'År')}
          value={String(year)}
          options={[...data.years].reverse().map((y) => ({
            value: String(y),
            label:
              y === latest && data.ytd_months < 12
                ? `${y} (${ytdLabel(data.ytd_months)})`
                : String(y),
          }))}
          onChange={(ar) => setView({ ar })}
        />
      }
      chartTitle={l(`Ads per county, ${scope}`, `Annonser per län, ${scope}`)}
      chartMeta={l(
        `Share of the ads · ${label} · change against the year before`,
        `Andel av annonserna · ${label} · förändring mot året innan`,
      )}
      chart={
        <Bars
          bars={rows.map((c) => ({
            key: c.region,
            label: c.region,
            value: pctOf(c.ads, total),
            note: `${number(c.ads)} · ${signedPct(c.change)}`,
          }))}
          format={(v) => share(v, 1)}
          description={l(
            'Share of ads per county',
            'Andel av annonserna per län',
          )}
          neutral="#3a3b3f"
        />
      }
      takeaway={
        rows[0]
          ? l(
              `${rows[0].region} had ${share(pctOf(rows[0].ads, total), 1)} of the ads in ${label}.`,
              `${rows[0].region} hade ${share(pctOf(rows[0].ads, total), 1)} av annonserna ${label}.`,
            )
          : ''
      }
      meaning={
        <p>
          {l(
            `The county is where the workplace is. Ads without a workplace county are left out. Changes compare with ${previous} over the same months.`,
            `Länet är där arbetsplatsen ligger. Annonser utan arbetsplatslän räknas inte. Förändringen jämför med samma månader året innan.`,
          )}
        </p>
      }
      table={
        <HeatTable
          rows={rows.map((c) => ({ key: c.region, label: c.region }))}
          columns={yearColumns(data)}
          value={(region, y) =>
            countyAds(data, fields, Number(y), Number(y) === latest).find(
              (c) => c.region === region,
            )?.ads
          }
          format={number}
          caption={l(
            'Ads per county and year (* months so far)',
            'Annonser per län och år (* månader hittills)',
          )}
        />
      }
      sources={SOURCES}
      updated={monthShort(data.last_month)}
      method={<p>{data.method}</p>}
      deepLinks={[
        {
          href: '#job-market-regions',
          label: l(
            'Every county, field by field',
            'Alla län, område för område',
          ),
        },
      ]}
    />
  )
}

function Villkor({ route, data, fields }: ThemeProps) {
  const [view, setView] = useViewParams(route, { ar: '' })
  const { latest, scope } = context(data, fields)
  const year = data.years.includes(Number(view.ar)) ? Number(view.ar) : latest
  const now = conditionsOf(data, fields, year)
  const before = conditionsOf(data, fields, year - 1)
  const total = (r: Record<string, number>) =>
    Object.values(r).reduce((s, v) => s + v, 0)
  const bars = (part: 'employment' | 'hours', names: Record<string, string>) =>
    Object.entries(now[part])
      .sort((a, b) => b[1] - a[1])
      .map(([name, v]) => ({
        key: `${part}-${name}`,
        label: l(names[name] ?? name, name),
        value: pctOf(v, total(now[part])),
        note: `${signedPct(pctOf(v, total(now[part])) - pctOf(before[part][name] ?? 0, total(before[part])), 1).replace(' %', '')} ${l('pts', 'p.e.')}`,
      }))
  const experience = pctOf(
    now.experience['yes'] ?? 0,
    (now.experience['yes'] ?? 0) + (now.experience['no'] ?? 0),
  )
  const fullTime = pctOf(now.hours['Heltid'] ?? 0, total(now.hours))
  const regular = pctOf(
    now.employment['Vanlig anställning'] ?? 0,
    total(now.employment),
  )
  const all = [
    ...bars('employment', EMPLOYMENT_EN),
    ...bars('hours', HOURS_EN),
    {
      key: 'experience',
      label: l('Experience required', 'Erfarenhet krävs'),
      value: experience,
      note: '',
    },
  ]
  return (
    <ThemeLayout
      question={l(
        'On what terms are people hired?',
        'På vilka villkor anställs man?',
      )}
      why={l(
        'The number of ads says how much employers hire; the terms say what kind of jobs they are.',
        'Antalet annonser säger hur mycket arbetsgivare anställer; villkoren säger vilka slags jobb det är.',
      )}
      kpis={[
        {
          value: share(regular),
          label: l('regular employment', 'vanlig anställning'),
        },
        {
          value: share(experience),
          label: l('require experience', 'kräver erfarenhet'),
        },
      ]}
      filters={
        <Select
          label={l('Year', 'År')}
          value={String(year)}
          options={[...data.years]
            .reverse()
            .map((y) => ({ value: String(y), label: String(y) }))}
          onChange={(ar) => setView({ ar })}
        />
      }
      chartTitle={l(
        `Terms in the ads, ${scope}`,
        `Villkor i annonserna, ${scope}`,
      )}
      chartMeta={l(
        `Share of the ads · ${year} · change in points against ${year - 1}`,
        `Andel av annonserna · ${year} · förändring i procentenheter mot ${year - 1}`,
      )}
      chart={
        <Bars
          bars={all}
          format={(v) => share(v)}
          description={l('Terms in the ads', 'Villkor i annonserna')}
          neutral="#3a3b3f"
        />
      }
      takeaway={l(
        `${share(fullTime)} of the ads stating hours offered full time in ${year}.`,
        `${share(fullTime)} av annonserna med arbetstid gällde heltid ${year}.`,
      )}
      meaning={
        <p>
          {l(
            'Employment type and working hours are as the employer entered them in the ad; "not stated" means the field was empty.',
            'Anställningsform och arbetstid är så som arbetsgivaren fyllt i annonsen; ”okänd” betyder att fältet var tomt.',
          )}
        </p>
      }
      table={
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{l('Term', 'Villkor')}</th>
              {data.years.map((y) => (
                <th key={y} scope="col">
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['employment', 'hours'] as const).flatMap((part) =>
              Object.keys(now[part]).map((name) => (
                <tr key={`${part}-${name}`}>
                  <th scope="row">
                    {l(
                      (part === 'employment' ? EMPLOYMENT_EN : HOURS_EN)[
                        name
                      ] ?? name,
                      name,
                    )}
                  </th>
                  {data.years.map((y) => {
                    const c = conditionsOf(data, fields, y)[part]
                    return (
                      <td key={y}>{share(pctOf(c[name] ?? 0, total(c)))}</td>
                    )
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      }
      sources={SOURCES}
      updated={monthShort(data.last_month)}
      method={<p>{data.method}</p>}
      deepLinks={[
        {
          href: '#job-market-conditions',
          label: l('Terms field by field', 'Villkor område för område'),
        },
      ]}
    />
  )
}

function Utforska() {
  const rows: [string, string, string, string, string][] = [
    [
      '#job-market',
      'Every field, month by month',
      'Alla områden, månad för månad',
      'The original overview with its own filters and indexed comparisons.',
      'Den ursprungliga översikten med egna filter och indexerade jämförelser.',
    ],
    [
      '#job-market-occupations',
      'Every occupation',
      'Alla yrken',
      'Search any of the 400 occupation groups and follow it year by year.',
      'Sök bland 400 yrkesgrupper och följ dem år för år.',
    ],
    [
      '#job-market-regions',
      'Every county',
      'Alla län',
      'Ads per county and field since 2020.',
      'Annonser per län och område sedan 2020.',
    ],
    [
      '#job-market-conditions',
      'Terms field by field',
      'Villkor område för område',
      'Employment type, hours and experience per field.',
      'Anställningsform, arbetstid och erfarenhet per område.',
    ],
    [
      '#jobb-kluster',
      'Semantic clusters of IT ads',
      'Semantiska kluster i IT-annonser',
      'Groups found in the ad texts by embeddings, UMAP and HDBSCAN, compared with job titles.',
      'Grupper som embeddings, UMAP och HDBSCAN hittar i annonstexterna, jämförda med jobbtitlarna.',
    ],
    [
      '#job-market-tech',
      'Tech in data and IT ads',
      'Teknik i data- och IT-annonser',
      'Which tools and languages data and IT ads ask for, and junior roles.',
      'Vilka verktyg och språk data- och IT-annonser efterfrågar, och juniora roller.',
    ],
  ]
  return (
    <article className="theme">
      <header className="theme-head">
        <h1 className="theme-question">
          {l('Explore for yourself', 'Utforska själv')}
        </h1>
        <p className="theme-why">
          {l(
            'Every detailed view of the job-market data.',
            'Alla detaljerade vyer av jobbmarknadsdatan.',
          )}
        </p>
      </header>
      <div className="explore-list">
        {rows.map(([href, en, sv, den, dsv]) => (
          <a key={href} className="explore-row" href={href}>
            <strong>{l(en, sv)}</strong>
            <small>{l(den, dsv)}</small>
          </a>
        ))}
      </div>
    </article>
  )
}

function Kallor({ data }: { data: Market }) {
  return (
    <article className="theme">
      <header className="theme-head">
        <h1 className="theme-question">
          {l('Sources and method', 'Källor och metod')}
        </h1>
        <p className="theme-why">{data.method}</p>
      </header>
      <section className="sources-block">
        <h2>{l('The archives counted', 'Arkiven som räknats')}</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{l('Archive', 'Arkiv')}</th>
              <th scope="col">{l('Ads', 'Annonser')}</th>
              <th scope="col">SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {data.archives.map((a) => (
              <tr key={a.archive}>
                <th scope="row">
                  <a href={a.source_url} target="_blank" rel="noreferrer">
                    {a.archive} ↗
                  </a>
                </th>
                <td>{number(a.ads)}</td>
                <td>
                  <code>{a.sha256.slice(0, 16)}…</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ds-small">
          {l(
            `Built ${data.generated_at.slice(0, 10)} from Arbetsförmedlingen's open archives with dbt; ${data.fields.length} occupation fields, ${number(data.occupations.length)} occupation groups.`,
            `Byggd ${data.generated_at.slice(0, 10)} ur Arbetsförmedlingens öppna arkiv med dbt; ${data.fields.length} yrkesområden, ${number(data.occupations.length)} yrkesgrupper.`,
          )}
        </p>
      </section>
      <ProductQuality product="jobs" />
    </article>
  )
}

export default function Themes(props: ThemeProps & { theme: JobsTheme }) {
  switch (props.theme) {
    case 'trender':
      return <Trender {...props} />
    case 'yrken':
      return <Yrken {...props} />
    case 'lan':
      return <Lan {...props} />
    case 'villkor':
      return <Villkor {...props} />
    case 'kallor':
      return <Kallor data={props.data} />
    default:
      return <Utforska />
  }
}
