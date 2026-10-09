/**
 * The politics product's first page: one dashboard over the whole product (docs/mockups/SPEC.md,
 * "Svensk politik i siffror"). Every number is read from public/data: the overview and story
 * exports, SCB's polls, the election results, the session records, the budget, the taxes and
 * the debate statistics. The themes in the sidebar go deeper on each part.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { useData } from '../politics/data'
import { fetchJson } from '../welfare/data'
import { partyFill, partyLine, partyName } from '../parties/identity'
import type { RankRow } from '../charts/RankBars'
import RankBars from '../charts/RankBars'
import {
  BarsCard,
  ChartCard,
  DashGrid,
  DashHeader,
  DeepSection,
  Empty,
  GaugeCard,
  KpiRow,
  ListCard,
  Loading,
} from '../ui/dash/Dash'
import DotLine from '../ui/dash/DotLine'
import TechCard from '../ui/dash/TechCard'
import Explorer, { type Dataset, type Row } from '../ui/dash/Explorer'
import { useViewParams } from './useViewParams'

type Polls = {
  polls: { survey_month: string; party: string; share_pct: number }[]
}
type Elections = {
  years: number[]
  majority: number
  results: { election_year: number; party: string; seats: number }[]
}
type Sessions = {
  sessions: {
    session: string
    first_vote: string
    last_vote: string
    government_parties: string[]
  }[]
  party_pairs: {
    session: string
    party_a: string
    party_b: string
    comparable_roll_calls: number
    agreement_pct: number
  }[]
}
type Overview = {
  parliament: {
    issue_speeches: number
    issue_replies: number
    sessions: number
    first_date: string
    last_date: string
    analyzed_segments: number
    committee_points: number
    budget_frame_rows: number
  }
  sessions: { id: string; reservations: number }[]
  law_pools: Record<string, { documents: number; provisions: number }>
  meaning_tests: { passed: number; total: number }
}
type Story = { quality: { decision_points: number } }
type Wrapped<T> = { data: T[] }
type Outturn = {
  budget_year: number
  expenditure_area: number
  expenditure_area_name: string
  outturn_msek: number
}
type Taxes = {
  types: {
    tax_code: string
    name_sv: string
    name_en: string
    is_headline: boolean
  }[]
  rows: [number, string, number | null, number | null][]
  source: string
}
type DebateIndex = {
  sessions: {
    session: string
    path: string
    debates: number
    speeches: number
    replies: number
  }[]
}
type DebateStats = {
  session: string
  debates: {
    id: string
    title: string
    date: string
    speeches: number
    replies: number
    parties: Record<string, [number, number]>
    issues?: string[]
  }[]
}
type Vote = {
  vote_id: string
  designation: string
  party: string
  party_position: string
}
type Issues = {
  issues: { key: string; sv: string; en: string; committees: string[] }[]
  topics: {
    session: string
    parties: Record<
      string,
      { debates: number; utterances: number; topics: Record<string, number> }
    >
  }[]
}
type Topic = {
  topic_id: number
  topic_label: string
  word_share_pct: number
  segments: number
  is_unclustered: boolean
}
type Catalog = { files: { path: string; bytes: number }[] }

const locale = () => l('en-GB', 'sv-SE')
const num = (n: number) => n.toLocaleString(locale())
const dec = (n: number, d = 1) =>
  n.toLocaleString(locale(), {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
const pct = (n: number) => `${dec(n)} %`
const billions = (msek: number) => `${dec(msek / 1000)} ${l('bn SEK', 'md kr')}`
const month = (iso: string) =>
  new Date(iso).toLocaleDateString(locale(), {
    month: 'short',
    year: 'numeric',
  })
const slug = (session: string) => session.replace('/', '-')
/** "JuU2" → "JuU", "FöU3" → "FöU". */
const committeeOf = (designation: string) =>
  designation.match(/^\D+/)?.[0] ?? ''

export default function PolitikDash({ route }: { route: Route }) {
  const [view, setView] = useViewParams(route, {
    stod: 'S',
    ar: '',
    skatt: '_T',
    rm: '',
    sak: 'ekonomi',
  })
  const overview = useData<Overview>('overview.json')
  const story = useData<Story>('parliament/story.json')
  const polls = useData<Polls>('parliament/polls.json', '')
  const elections = useData<Elections>('parliament/elections.json', '')
  const sessions = useData<Sessions>('parliament/sessions.json', '')
  const catalog = useData<Catalog>('catalog.json')

  const o = overview.data
  const latest = sessions.data?.sessions.at(-1)
  const pm = latest?.government_parties[0]

  const pollPoints = useMemo(
    () =>
      (polls.data?.polls ?? [])
        .filter((p) => p.party === view.stod)
        .sort((a, b) => a.survey_month.localeCompare(b.survey_month))
        .map((p) => ({
          date: p.survey_month,
          label: month(p.survey_month),
          value: p.share_pct,
        })),
    [polls.data, view.stod],
  )
  const pollMonths = useMemo(
    () => [...new Set(polls.data?.polls.map((p) => p.survey_month))].sort(),
    [polls.data],
  )

  const seats = useMemo(() => {
    const e = elections.data
    if (!e) return null
    const [before, last] = e.years.slice(-2)
    const of = (year: number) =>
      new Map(
        e.results
          .filter((r) => r.election_year === year && r.party !== 'OTHER')
          .map((r) => [r.party, r.seats]),
      )
    return {
      last,
      before,
      now: of(last),
      then: of(before),
      majority: e.majority,
    }
  }, [elections.data])

  const kpis = [
    o && {
      label: l('Speeches in the model', 'Anföranden i modellen'),
      value: num(o.parliament.issue_speeches),
      note: l(
        `${o.parliament.sessions} sessions, ${month(o.parliament.first_date)} – ${month(o.parliament.last_date)}`,
        `${o.parliament.sessions} riksmöten, ${month(o.parliament.first_date)} – ${month(o.parliament.last_date)}`,
      ),
    },
    story.data &&
      o && {
        label: l(
          'Roll calls with party positions',
          'Voteringar med partiposition',
        ),
        value: num(story.data.quality.decision_points),
        note: l(
          `${o.sessions.map((s) => s.id).join(' and ')}, ${num(o.parliament.committee_points)} committee points`,
          `${o.sessions.map((s) => s.id).join(' och ')}, ${num(o.parliament.committee_points)} utskottspunkter`,
        ),
      },
    polls.data && {
      label: l('Opinion polls', 'Opinionsmätningar'),
      value: num(pollMonths.length),
      note: l(
        `SCB's party preference survey since ${month(pollMonths[0])}`,
        `SCB:s partisympatiundersökning sedan ${month(pollMonths[0])}`,
      ),
    },
  ].filter(Boolean) as { label: string; value: string; note: string }[]

  const pollParties = useMemo(
    () =>
      [...new Set(polls.data?.polls.map((p) => p.party))].filter(
        (p) => p !== 'OTHER' && p !== 'NYD',
      ),
    [polls.data],
  )

  const pairs = (sessions.data?.party_pairs ?? [])
    .filter(
      (p) =>
        p.session === latest?.session && (p.party_a === pm || p.party_b === pm),
    )
    .map((p) => {
      const other = p.party_a === pm ? p.party_b : p.party_a
      return {
        key: other,
        label: partyName(other),
        value: p.agreement_pct,
        party: other,
      } satisfies RankRow
    })
    .sort((a, b) => b.value - a.value)

  const datasets = useMemo(() => explorerDatasets(), [])
  const lastPoll = pollPoints.at(-1)

  return (
    <div className="dk">
      <DashHeader
        crumbs={[
          { label: l('Projects', 'Projekt'), href: '#projekt' },
          { label: l('Analytics engineering', 'Analytics engineering') },
        ]}
        title={l('Swedish politics in numbers', 'Svensk politik i siffror')}
        lead={l(
          'Open data from the Riksdag, SCB and the Election Authority in tested dbt models: roll calls, speeches, polls and elections, party by party.',
          'Öppna data från riksdagen, SCB och Valmyndigheten i testade dbt-modeller: voteringar, anföranden, opinionsmätningar och val, parti för parti.',
        )}
        status={
          latest
            ? {
                tone: 'ok',
                text: l(
                  `Latest session in the data: ${latest.session}, last roll call ${latest.last_vote}`,
                  `Senaste riksmöte i datan: ${latest.session}, sista votering ${latest.last_vote}`,
                ),
              }
            : undefined
        }
        code="https://github.com/korv9/anton-portfolio"
      />
      {kpis.length ? <KpiRow items={kpis} /> : <Loading />}
      <DashGrid>
        <ChartCard
          span={8}
          title={l('Support per poll', 'Väljarstöd per mätning')}
          sub={
            lastPoll &&
            l(
              `${partyName(view.stod)}, share in SCB's party preference survey, ${pollPoints[0].label} – ${lastPoll.label}.`,
              `${partyName(view.stod)}, andel i SCB:s partisympatiundersökning, ${pollPoints[0].label} – ${lastPoll.label}.`,
            )
          }
          slicer={{
            label: l('Party', 'Parti'),
            value: view.stod,
            options: pollParties.map((p) => ({
              value: p,
              label: `${partyName(p)} (${p})`,
            })),
            onChange: (stod) => setView({ stod }),
          }}
        >
          {pollPoints.length ? (
            <DotLine
              points={pollPoints}
              label={l(
                `Support for ${partyName(view.stod)}`,
                `Väljarstöd för ${partyName(view.stod)}`,
              )}
              format={(v) => `${dec(v)} %`}
              tick={(v) => `${v} %`}
              color={partyLine(view.stod)}
              height={260}
            />
          ) : polls.error ? (
            <Empty />
          ) : (
            <Loading />
          )}
        </ChartCard>
        {seats ? (
          <GaugeCard
            title={l(
              `The Riksdag after the ${seats.last} election`,
              `Riksdagen efter valet ${seats.last}`,
            )}
            sub={l(
              'Seats per party, fct_election',
              'Mandat per parti, fct_election',
            )}
            center={num([...seats.now.values()].reduce((a, b) => a + b, 0))}
            centerLabel={l('seats', 'mandat')}
            segments={[...seats.now]
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([party, value]) => ({
                key: party,
                label: party,
                value,
                color: partyFill(party),
              }))}
            foot={l(
              `A majority takes ${seats.majority} seats.`,
              `Majoritet kräver ${seats.majority} mandat.`,
            )}
          />
        ) : (
          <ChartCard span={4} title={l('The Riksdag', 'Riksdagen')}>
            <Loading />
          </ChartCard>
        )}
        <BarsCard
          title={
            seats
              ? l(
                  `Seats ${seats.before} to ${seats.last}`,
                  `Mandat ${seats.before} till ${seats.last}`,
                )
              : l('Seats', 'Mandat')
          }
          sub={l(
            'Change per party, fct_election',
            'Förändring per parti, fct_election',
          )}
          rows={
            seats
              ? [...seats.now]
                  .map(([party, v]) => ({
                    key: party,
                    label: partyName(party),
                    value: v - (seats.then.get(party) ?? 0),
                    text: signed(v - (seats.then.get(party) ?? 0)),
                    party,
                  }))
                  .sort((a, b) => b.value - a.value)
              : []
          }
          format={signed}
        />
        <TechCard
          span={8}
          sub={l(
            'Roll calls, positions and elections as dbt models in DuckDB; the site reads JSON exported from them.',
            'Voteringar, ställningstaganden och val som dbt-modeller i DuckDB; sajten läser JSON som exporteras ur dem.',
          )}
          fact="fct_party_roll_call"
          dims={['dim_parliament_session', 'dim_government']}
          marts={[
            'fct_roll_call',
            'mart_party_session_record',
            'mart_party_pair_session',
            'fct_party_poll',
            'fct_election',
          ]}
          steps={[
            {
              title: l('Ingest', 'Inläsning'),
              detail: l(
                'platform/ingest/run_parliament.py: roll calls, bills, studies and elections from the Riksdag, SCB and the Election Authority; run_taxes.py for the taxes.',
                'platform/ingest/run_parliament.py: voteringar, propositioner, utredningar och val från riksdagen, SCB och Valmyndigheten; run_taxes.py för skatterna.',
              ),
            },
            {
              title: 'dbt build',
              detail: l(
                'dbt build --select +tag:politics: bronze, silver and gold in DuckDB, with the tests.',
                'dbt build --select +tag:politics: brons, silver och guld i DuckDB, med testerna.',
              ),
            },
            {
              title: l('Export', 'Export'),
              detail: l(
                'platform/publish/export_parliament.py, export_politics.py, export_debates.py and export_taxes.py write the JSON under public/data.',
                'platform/publish/export_parliament.py, export_politics.py, export_debates.py och export_taxes.py skriver JSON under public/data.',
              ),
            },
            {
              title: 'R2',
              detail: l(
                'platform/publish/upload.py puts the large files on Cloudflare R2.',
                'platform/publish/upload.py lägger de stora filerna på Cloudflare R2.',
              ),
            },
          ]}
          runs={l(
            'Runs in GitHub Actions: "Build and store the warehouse" and "Publish to R2" are started by hand; the news refresh runs every day at 05:17 UTC.',
            'Körs i GitHub Actions: "Build and store the warehouse" och "Publish to R2" startas för hand; nyheterna hämtas varje dag kl. 05.17 UTC.',
          )}
        />
        <BarsCard
          title={
            pm
              ? l(`Votes like ${partyName(pm)}`, `Röstar som ${partyName(pm)}`)
              : '…'
          }
          sub={
            latest &&
            l(
              `Share of roll calls ${latest.session} where the party took the same position as ${pm}`,
              `Andel voteringar ${latest.session} där partiet tog samma ställning som ${pm}`,
            )
          }
          rows={pairs}
          format={pct}
          max={100}
        />
        <ListCard
          span={8}
          title={l('Delivered datasets', 'Levererade dataset')}
          sub={l(
            'What the site reads, per folder of politics/',
            'Det som sajten läser, per mapp i politics/',
          )}
          badge={
            catalog.data
              ? l(
                  `${num(catalog.data.files.length)} files in politics/catalog.json`,
                  `${num(catalog.data.files.length)} filer i politics/catalog.json`,
                )
              : undefined
          }
          items={catalogGroups(catalog.data)}
        />
      </DashGrid>
      <Deep view={view} setView={setView} overview={o} datasets={datasets} />
    </div>
  )
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

function catalogGroups(catalog: Catalog | null) {
  if (!catalog) return []
  const groups = new Map<string, { files: number; bytes: number }>()
  for (const f of catalog.files) {
    const parts = f.path.split('/')
    const key =
      parts.length > 2
        ? `${parts[0]}/${parts[1]}`
        : parts.length > 1
          ? parts[0]
          : f.path
    const g = groups.get(key) ?? { files: 0, bytes: 0 }
    g.files += 1
    g.bytes += f.bytes
    groups.set(key, g)
  }
  return [...groups]
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, 8)
    .map(([key, g]) => ({
      key,
      title: `politics/${key}`,
      meta: l(`${num(g.files)} files`, `${num(g.files)} filer`),
      value: `${dec(g.bytes / 1e6)} MB`,
    }))
}

function Deep({
  view,
  setView,
  overview: o,
  datasets,
}: {
  view: { ar: string; skatt: string; rm: string; sak: string }
  setView: (
    changes: Partial<{ ar: string; skatt: string; rm: string; sak: string }>,
  ) => void
  overview: Overview | null
  datasets: Dataset[]
}) {
  const outturn = useData<Wrapped<Outturn>>(
    'parliament/budgets/outturn-areas.json',
  )
  const taxes = useData<Taxes>('taxes/sweden.json', '')
  const debateIndex = useData<DebateIndex>('parliament/debate-stats/index.json')
  const issues = useData<Issues>('parliament/sakdebatter.json')
  const topics = useData<Wrapped<Topic>>('parliament/topics/summary.json')
  const decisions = useData<{ decisions: unknown[] }>(
    'taxes/decisions.json',
    '',
  )
  const municipalities = useData<{ year: number; municipalities: unknown[] }>(
    'taxes/municipalities.json',
    '',
  )
  const leaders = useData<Wrapped<unknown>>('parliament/debates/index.json')

  const years = [...new Set(outturn.data?.data.map((r) => r.budget_year))].sort(
    (a, b) => b - a,
  )
  const year = view.ar ? +view.ar : years[0]
  const budgetRows: RankRow[] = (outturn.data?.data ?? [])
    .filter((r) => r.budget_year === year)
    .sort((a, b) => b.outturn_msek - a.outturn_msek)
    .slice(0, 10)
    .map((r) => ({
      key: String(r.expenditure_area),
      label: `UO${r.expenditure_area} ${r.expenditure_area_name}`,
      value: r.outturn_msek,
    }))

  const sessionList = debateIndex.data?.sessions ?? []
  const session = view.rm || sessionList.at(-1)?.session || ''
  const stats = useData<DebateStats>(
    session ? `parliament/debate-stats/${slug(session)}.json` : null,
  )
  const speakers: RankRow[] = useMemo(() => {
    const sum = new Map<string, number>()
    for (const d of stats.data?.debates ?? [])
      for (const [p, [a, b]] of Object.entries(d.parties))
        sum.set(p, (sum.get(p) ?? 0) + a + b)
    return [...sum]
      .filter(([p]) => partyName(p) !== p)
      .sort((a, b) => b[1] - a[1])
      .map(([p, v]) => ({ key: p, label: partyName(p), value: v, party: p }))
  }, [stats.data])

  const [votes, setVotes] = useState<{
    session: string
    government: string
    rows: Vote[]
  } | null>(null)
  useEffect(() => {
    let live = true
    Promise.all([
      fetchJson<Sessions>('parliament/sessions.json'),
      fetchJson<Wrapped<Vote>>(
        'politics/parliament/sessions/2025-26/votes.json',
      ),
    ]).then(
      ([s, v]) => {
        const last = s.sessions.at(-1)!
        if (live)
          setVotes({
            session: last.session,
            government: last.government_parties[0],
            rows: v.data,
          })
      },
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [])
  const issueList = issues.data?.issues ?? []
  const withGovernment: RankRow[] = useMemo(() => {
    if (!votes) return []
    const issue = issueList.find((i) => i.key === view.sak)
    if (!issue) return []
    const rows = votes.rows.filter((v) =>
      issue.committees.includes(committeeOf(v.designation)),
    )
    const government = new Map(
      rows
        .filter((v) => v.party === votes.government)
        .map((v) => [v.vote_id, v.party_position]),
    )
    const tally = new Map<string, [number, number]>()
    for (const v of rows) {
      if (v.party === votes.government || !government.has(v.vote_id)) continue
      const t = tally.get(v.party) ?? [0, 0]
      t[0] += v.party_position === government.get(v.vote_id) ? 1 : 0
      t[1] += 1
      tally.set(v.party, t)
    }
    return [...tally]
      .map(([p, [same, all]]) => ({
        key: p,
        label: partyName(p),
        value: (100 * same) / all,
        note: l(`of ${all}`, `av ${all}`),
        party: p,
      }))
      .sort((a, b) => b.value - a.value)
  }, [votes, issueList, view.sak])
  const pointsInIssue = votes
    ? new Set(
        votes.rows
          .filter((v) =>
            issueList
              .find((i) => i.key === view.sak)
              ?.committees.includes(committeeOf(v.designation)),
          )
          .map((v) => v.vote_id),
      ).size
    : 0

  const taxTypes = taxes.data?.types.filter((t) => t.is_headline) ?? []
  const taxPoints = (taxes.data?.rows ?? [])
    .filter((r) => r[1] === view.skatt && r[2] != null)
    .map((r) => ({
      date: `${r[0]}-01-01`,
      label: String(r[0]),
      value: r[2] as number,
    }))
  const taxName = taxes.data?.types.find((t) => t.tax_code === view.skatt)
  const topicRows: RankRow[] = (topics.data?.data ?? [])
    .filter((t) => !t.is_unclustered)
    .sort((a, b) => b.word_share_pct - a.word_share_pct)
    .slice(0, 12)
    .map((t) => ({
      key: String(t.topic_id),
      label: t.topic_label,
      value: t.word_share_pct,
    }))
  const unclustered = topics.data?.data.find((t) => t.is_unclustered)

  const totalDebates = sessionList.reduce((s, x) => s + x.debates, 0)
  const tiles = [
    debateIndex.data && {
      label: l('Chamber debates', 'Kammardebatter'),
      value: num(totalDebates),
      note: `${sessionList[0]?.session} – ${sessionList.at(-1)?.session}`,
    },
    o && {
      label: l('Replies', 'Repliker'),
      value: num(o.parliament.issue_replies),
      note: l('in the issue debates', 'i sakdebatterna'),
    },
    leaders.data && {
      label: l('Party leader debates', 'Partiledardebatter'),
      value: num(leaders.data.data.length),
      note: l('full text, reply by reply', 'fulltext, replik för replik'),
    },
    o && {
      label: l('Analysed segments', 'Analyserade segment'),
      value: num(o.parliament.analyzed_segments),
      note: l('topic model, HDBSCAN', 'ämnesmodell, HDBSCAN'),
    },
    o && {
      label: l('Committee points', 'Utskottspunkter'),
      value: num(o.parliament.committee_points),
      note: o.sessions.map((s) => s.id).join(', '),
    },
    o && {
      label: l('Reservations', 'Reservationer'),
      value: num(o.sessions.reduce((s, x) => s + x.reservations, 0)),
      note: l('same sessions', 'samma riksmöten'),
    },
    o && {
      label: l('Budget rows', 'Budgetrader'),
      value: num(o.parliament.budget_frame_rows),
      note: l(
        "the government's and the parties' frames",
        'regeringens och partiernas ramar',
      ),
    },
    outturn.data && {
      label: l('Expenditure areas', 'Utgiftsområden'),
      value: num(
        new Set(outturn.data.data.map((r) => r.expenditure_area)).size,
      ),
      note: l(
        `outturn ${years.at(-1)}–${years[0]}`,
        `utfall ${years.at(-1)}–${years[0]}`,
      ),
    },
    decisions.data && {
      label: l('Tax decisions', 'Skattebeslut'),
      value: num(decisions.data.decisions.length),
      note: l(
        'with bill and committee report',
        'med proposition och betänkande',
      ),
    },
    municipalities.data && {
      label: l('Municipal tax rates', 'Kommunalskatter'),
      value: num(municipalities.data.municipalities.length),
      note: l(
        `municipalities, ${municipalities.data.year}`,
        `kommuner, ${municipalities.data.year}`,
      ),
    },
    o?.law_pools.v2 && {
      label: l('Law provisions', 'Lagbestämmelser'),
      value: num(o.law_pools.v2.provisions),
      note: l(
        `in ${num(o.law_pools.v2.documents)} laws`,
        `i ${num(o.law_pools.v2.documents)} lagar`,
      ),
    },
    o && {
      label: l('Meaning tests', 'Betydelsetester'),
      value: `${o.meaning_tests.passed} / ${o.meaning_tests.total}`,
      note: l('passing', 'gröna'),
    },
  ].filter(Boolean) as { label: string; value: string; note: string }[]

  return (
    <DeepSection
      lead={l(
        'Budget, taxes, who speaks and how the parties vote, area by area. The table at the bottom has the rows behind them.',
        'Budget, skatter, vem som talar och hur partierna röstar, område för område. Tabellen längst ner har raderna bakom.',
      )}
      kpis={tiles}
    >
      <ChartCard
        span={7}
        title={l('Central government budget outturn', 'Statsbudgetens utfall')}
        sub={l(
          `Outturn ${year}, the ten largest expenditure areas, Swedish National Financial Management Authority`,
          `Utfall ${year}, de tio största utgiftsområdena, Statskontoret`,
        )}
        slicer={{
          label: l('Year', 'År'),
          value: String(year ?? ''),
          options: years.map((y) => ({ value: String(y), label: String(y) })),
          onChange: (ar) => setView({ ar: ar === String(years[0]) ? '' : ar }),
        }}
      >
        {budgetRows.length ? (
          <RankBars
            rows={budgetRows}
            format={billions}
            label={l(`Budget outturn ${year}`, `Statsbudgetens utfall ${year}`)}
          />
        ) : (
          <Loading />
        )}
      </ChartCard>
      <ChartCard
        span={5}
        title={l('Tax revenue over time', 'Skatteintäkter över tid')}
        sub={
          taxName &&
          `${l(taxName.name_en, taxName.name_sv)}, ${l('share of GDP', 'andel av BNP')}, ${taxes.data?.source}`
        }
        slicer={{
          label: l('Tax', 'Skatt'),
          value: view.skatt,
          options: taxTypes.map((t) => ({
            value: t.tax_code,
            label: l(t.name_en, t.name_sv),
          })),
          onChange: (skatt) => setView({ skatt }),
        }}
      >
        {taxPoints.length ? (
          <DotLine
            points={taxPoints}
            label={l(
              'Tax revenue, share of GDP',
              'Skatteintäkter, andel av BNP',
            )}
            format={(v) => `${dec(v)} %`}
            tick={(v) => `${v} %`}
            height={240}
          />
        ) : (
          <Loading />
        )}
      </ChartCard>
      <ChartCard
        span={6}
        title={l('Who takes the floor', 'Vem tar ordet i kammaren')}
        sub={l(
          `Speeches and replies per party in the issue debates, ${session}`,
          `Anföranden och repliker per parti i sakdebatterna, ${session}`,
        )}
        slicer={{
          label: l('Session', 'Riksmöte'),
          value: session,
          options: [...sessionList]
            .reverse()
            .map((s) => ({ value: s.session, label: s.session })),
          onChange: (rm) =>
            setView({ rm: rm === sessionList.at(-1)?.session ? '' : rm }),
        }}
      >
        {speakers.length ? (
          <RankBars
            rows={speakers}
            format={num}
            label={l(
              `Speeches per party ${session}`,
              `Inlägg per parti ${session}`,
            )}
          />
        ) : (
          <Loading />
        )}
      </ChartCard>
      <ChartCard
        span={6}
        title={l(
          'Votes with the government, by issue area',
          'Röstar med regeringen, per sakområde',
        )}
        sub={
          votes &&
          l(
            `Share of ${num(pointsInIssue)} points ${votes.session} where the party voted like ${votes.government}, the prime minister's party`,
            `Andel av ${num(pointsInIssue)} punkter ${votes.session} där partiet röstade som ${votes.government}, statsministerns parti`,
          )
        }
        slicer={{
          label: l('Issue area', 'Sakområde'),
          value: view.sak,
          options: issueList.map((i) => ({
            value: i.key,
            label: l(i.en, i.sv),
          })),
          onChange: (sak) => setView({ sak }),
        }}
      >
        {withGovernment.length ? (
          <RankBars
            rows={withGovernment}
            format={pct}
            max={100}
            label={l('Votes with the government', 'Röstar med regeringen')}
          />
        ) : votes ? (
          <Empty />
        ) : (
          <Loading />
        )}
      </ChartCard>
      <ChartCard
        span={12}
        title={l('What the debates are about', 'Vad debatterna handlar om')}
        sub={l(
          'Share of words per topic in the analysed party leader debates, HDBSCAN topic model',
          'Andel av orden per ämne i de analyserade partiledardebatterna, ämnesmodell med HDBSCAN',
        )}
        foot={
          unclustered &&
          l(
            `${dec(unclustered.word_share_pct)} % of the words fall in no topic and are left out.`,
            `${dec(unclustered.word_share_pct)} % av orden hamnar inte i något ämne och är utelämnade.`,
          )
        }
      >
        {topicRows.length ? (
          <RankBars
            rows={topicRows}
            format={pct}
            label={l('Topics in the debates', 'Ämnen i debatterna')}
          />
        ) : (
          <Loading />
        )}
      </ChartCard>
      <Explorer
        title={l('Explore the data', 'Utforska datan')}
        datasets={datasets}
      />
    </DeepSection>
  )
}

/** The Explorer's tables: each loads when its tab opens. */
function explorerDatasets(): Dataset[] {
  return [
    {
      key: 'debates',
      label: l('Debates', 'Debatter'),
      sub: l(
        'Every issue debate since 1993/94 with speeches and replies per party',
        'Varje sakdebatt sedan 1993/94 med anföranden och repliker per parti',
      ),
      filters: ['session', 'party'],
      columns: [
        { key: 'session', label: l('Session', 'Riksmöte') },
        { key: 'date', label: l('Date', 'Datum') },
        { key: 'title', label: l('Debate', 'Debatt') },
        { key: 'party', label: l('Party', 'Parti') },
        { key: 'speeches', label: l('Speeches', 'Anföranden'), numeric: true },
        { key: 'replies', label: l('Replies', 'Repliker'), numeric: true },
      ],
      load: async () => {
        const index = await fetchJson<DebateIndex>(
          'politics/parliament/debate-stats/index.json',
        )
        const all = await Promise.all(
          index.sessions.map((s) => fetchJson<DebateStats>(s.path)),
        )
        return all.flatMap((s) =>
          s.debates.flatMap((d) =>
            Object.entries(d.parties).map(([party, [speeches, replies]]) => ({
              session: s.session,
              date: d.date,
              title: d.title,
              party,
              speeches,
              replies,
            })),
          ),
        )
      },
    },
    {
      key: 'issues',
      label: l('Issue areas', 'Sakområden'),
      sub: l(
        "Each party's debates per issue area and session, counted from the speech cards",
        'Varje partis debatter per sakområde och riksmöte, räknade ur anförandekorten',
      ),
      filters: ['session', 'party'],
      columns: [
        { key: 'session', label: l('Session', 'Riksmöte') },
        { key: 'party', label: l('Party', 'Parti') },
        { key: 'issue', label: l('Issue area', 'Sakområde') },
        { key: 'debates', label: l('Debates', 'Debatter'), numeric: true },
      ],
      load: async () => {
        const s = await fetchJson<Issues>(
          'politics/parliament/sakdebatter.json',
        )
        const name = new Map(s.issues.map((i) => [i.key, l(i.en, i.sv)]))
        return s.topics.flatMap((t) =>
          Object.entries(t.parties).flatMap(([party, p]) =>
            Object.entries(p.topics).map(([key, debates]) => ({
              session: t.session,
              party,
              issue: name.get(key) ?? key,
              debates,
            })),
          ),
        )
      },
    },
    {
      key: 'budget',
      label: l('Budget motions', 'Budgetmotioner'),
      sub: l(
        "The government's and the parties' frames per expenditure area, million SEK",
        'Regeringens och partiernas ramar per utgiftsområde, miljoner kronor',
      ),
      filters: ['session', 'actor'],
      columns: [
        { key: 'session', label: l('Session', 'Riksmöte') },
        { key: 'actor', label: l('Actor', 'Aktör') },
        { key: 'area', label: l('Expenditure area', 'Utgiftsområde') },
        {
          key: 'amount_msek',
          label: l('Frame, MSEK', 'Ram, mnkr'),
          numeric: true,
        },
        {
          key: 'deviation_msek',
          label: l('Deviation, MSEK', 'Avvikelse, mnkr'),
          numeric: true,
        },
      ],
      load: async () => {
        const b = await fetchJson<Wrapped<Record<string, string | number>>>(
          'politics/parliament/budgets/summary.json',
        )
        return b.data.map((r) => ({
          session: r.session,
          actor: r.actor,
          area: `UO${r.expenditure_area} ${r.expenditure_area_name}`,
          amount_msek: r.amount_msek,
          deviation_msek: r.deviation_msek,
        })) as Row[]
      },
    },
    {
      key: 'tax-decisions',
      label: l('Tax decisions', 'Skattebeslut'),
      sub: l(
        'Decided tax changes with bill and committee report',
        'Beslutade skatteändringar med proposition och betänkande',
      ),
      filters: ['year', 'direction'],
      columns: [
        { key: 'year', label: l('Year', 'År') },
        { key: 'title', label: l('Decision', 'Beslut') },
        { key: 'direction', label: l('Direction', 'Riktning') },
        { key: 'bill', label: l('Bill', 'Proposition') },
        { key: 'report', label: l('Report', 'Betänkande') },
      ],
      load: async () => {
        const d = await fetchJson<{
          decisions: Record<string, string | number | null>[]
        }>('taxes/decisions.json')
        return d.decisions.map((r) => ({
          year: String(r.year),
          title: l(String(r.title_en), String(r.title_sv)),
          direction: r.direction,
          bill: r.bill,
          report: r.report,
        })) as Row[]
      },
    },
    {
      key: 'municipal',
      label: l('Municipal tax', 'Kommunalskatt'),
      sub: l(
        'Local income tax rate per municipality',
        'Kommunal skattesats per kommun',
      ),
      columns: [
        { key: 'code', label: l('Code', 'Kod') },
        { key: 'name', label: l('Municipality', 'Kommun') },
        {
          key: 'local_rate',
          label: l('Rate, %', 'Skattesats, %'),
          numeric: true,
          format: (v) => (typeof v === 'number' ? dec(v, 2) : '–'),
        },
      ],
      load: async () => {
        const m = await fetchJson<{
          municipalities: { code: string; name: string; local_rate: number }[]
        }>('taxes/municipalities.json')
        return m.municipalities.map(({ code, name, local_rate }) => ({
          code,
          name,
          local_rate,
        }))
      },
    },
    {
      key: 'activity',
      label: l('Party activity', 'Partiaktivitet'),
      sub: l(
        'Written questions, interpellations and debate speeches per party and session',
        'Skriftliga frågor, interpellationer och debattinlägg per parti och riksmöte',
      ),
      filters: ['session'],
      columns: [
        { key: 'session', label: l('Session', 'Riksmöte') },
        { key: 'party', label: l('Party', 'Parti') },
        {
          key: 'written_questions',
          label: l('Written questions', 'Skriftliga frågor'),
          numeric: true,
        },
        {
          key: 'interpellations',
          label: l('Interpellations', 'Interpellationer'),
          numeric: true,
        },
        {
          key: 'debate_speeches',
          label: l('Debate speeches', 'Debattinlägg'),
          numeric: true,
        },
      ],
      load: async () =>
        (
          await fetchJson<Wrapped<Row>>(
            'politics/parliament/activities/summary.json',
          )
        ).data,
    },
  ]
}
