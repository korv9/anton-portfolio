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
import { PartyChoice, Select, num, signed } from '../controls'
import { useViewParams } from '../useViewParams'

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
export type BudgetReport = {
  budgets: BudgetRow[]
  coverage: { generated_at: string; note: string }
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

const DEFAULTS = {
  ar: '',
  parti: '',
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
  const party = parties.includes(view.parti)
    ? view.parti
    : parties.includes('S')
      ? 'S'
      : parties[0]
  const byArea = view.jamfor === 'omrade'
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
  const govParties = gov ? l('the government', 'regeringen') : ''

  const partyRows = yearRows
    .filter((r) => r.actor === party)
    .sort((a, b) => value(b) - value(a))
  const areaRows = yearRows
    .filter((r) => r.actor !== 'GOV' && r.expenditure_area === area)
    .sort((a, b) => value(b) - value(a))
  const shown = byArea ? areaRows : partyRows
  const netTotal = partyRows.reduce((sum, r) => sum + r.deviation_msek, 0)
  const top = shown[0]
  const bottom = shown.at(-1)
  const label = (r: BudgetRow) =>
    byArea
      ? `${r.actor} · ${partyName(r.actor)}`
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
        <PartyChoice
          parties={parties}
          value={party}
          onChange={(parti) => setView({ parti })}
        />
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
                {l('Report', 'Betänkande')} ↗
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  const kpis = !report
    ? []
    : byArea
      ? [
          ...(gov
            ? [
                {
                  value: `${num(gov.government_amount_msek)} ${l('SEK m', 'mnkr')}`,
                  label: l(
                    `the government’s proposal for ${names.get(area)}`,
                    `regeringens förslag för ${names.get(area)}`,
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
              `net difference from ${govParties} across all areas`,
              `sammanlagd skillnad mot ${govParties} över alla områden`,
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
                `What the parties propose for ${names.get(area)}, compared with the government`,
                `Vad partierna föreslår för ${names.get(area)}, jämfört med regeringen`,
              )
            : l(
                `Where ${partyName(party)} wants more or less than the government`,
                `Var ${partyName(party)} vill lägga mer eller mindre än regeringen`,
              )
        }
        chartMeta={l(
          `${percent ? 'Per cent of the government’s proposal' : 'SEK million'} · budget year ${year}`,
          `${percent ? 'Procent av regeringens förslag' : 'Miljoner kronor'} · budgetåret ${year}`,
        )}
        chart={
          <Bars
            bars={shown.map((r) => ({
              key: `${r.actor}-${r.expenditure_area}`,
              label: label(r),
              value: value(r),
              party: r.actor,
            }))}
            format={format}
            description={l(
              `Difference from the government’s budget, ${year}: ${shown.map((r) => `${label(r)} ${format(value(r))}`).join('; ')}`,
              `Skillnad mot regeringens budget ${year}: ${shown.map((r) => `${label(r)} ${format(value(r))}`).join('; ')}`,
            )}
          />
        }
        takeaway={
          top && bottom
            ? byArea
              ? l(
                  `For ${names.get(area)}, ${partyName(top.actor)} proposes ${format(value(top))} and ${partyName(bottom.actor)} ${format(value(bottom))} compared with the government.`,
                  `För ${names.get(area)} föreslår ${partyName(top.actor)} ${format(value(top))} och ${partyName(bottom.actor)} ${format(value(bottom))} jämfört med regeringen.`,
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
                'A bar to the right means the party wants to spend more than the government in that area; to the left, less. Zero means the same as the government.',
                'En stapel åt höger betyder att partiet vill lägga mer än regeringen på området; åt vänster mindre. Noll betyder samma som regeringen.',
              )}
            </p>
            <p>
              {l(
                'Government parties and their support party do not table alternative budgets, so they are not shown. A proposal is not a decision: the Riksdag adopts one budget, usually the government’s.',
                'Regeringspartierna och deras stödparti lägger inga egna budgetförslag, så de visas inte. Ett förslag är inte ett beslut: riksdagen antar en budget, oftast regeringens.',
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
        deepLinks={[
          {
            href: '#budget-proposals',
            label: l('All proposals, year by year', 'Alla förslag, år för år'),
          },
          {
            href: '#budget-explore',
            label: l(
              'Budget compared with what parties talk about',
              'Budget jämfört med vad partierna pratar om',
            ),
          },
          {
            href: '#budget-outturn',
            label: l(
              'What was budgeted and spent',
              'Vad som budgeterades och användes',
            ),
          },
          { href: '#taxes', label: l('Taxes', 'Skatter') },
        ]}
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
        ) : (
          <Field label={l('Party', 'Parti')}>
            <PartyChoice
              parties={parties}
              value={party}
              onChange={(parti) => setView({ parti })}
            />
          </Field>
        )}
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
                  'Per cent of the government’s proposal',
                  'Procent av regeringens förslag',
                ),
              },
            ]}
            onChange={(matt) => setView({ matt })}
          />
        </Field>
        <Field label={l('Chart type', 'Graftyp')}>
          <p className="ds-small">
            {l(
              'Bars around zero: each value is a difference from the government.',
              'Staplar kring noll: varje värde är en skillnad mot regeringen.',
            )}
          </p>
        </Field>
      </BuilderPanel>
    </>
  )
}
