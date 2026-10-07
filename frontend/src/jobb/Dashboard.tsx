/**
 * Läget på jobbmarknaden, told as a demand story: is demand rising or falling (the change
 * against the same months a year earlier, and ads per month as the one main chart), which
 * occupations are growing, and where the semantic clustering fits. The treemap, counties and
 * terms of employment are one click deeper under Explore. Every chart answers for the fields
 * chosen in the field bar; the latest year is partial, so every change compares the same months
 * of the year before.
 */
import { lazy, Suspense, type ReactNode } from 'react'
import { TraceResult } from '../ui/Trace'
import { l } from '../i18n'
import type { Route } from '../router'
import { useViewParams } from '../politik/useViewParams'
import { Select } from '../politik/controls'
import RankBars from '../charts/RankBars'
import { MonthColumns } from './charts'
import FieldRanking from './FieldRanking'
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
import { ProjectHero } from '../ui/Project'
import {
  ChartSection,
  DataQuestion,
  ExploreSection,
  Interpretation,
  MethodSummary,
  SourceCaption,
} from '../ui/Story'

const ClusterPreview = lazy(() => import('../jobs/ClusterPreview'))

const SLICERS = { period: '36', jamfor: 'ytd', minsta: '100' }

export default function Dashboard({
  route,
  data,
  fields,
  slicer,
}: {
  route: Route
  data: Market
  fields: string[]
  /** The field bar, placed under the first screen rather than above it. */
  slicer?: ReactNode
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
  const monthly = monthlyAds(data, fields)
  const shown =
    view.period === 'alla' ? monthly : monthly.slice(-Number(view.period))

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

  const delta = change(now, before)
  const direction =
    delta == null
      ? null
      : delta > 0
        ? l('more', 'fler')
        : delta < 0
          ? l('fewer', 'färre')
          : l('as many', 'lika många')
  const source = (definition?: string) => (
    <SourceCaption
      source="Arbetsförmedlingen, JobTech"
      period={l(
        `to ${monthShort(data.last_month)}`,
        `till och med ${monthShort(data.last_month)}`,
      )}
      definition={definition}
    />
  )

  return (
    <div className="jobb-story">
      <ProjectHero
        project="jobs"
        finding={
          <>
            <b>{signedPct(delta)}</b>{' '}
            {direction
              ? l(
                  `${number(now)} new ads in ${period}: ${direction} than in the same months of ${previous}.`,
                  `${number(now)} nya annonser ${period}: ${direction} än samma månader ${previous}.`,
                )
              : l(
                  `${number(now)} new ads in ${period}.`,
                  `${number(now)} nya annonser ${period}.`,
                )}
          </>
        }
        findingLabel={l('Latest', 'Senast')}
        nav={[
          { href: '#jobb', label: l('Overview', 'Översikt'), current: true },
          {
            href: withFields('#jobb-trender', fields),
            label: l('Trends', 'Trender'),
          },
          {
            href: withFields('#jobb-yrken', fields),
            label: l('Occupations', 'Yrken'),
          },
          { href: withFields('#jobb-lan', fields), label: l('Regions', 'Län') },
          {
            href: withFields('#jobb-utforska', fields),
            label: l('Explore', 'Utforska'),
          },
          {
            href: withFields('#jobb-kallor', fields),
            label: l('Sources', 'Källor'),
          },
        ]}
      >
        <p>
          {l(
            `Every job ad published through Arbetsförmedlingen since 2020, read as a measure of demand: new ads in ${scope}, compared with the same months a year earlier.`,
            `Varje jobbannons som publicerats via Arbetsförmedlingen sedan 2020, läst som ett mått på efterfrågan: nya annonser för ${scope}, jämförda med samma månader året innan.`,
          )}
        </p>
        {source(
          l(
            'an ad without a number of vacancies counts as one',
            'en annons utan antal platser räknas som en',
          ),
        )}
      </ProjectHero>
      {slicer}

      <ChartSection
        level={2}
        question={l(
          'Is it a dip or a trend?',
          'Är det en svacka eller en trend?',
        )}
        title={l(
          `Ads per month, ${latest} against the years before`,
          `Annonser per månad, ${latest} mot åren innan`,
        )}
        subtitle={l(
          `New ads per month · ${scope} · ${latest} darker`,
          `Nya annonser per månad · ${scope} · ${latest} mörkare`,
        )}
        source={source()}
      >
        <div className="jobb-chart-controls">
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
        </div>
        <MonthColumns
          months={shown}
          highlight={`${latest}-01`}
          label={l(
            `New job ads per month, ${scope}: ${number(now)} in ${period}, ${signedPct(delta)} against the same months of ${previous}`,
            `Nya jobbannonser per månad, ${scope}: ${number(now)} ${period}, ${signedPct(delta)} mot samma månader ${previous}`,
          )}
        />
      </ChartSection>

      <Interpretation
        notMeaning={l(
          'Ads are a proxy for demand, not the whole labour market: an ad is not a hire, many jobs are filled without one, and some ads are for several vacancies.',
          'Annonser är ett mått på efterfrågan, inte hela arbetsmarknaden: en annons är inte en anställning, många jobb tillsätts utan annons och vissa annonser gäller flera platser.',
        )}
      >
        <p>
          {l(
            'The comparison always uses the same months of the year before, because the latest year is not complete and job ads follow the seasons. Choose fields in the bar above to see whether the change is broad or carried by a few fields.',
            'Jämförelsen görs alltid mot samma månader året innan, eftersom det senaste året inte är komplett och annonserna följer årstiderna. Välj områden i raden ovanför för att se om förändringen är bred eller bärs av några få områden.',
          )}
        </p>
      </Interpretation>
      <TraceResult
        node="out:jobs/market.json"
        what={l('the ads per month', 'annonserna per månad')}
      />

      <section className="jobb-story-section" aria-labelledby="jobb-growing">
        <DataQuestion
          id="jobb-growing"
          number={2}
          eyebrow={l('Occupations', 'Yrken')}
          question={l('Which roles are growing?', 'Vilka yrken växer?')}
        />
        <ChartSection
          title={
            growers[0]
              ? l(
                  `${growers[0].name} grew the most, ${signedPct(growers[0].change)}`,
                  `${growers[0].name} växte mest, ${signedPct(growers[0].change)}`,
                )
              : l('Occupations growing the most', 'Yrken som växer mest')
          }
          subtitle={l(
            `Change in ads, ${period} against the same months of ${previous} · occupations with ${floor}+ ads a year ago`,
            `Förändring i annonser, ${period} mot samma månader ${previous} · yrken med minst ${floor} annonser i fjol`,
          )}
          finding={
            top &&
            l(
              `Most ads overall: ${top.name}, ${number(top.ytd[String(latest)] ?? 0)}.`,
              `Flest annonser totalt: ${top.name}, ${number(top.ytd[String(latest)] ?? 0)}.`,
            )
          }
          source={source()}
        >
          <div className="jobb-chart-controls">
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
          {growers.length ? (
            <RankBars
              rows={growers.map((o) => ({
                key: o.id,
                label: o.name,
                value: o.change,
                note: ` ${number(o.now)}`,
              }))}
              format={(v) => signedPct(v)}
              label={l('Occupations growing the most', 'Yrken som växer mest')}
            />
          ) : (
            <p className="dash-empty">
              {l(
                'No occupation this large in the chosen fields.',
                'Inget så stort yrke i valda områden.',
              )}
            </p>
          )}
        </ChartSection>
        <p className="jobb-story-more">
          <a href={withFields('#jobb-yrken', fields)}>
            {l(
              'Every occupation, growing and falling',
              'Alla yrken, växande och minskande',
            )}
          </a>
        </p>
      </section>

      <section className="jobb-story-section" aria-labelledby="jobb-groups">
        <DataQuestion
          id="jobb-groups"
          number={3}
          eyebrow={l('Machine learning', 'Maskininlärning')}
          question={l(
            'Do job ads form natural groups beyond their official titles?',
            'Bildar jobbannonserna naturliga grupper bortom de officiella yrkestitlarna?',
          )}
        >
          <p>
            {l(
              'IT ads are embedded by their text and grouped without labels; each dot is one real ad, and ads that are written alike sit close together. The groups are then compared with the job titles the employers chose.',
              'IT-annonser bäddas in efter sin text och grupperas utan etiketter; varje prick är en verklig annons, och annonser som är skrivna på liknande sätt hamnar nära varandra. Grupperna jämförs sedan med yrkestitlarna arbetsgivarna valde.',
            )}
          </p>
        </DataQuestion>
        <Suspense fallback={null}>
          <ClusterPreview />
        </Suspense>
        <p className="jobb-story-more">
          <a href="#jobb-kluster">
            {l(
              'The groups and what separates them',
              'Grupperna och vad som skiljer dem',
            )}
          </a>
        </p>
      </section>

      <ExploreSection
        id="jobb-utforska-mer"
        summary={l(
          'Every field ranked, where the jobs are, and on what terms.',
          'Varje område rangordnat, var jobben finns och på vilka villkor.',
        )}
      >
        <FieldRanking data={data} fields={fields} />
        <ChartSection
          title={
            counties[0]
              ? l(
                  `${counties[0].region} has ${share(pctOf(counties[0].ads, countyTotal))} of the ads`,
                  `${counties[0].region} har ${share(pctOf(counties[0].ads, countyTotal))} av annonserna`,
                )
              : l('Where the jobs are', 'Var jobben finns')
          }
          subtitle={l(
            `Share of ads per county · ${period}`,
            `Andel av annonserna per län · ${period}`,
          )}
          source={source()}
        >
          <RankBars
            rows={counties.slice(0, 6).map((c) => ({
              key: c.region,
              label: c.region,
              value: pctOf(c.ads, countyTotal),
            }))}
            format={(v) => share(v, 1)}
            label={l('Share of ads per county', 'Andel av annonserna per län')}
          />
          <p className="jobb-story-more">
            <a href={withFields('#jobb-lan', fields)}>
              {l('Every county', 'Alla län')}
            </a>
          </p>
        </ChartSection>
        <ChartSection
          title={l('On what terms', 'På vilka villkor')}
          subtitle={l(
            `Share of ads ${latest} · tick: ${previous}`,
            `Andel av annonserna ${latest} · streck: ${previous}`,
          )}
          source={source()}
        >
          <RankBars
            rows={conditionBars.map((c) => ({
              ...c,
            }))}
            format={(v) => share(v)}
            max={100}
            label={l('Terms of employment', 'Anställningsvillkor')}
          />
          <p className="jobb-story-more">
            <a href={withFields('#jobb-villkor', fields)}>
              {l(
                'Employment type, hours and experience',
                'Anställningsform, arbetstid och erfarenhet',
              )}
            </a>
          </p>
        </ChartSection>
      </ExploreSection>

      <MethodSummary
        lineage={[
          'JobTech',
          l('Python ingestion', 'inläsning i Python'),
          'dbt + DuckDB',
          'JSON',
          'React',
        ]}
        quality={l(
          'Job ads are a proxy for demand, not the entire labour market. Every archive counted is recorded with its SHA-256, and months are only compared when complete.',
          'Jobbannonser är ett mått på efterfrågan, inte hela arbetsmarknaden. Varje räknat arkiv registreras med sin SHA-256, och månader jämförs bara när de är kompletta.',
        )}
        more={[
          {
            href: '#jobb-kallor',
            label: l('Sources and method', 'Källor och metod'),
          },
        ]}
      />
    </div>
  )
}
