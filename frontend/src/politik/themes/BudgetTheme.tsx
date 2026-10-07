/**
 * Vad partierna vill lägga pengar på: each opposition party's budget motion compared with the
 * government's proposal, per expenditure area (utgiftsområde). From the budget mart
 * (gold/marts/budget-report.json), built from the Finance Committee's reports.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { load } from '../../parliament/data'
import { PartyTag, partyName } from '../../parties/identity'
import type { Route } from '../../router'
import ThemeLayout from '../ThemeLayout'
import BuilderPanel, { Choice, Field } from '../BuilderPanel'
import Bars from '../Bars'
import { Select, num, signed } from '../controls'
import { useViewParams } from '../useViewParams'
import { shownParties, useParties } from '../partySelection'
import GroupedBars from '../dash/GroupedBars'

export type BudgetRow = {
  actor: string
  amount_msek: number
  deviation_msek: number
  government_amount_msek: number
  budget_year: number
  expenditure_area: number
  expenditure_area_name: string
  proposal_type: string
  session: string
  source_url: string
}
export type BudgetDocument = {
  session: string
  document_id: string
  source_url: string
  rows: number
  /** The committee's own totals over all areas: GOV is the government's sum, a party its net
   * difference. Summing the rounded area figures can be off by a few million kronor. */
  totals_msek?: Record<string, number>
  /** How the Riksdag decided the frames: "utskottet" backs the government's proposal. */
  frame_decision?: {
    winner: string
    reservation_parties: string[]
    vote_url?: string
  } | null
}
export type BudgetReport = {
  budgets: BudgetRow[]
  coverage: { generated_at: string; note: string; documents: BudgetDocument[] }
  language: {
    definition: string
    rows: {
      corpus: string
      method: string
      party: string
      session: string
      expenditure_area: number
      keyword_share_pct: number
      occurrences: number
    }[]
    coverage: {
      corpus: string
      method: string
      party: string
      session: string
      speeches: number
      words: number
    }[]
    lexicon: { expenditure_area: string; keyword: string }[]
  }
}

export const loadBudgetReport = () =>
  load<BudgetReport>('gold/marts/budget-report.json')

/** Each expenditure area's current name (the latest year's wording). */
export function areaNames(rows: BudgetRow[]) {
  const names = new Map<number, { year: number; name: string }>()
  for (const r of rows) {
    const known = names.get(r.expenditure_area)
    if (!known || r.budget_year > known.year)
      names.set(r.expenditure_area, {
        year: r.budget_year,
        name: r.expenditure_area_name,
      })
  }
  return new Map([...names].map(([k, v]) => [k, v.name]))
}

/**
 * What the parties' figures are measured against in a budget year. The Finance Committee
 * compares every party with the government's proposal; in every year but one here the
 * Riksdag adopted that proposal, so it is the budget that was decided.
 */
export function budgetBasis(report: BudgetReport | null, year: number) {
  const session = `${year - 1}/${String(year).slice(2)}`
  const document = report?.coverage.documents?.find(
    (d) => d.session === session,
  )
  const decision = document?.frame_decision
  const adopted = decision ? decision.winner === 'utskottet' : null
  const instead = decision?.reservation_parties ?? []
  const long =
    adopted === true
      ? l(
          `against the budget for ${year} that the Riksdag adopted (the government’s proposal)`,
          `mot budgeten för ${year} som riksdagen beslutade (regeringens förslag)`,
        )
      : adopted === false
        ? l(
            `against the government’s proposal for ${year}; the Riksdag adopted ${instead.join(' and ')}’s budget instead`,
            `mot regeringens förslag för ${year}; riksdagen beslutade i stället ${instead.join(' och ')}:s budget`,
          )
        : l(
            `against the government’s proposal for ${year}`,
            `mot regeringens förslag för ${year}`,
          )
  const short =
    adopted === true
      ? l('Against the adopted budget', 'Mot beslutad budget')
      : l('Against the government’s proposal', 'Mot regeringens förslag')
  /** A party's net difference: the committee's printed total, else the sum of the areas. */
  const net = (party: string) =>
    document?.totals_msek?.[party] ??
    (report?.budgets ?? [])
      .filter((r) => r.budget_year === year && r.actor === party)
      .reduce((sum, r) => sum + r.deviation_msek, 0)
  return { adopted, long, short, net, source: document?.source_url }
}

const DEFAULTS = {
  ar: '',
  matt: 'mnkr',
  jamfor: 'parti',
  omrade: '',
}
const mnkr = (v: number) => `${signed(v)} ${l('SEK m', 'mnkr')}`
const share = (v: number) => `${signed(v, 1)} %`

export default function BudgetTheme({ route }: { route: Route }) {
  const [report, setReport] = useState<BudgetReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [view, setView, reset] = useViewParams(route, DEFAULTS)
  const { selected } = useParties(route)
  useEffect(() => {
    loadBudgetReport()
      .then(setReport)
      .catch((e: Error) => setError(e.message))
  }, [])

  const rows = report?.budgets ?? []
  const names = areaNames(rows)
  const years = [...new Set(rows.map((r) => r.budget_year))].sort(
    (a, b) => b - a,
  )
  const year = years.includes(Number(view.ar))
    ? Number(view.ar)
    : (years[0] ?? 0)
  const yearRows = rows.filter((r) => r.budget_year === year)
  const parties = [
    ...new Set(yearRows.filter((r) => r.actor !== 'GOV').map((r) => r.actor)),
  ].sort()
  // The parties chosen in the party bar that tabled a budget this year; S until one is chosen.
  const compared = shownParties(selected, []).filter((p) => parties.includes(p))
  const party = compared[0] ?? (parties.includes('S') ? 'S' : parties[0])
  const byArea = view.jamfor === 'omrade'
  const multi = !byArea && compared.length > 1
  const inView = multi ? compared : [party]
  const percent = view.matt === 'procent'
  const value = (r: BudgetRow) =>
    percent
      ? r.government_amount_msek
        ? (r.deviation_msek / r.government_amount_msek) * 100
        : 0
      : r.deviation_msek
  const format = percent ? share : mnkr
  const areas = [...new Set(yearRows.map((r) => r.expenditure_area))].sort(
    (a, b) => a - b,
  )
  // Default area: the one where the parties' proposals differ most from the government's.
  const spread = (area: number) =>
    yearRows
      .filter((r) => r.expenditure_area === area && r.actor !== 'GOV')
      .reduce((sum, r) => sum + Math.abs(r.deviation_msek), 0)
  const area = areas.includes(Number(view.omrade))
    ? Number(view.omrade)
    : [...areas].sort((a, b) => spread(b) - spread(a))[0]
  const gov = yearRows.find(
    (r) => r.actor === 'GOV' && r.expenditure_area === area,
  )
  const basis = budgetBasis(report, year)
  // What a difference is measured against, in running text.
  const against =
    basis.adopted === false
      ? l('the government’s proposal', 'regeringens förslag')
      : l('the adopted budget', 'den beslutade budgeten')
  const notAdopted = (report?.coverage.documents ?? [])
    .filter((d) => d.frame_decision && d.frame_decision.winner !== 'utskottet')
    .map((d) => `20${d.session.slice(5)}`)

  const partyRows = yearRows
    .filter((r) => inView.includes(r.actor))
    .sort((a, b) => value(b) - value(a))
  const areaRows = yearRows
    .filter(
      (r) =>
        r.actor !== 'GOV' &&
        r.expenditure_area === area &&
        (!compared.length || compared.includes(r.actor)),
    )
    .sort((a, b) => value(b) - value(a))
  const cell = (a: number, p: string) => {
    const r = yearRows.find((x) => x.actor === p && x.expenditure_area === a)
    return r ? value(r) : null
  }
  const reach = (a: number) =>
    Math.max(0, ...compared.map((p) => Math.abs(cell(a, p) ?? 0)))
  const netOf = basis.net
  const topOf = (p: string) =>
    yearRows
      .filter((r) => r.actor === p)
      .sort((a, b) => b.deviation_msek - a.deviation_msek)[0]
  const shown = byArea ? areaRows : partyRows
  const netTotal = basis.net(party)
  const top = shown[0]
  const bottom = shown.at(-1)
  const label = (r: BudgetRow) =>
    byArea
      ? `${r.actor} · ${partyName(r.actor)}`
      : multi
        ? `${r.actor} · ${r.expenditure_area}. ${names.get(r.expenditure_area)}`
        : `${r.expenditure_area}. ${names.get(r.expenditure_area)}`

  const yearOptions = years.map((y) => ({ value: String(y), label: String(y) }))
  const areaOptions = areas.map((a) => ({
    value: String(a),
    label: `${a}. ${names.get(a)}`,
  }))
  const filters = (
    <>
      <Select
        label={l('Budget year', 'Budgetår')}
        value={String(year)}
        options={yearOptions}
        onChange={(ar) => setView({ ar })}
      />
      {byArea ? (
        <Select
          label={l('Area', 'Utgiftsområde')}
          value={String(area)}
          options={areaOptions}
          onChange={(omrade) => setView({ omrade })}
        />
      ) : (
        <p className="theme-filter-note">
          {compared.length
            ? l(
                `Showing ${compared.join(', ')}. Choose parties in the bar above.`,
                `Visar ${compared.join(', ')}. Välj partier i raden ovanför.`,
              )
            : l(
                `Showing ${party}. Choose one or more parties in the bar above to compare.`,
                `Visar ${party}. Välj ett eller flera partier i raden ovanför för att jämföra.`,
              )}
        </p>
      )}
    </>
  )

  const table = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">
            {byArea
              ? l('Party', 'Parti')
              : l('Expenditure area', 'Utgiftsområde')}
          </th>
          <th scope="col">{l('Government, SEK m', 'Regeringen, mnkr')}</th>
          <th scope="col">{l('Proposal, SEK m', 'Förslaget, mnkr')}</th>
          <th scope="col">{l('Difference, SEK m', 'Skillnad, mnkr')}</th>
          <th scope="col">{l('Difference, %', 'Skillnad, %')}</th>
          <th scope="col">{l('Source', 'Källa')}</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => (
          <tr key={`${r.actor}-${r.expenditure_area}`}>
            <th scope="row">
              {byArea ? <PartyTag party={r.actor} /> : label(r)}
            </th>
            <td>{num(r.government_amount_msek)}</td>
            <td>{num(r.amount_msek)}</td>
            <td>{signed(r.deviation_msek)}</td>
            <td>
              {r.government_amount_msek
                ? signed((r.deviation_msek / r.government_amount_msek) * 100, 1)
                : '–'}
            </td>
            <td>
              <a href={r.source_url} target="_blank" rel="noreferrer">
                {l('Report', 'Betänkande')}
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  const kpis = !report
    ? []
    : multi
      ? compared.slice(0, 3).map((p) => ({
          value: mnkr(netOf(p)),
          label: l(
            `${partyName(p)}: in total, ${against}`,
            `${partyName(p)}: totalt mot ${against}`,
          ),
        }))
      : byArea
        ? [
            ...(gov
              ? [
                  {
                    value: `${num(gov.government_amount_msek)} ${l('SEK m', 'mnkr')}`,
                    label: l(
                      `${basis.adopted === false ? 'the government’s proposal' : 'the adopted budget'} for ${names.get(area)}`,
                      `${basis.adopted === false ? 'regeringens förslag' : 'beslutad budget'} för ${names.get(area)}`,
                    ),
                  },
                ]
              : []),
            ...(top && top.deviation_msek > 0
              ? [
                  {
                    value: format(value(top)),
                    label: l(
                      `${partyName(top.actor)} wants the most more`,
                      `${partyName(top.actor)} vill lägga mest mer`,
                    ),
                  },
                ]
              : []),
            ...(bottom && bottom.deviation_msek < 0
              ? [
                  {
                    value: format(value(bottom)),
                    label: l(
                      `${partyName(bottom.actor)} wants the most less`,
                      `${partyName(bottom.actor)} vill lägga mest mindre`,
                    ),
                  },
                ]
              : []),
          ]
        : [
            {
              value: mnkr(netTotal),
              label: l(
                `in total across all areas, ${basis.long}`,
                `totalt över alla områden, ${basis.long}`,
              ),
            },
            ...(top && top.deviation_msek > 0
              ? [
                  {
                    value: format(value(top)),
                    label: l(
                      `most more: ${names.get(top.expenditure_area)}`,
                      `mest mer: ${names.get(top.expenditure_area)}`,
                    ),
                  },
                ]
              : []),
            ...(bottom && bottom.deviation_msek < 0
              ? [
                  {
                    value: format(value(bottom)),
                    label: l(
                      `most less: ${names.get(bottom.expenditure_area)}`,
                      `mest mindre: ${names.get(bottom.expenditure_area)}`,
                    ),
                  },
                ]
              : []),
          ]

  return (
    <>
      <ThemeLayout
        question={l(
          'What do the parties want to spend money on?',
          'Vad vill partierna lägga pengar på?',
        )}
        why={l(
          'Every autumn the opposition parties put their own budget against the government’s. The differences show their priorities in kronor, not just words.',
          'Varje höst ställer oppositionspartierna sin egen budget mot regeringens. Skillnaderna visar deras prioriteringar i kronor, inte bara i ord.',
        )}
        loading={!report && !error}
        error={error}
        kpis={kpis}
        filters={filters}
        chartTitle={
          byArea
            ? l(
                `What the parties propose for ${names.get(area)}, compared with ${against}`,
                `Vad partierna föreslår för ${names.get(area)}, jämfört med ${against}`,
              )
            : multi
              ? l(
                  `Where ${compared.join(', ')} want more or less than ${against}`,
                  `Var ${compared.join(', ')} vill lägga mer eller mindre än ${against}`,
                )
              : l(
                  `Where ${partyName(party)} wants more or less than ${against}`,
                  `Var ${partyName(party)} vill lägga mer eller mindre än ${against}`,
                )
        }
        chartMeta={l(
          `${percent ? 'Per cent' : 'SEK million'}, ${basis.long}`,
          `${percent ? 'Procent' : 'Miljoner kronor'}, ${basis.long}`,
        )}
        chart={
          multi ? (
            <GroupedBars
              groups={[...areas]
                .sort((a, b) => reach(b) - reach(a))
                .map((a) => ({
                  key: String(a),
                  label: `${a}. ${names.get(a)}`,
                  values: compared.map((p) => ({
                    party: p,
                    value: cell(a, p),
                  })),
                }))}
              format={format}
              label={l(
                `Difference per area, ${basis.long}: ${compared.join(', ')}`,
                `Skillnad per område, ${basis.long}: ${compared.join(', ')}`,
              )}
            />
          ) : (
            <Bars
              bars={shown.map((r) => ({
                key: `${r.actor}-${r.expenditure_area}`,
                label: label(r),
                value: value(r),
                party: r.actor,
              }))}
              format={format}
              description={l(
                `Difference ${basis.long}: ${shown.map((r) => `${label(r)} ${format(value(r))}`).join('; ')}`,
                `Skillnad ${basis.long}: ${shown.map((r) => `${label(r)} ${format(value(r))}`).join('; ')}`,
              )}
            />
          )
        }
        takeaway={
          multi
            ? compared
                .map((p) => topOf(p))
                .filter(Boolean)
                .map((r) =>
                  l(
                    `${partyName(r.actor)} adds most to ${names.get(r.expenditure_area)}.`,
                    `${partyName(r.actor)} lägger mest extra på ${names.get(r.expenditure_area)}.`,
                  ),
                )
                .join(' ')
            : top && bottom
              ? byArea
                ? l(
                    `For ${names.get(area)}, ${partyName(top.actor)} proposes ${format(value(top))} and ${partyName(bottom.actor)} ${format(value(bottom))} compared with ${against}.`,
                    `För ${names.get(area)} föreslår ${partyName(top.actor)} ${format(value(top))} och ${partyName(bottom.actor)} ${format(value(bottom))} jämfört med ${against}.`,
                  )
                : l(
                    `${partyName(party)} wants the most extra money for ${names.get(top.expenditure_area)} and the largest cut in ${names.get(bottom.expenditure_area)}.`,
                    `${partyName(party)} vill lägga mest extra pengar på ${names.get(top.expenditure_area)} och göra störst neddragning inom ${names.get(bottom.expenditure_area)}.`,
                  )
              : ''
        }
        meaning={
          <>
            <p>
              {l(
                'A bar to the right means the party wants to spend more than the budget in that area; to the left, less. Zero means the same amount.',
                'En stapel åt höger betyder att partiet vill lägga mer än budgeten på området; åt vänster mindre. Noll betyder samma belopp.',
              )}
            </p>
            <p>
              {l(
                'The Finance Committee compares every party’s budget with the government’s proposal, and that is the comparison shown. The Riksdag adopted the government’s proposal in every year here',
                'Finansutskottet jämför varje partis budget med regeringens förslag, och det är den jämförelsen som visas. Riksdagen antog regeringens förslag alla år här',
              )}
              {notAdopted.length
                ? l(
                    ` except ${notAdopted.join(', ')}, when an opposition budget won the vote.`,
                    ` utom ${notAdopted.join(', ')}, då ett oppositionsförslag vann omröstningen.`,
                  )
                : '.'}{' '}
              {l(
                'So the difference is, in practice, the difference from the budget that was decided. Government parties and their support party do not table budgets of their own, so they are not shown.',
                'Skillnaden är alltså i praktiken skillnaden mot den budget som beslutades. Regeringspartierna och deras stödparti lägger inga egna budgetar, så de visas inte.',
              )}
            </p>
          </>
        }
        table={table}
        sources={[
          {
            name: 'Sveriges riksdag, finansutskottets betänkanden',
            url: 'https://data.riksdagen.se',
          },
        ]}
        updated={
          report
            ? new Date(report.coverage.generated_at).toLocaleDateString(
                'sv-SE',
                { day: 'numeric', month: 'long', year: 'numeric' },
              )
            : null
        }
        method={
          <p>
            {report?.coverage.note}.{' '}
            {l(
              'Frames per expenditure area as the Finance Committee tabulates the motions.',
              'Ramar per utgiftsområde så som finansutskottet ställer upp motionerna.',
            )}
          </p>
        }
        onBuild={() => setBuilding(true)}
        deepLinks={[{ href: '#politik-skatter', label: l('Taxes', 'Skatter') }]}
      />
      <BuilderPanel
        open={building}
        onClose={() => setBuilding(false)}
        onReset={reset}
        title={l('Build your own view: budget', 'Bygg egen vy: budget')}
      >
        <Field label={l('Comparison', 'Jämförelse')}>
          <Choice
            name="jamfor"
            value={byArea ? 'omrade' : 'parti'}
            options={[
              {
                value: 'parti',
                label: l('One party, every area', 'Ett parti, alla områden'),
              },
              {
                value: 'omrade',
                label: l('One area, every party', 'Ett område, alla partier'),
              },
            ]}
            onChange={(jamfor) => setView({ jamfor })}
          />
        </Field>
        <Field label={l('Budget year', 'Budgetår')}>
          <Select
            label={l('Budget year', 'Budgetår')}
            value={String(year)}
            options={yearOptions}
            onChange={(ar) => setView({ ar })}
          />
        </Field>
        {byArea ? (
          <Field label={l('Issue area', 'Sakområde')}>
            <Select
              label={l('Expenditure area', 'Utgiftsområde')}
              value={String(area)}
              options={areaOptions}
              onChange={(omrade) => setView({ omrade })}
            />
          </Field>
        ) : null}
        <Field
          label={l('Normalisation', 'Normalisering')}
          hint={l(
            'Per cent makes small and large areas comparable.',
            'Procent gör små och stora områden jämförbara.',
          )}
        >
          <Choice
            name="matt"
            value={percent ? 'procent' : 'mnkr'}
            options={[
              { value: 'mnkr', label: l('SEK million', 'Miljoner kronor') },
              {
                value: 'procent',
                label: l(
                  'Per cent of the budget for the area',
                  'Procent av budgeten för området',
                ),
              },
            ]}
            onChange={(matt) => setView({ matt })}
          />
        </Field>
        <Field label={l('Chart type', 'Graftyp')}>
          <p className="ds-small">
            {l(
              'Bars around zero: each value is a difference from the budget.',
              'Staplar kring noll: varje värde är en skillnad mot budgeten.',
            )}
          </p>
        </Field>
      </BuilderPanel>
    </>
  )
}
