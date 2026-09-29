/**
 * Budget as a dashboard: what each party's budget motion adds or cuts against the government's
 * budget, in total and per expenditure area, year by year, and what the government's budget
 * itself spends most on. Columns for totals and years, bars for areas.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import { RIKSDAG_PARTIES, identity, partyName } from '../../parties/identity'
import type { Route } from '../../router'
import { shownParties, useParties } from '../partySelection'
import { useViewParams } from '../useViewParams'
import { Select, num, signed } from '../controls'
import { Board, Card, Cards, Empty, Kpi, Kpis } from '../board/Board'
import Columns, { ColumnMultiples } from '../board/Columns'
import DashBars from '../dash/DashBars'
import GroupedBars from '../dash/GroupedBars'
import {
  areaNames,
  budgetBasis,
  loadBudgetReport,
  type BudgetReport,
  type BudgetRow,
} from '../themes/BudgetTheme'

const DEFAULTS = { ar: '', matt: 'mnkr', omraden: '10' }
const bn = (msek: number) => `${num(msek / 1000, 0)} ${l('bn', 'mdkr')}`

export default function BudgetBoard({ route }: { route: Route }) {
  const [view, setView] = useViewParams(route, DEFAULTS)
  const { selected } = useParties(route)
  const [report, setReport] = useState<BudgetReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadBudgetReport()
      .then(setReport)
      .catch((e: Error) => setError(e.message))
  }, [])
  const rows = report?.budgets ?? []
  const names = useMemo(() => areaNames(rows), [rows])
  if (error)
    return (
      <p role="alert" className="theme-error">
        {error}
      </p>
    )
  if (!report) return <Empty />

  const years = [...new Set(rows.map((r) => r.budget_year))].sort(
    (a, b) => a - b,
  )
  const year = years.includes(Number(view.ar)) ? Number(view.ar) : years.at(-1)!
  const yearRows = rows.filter((r) => r.budget_year === year)
  const basis = budgetBasis(report, year)
  const withBudget = RIKSDAG_PARTIES.filter((p) =>
    yearRows.some((r) => r.actor === p),
  )
  const chosen = shownParties(selected, [])
  const shown = chosen.filter((p) => withBudget.includes(p)).length
    ? chosen.filter((p) => withBudget.includes(p))
    : withBudget
  const missing = chosen.filter((p) => !withBudget.includes(p))
  const percent = view.matt === 'procent'
  const govTotal =
    report.coverage.documents.find(
      (d) => d.session === `${year - 1}/${String(year).slice(2)}`,
    )?.totals_msek?.GOV ??
    yearRows
      .filter((r) => r.actor === 'GOV')
      .reduce((s, r) => s + r.amount_msek, 0)
  const net = (p: string) => basis.net(p)
  const netShown = (p: string) =>
    percent && govTotal ? (net(p) / govTotal) * 100 : net(p)
  const fmt = percent
    ? (v: number) => `${signed(v, 1)} %`
    : (v: number) => signed(v)
  const valueOf = (r: BudgetRow) =>
    percent
      ? r.government_amount_msek
        ? (r.deviation_msek / r.government_amount_msek) * 100
        : 0
      : r.deviation_msek
  const cell = (area: number, party: string) => {
    const r = yearRows.find(
      (x) => x.actor === party && x.expenditure_area === area,
    )
    return r ? valueOf(r) : null
  }
  const areas = [...new Set(yearRows.map((r) => r.expenditure_area))]
  const reach = (area: number) =>
    Math.max(0, ...shown.map((p) => Math.abs(cell(area, p) ?? 0)))
  const limit = view.omraden === 'alla' ? areas.length : Number(view.omraden)
  const ranked = areas
    .filter((a) => reach(a) > 0)
    .sort((a, b) => reach(b) - reach(a))
    .slice(0, limit)
  const most = [...withBudget].sort((a, b) => net(b) - net(a))
  const govAreas = yearRows
    .filter((r) => r.actor === 'GOV')
    .sort((a, b) => b.amount_msek - a.amount_msek)
    .slice(0, 10)
  // Every year's totals, per party, for the columns over time.
  const byYear = (p: string) =>
    years.map((y) =>
      rows.some((r) => r.budget_year === y && r.actor === p)
        ? budgetBasis(report, y).net(p)
        : null,
    )
  const overTime = shownParties(selected).filter((p) =>
    byYear(p).some((v) => v != null),
  )

  return (
    <Board
      title={l('Budget', 'Budget')}
      sub={l(
        `The parties’ budget motions ${basis.long}. Parties in or supporting the government table no budget of their own.`,
        `Partiernas budgetmotioner ${basis.long}. Partier i eller som stöder regeringen lägger ingen egen budget.`,
      )}
      slicers={
        <>
          <Select
            label={l('Budget year', 'Budgetår')}
            value={String(year)}
            options={[...years]
              .reverse()
              .map((y) => ({ value: String(y), label: String(y) }))}
            onChange={(ar) => setView({ ar })}
          />
          <Select
            label={l('Measure', 'Mått')}
            value={percent ? 'procent' : 'mnkr'}
            options={[
              { value: 'mnkr', label: l('SEK m', 'Mnkr') },
              {
                value: 'procent',
                label: l('% of the budget', '% av budgeten'),
              },
            ]}
            onChange={(matt) => setView({ matt })}
          />
          <Select
            label={l('Areas', 'Områden')}
            value={view.omraden}
            options={[
              { value: '6', label: l('Top 6', 'Topp 6') },
              { value: '10', label: l('Top 10', 'Topp 10') },
              { value: 'alla', label: l('All', 'Alla') },
            ]}
            onChange={(omraden) => setView({ omraden })}
          />
        </>
      }
    >
      <Kpis>
        <Kpi
          index={0}
          label={l('The government’s budget', 'Regeringens budget')}
          value={govTotal}
          format={bn}
          sub={`${l('all areas', 'alla områden')}, ${year}`}
        />
        <Kpi
          index={1}
          label={l('Budget motions', 'Budgetmotioner')}
          value={withBudget.length}
          format={(v) => num(v)}
          sub={withBudget.join(', ')}
        />
        {most[0] && (
          <Kpi
            index={2}
            label={l('Adds the most', 'Lägger till mest')}
            value={net(most[0])}
            format={(v) => `${most[0]} ${signed(v)}`}
            sub={l('SEK m in total', 'mnkr totalt')}
          />
        )}
        {most.at(-1) && (
          <Kpi
            index={3}
            label={l('Cuts the most', 'Drar ned mest')}
            value={net(most.at(-1)!)}
            format={(v) => `${most.at(-1)} ${signed(v)}`}
            sub={l('SEK m in total', 'mnkr totalt')}
          />
        )}
        <Kpi
          index={4}
          label={l('Expenditure areas', 'Utgiftsområden')}
          value={areas.length}
          format={(v) => num(v)}
        />
      </Kpis>

      <Cards>
        <Card
          index={0}
          title={l(
            'Each party’s budget in total',
            'Varje partis budget totalt',
          )}
          meta={`${percent ? l('Per cent of the government’s budget', 'Procent av regeringens budget') : l('SEK m', 'Mnkr')} · ${basis.short.toLowerCase()} ${year}`}
          href="#budget-proposals"
          more={l('The proposals', 'Förslagen')}
        >
          <Columns
            categories={withBudget}
            series={withBudget.map((p, i) => ({
              key: p,
              label: partyName(p),
              party: p,
              values: withBudget.map((_, j) => (i === j ? netShown(p) : null)),
            }))}
            stacked
            format={fmt}
            label={l(
              `Each party’s net difference, ${year}`,
              `Varje partis nettoskillnad, ${year}`,
            )}
          />
        </Card>

        <Card
          index={1}
          title={l(
            'What the government’s budget spends most on',
            'Vad regeringens budget lägger mest på',
          )}
          meta={l(
            `Ten largest areas, ${year}`,
            `De tio största områdena, ${year}`,
          )}
          href="#budget-outturn"
          more={l('Budget and outturn', 'Budget och utfall')}
        >
          <DashBars
            bars={govAreas.map((r) => ({
              key: String(r.expenditure_area),
              label:
                names.get(r.expenditure_area) ?? String(r.expenditure_area),
              value: r.amount_msek,
              tone: 'neutral' as const,
            }))}
            format={bn}
            label={l(
              'The government’s budget per area',
              'Regeringens budget per område',
            )}
          />
        </Card>

        <Card
          index={2}
          wide
          title={l('Per expenditure area', 'Per utgiftsområde')}
          meta={`${percent ? l('Per cent of the area', 'Procent av området') : l('SEK m', 'Mnkr')} ${basis.long} · ${l('the areas where the parties differ most', 'områdena där partierna skiljer sig mest')}`}
          href={`#politik-budget-detalj?ar=${year}`}
          more={l('Build your own comparison', 'Bygg en egen jämförelse')}
        >
          {missing.length > 0 && (
            <p className="dash-empty">
              {l(
                `${missing.join(', ')}: no budget motion in ${year}.`,
                `${missing.join(', ')}: ingen budgetmotion ${year}.`,
              )}
            </p>
          )}
          <ul className="board-legend" aria-hidden="true">
            {shown.map((p) => (
              <li key={p}>
                <i style={{ background: identity(p).color }} />
                {p}
              </li>
            ))}
          </ul>
          <GroupedBars
            groups={ranked.map((area) => ({
              key: String(area),
              label: names.get(area) ?? String(area),
              values: shown.map((party) => ({
                party,
                value: cell(area, party),
              })),
            }))}
            format={fmt}
            label={l(
              `Difference per area, ${year}`,
              `Skillnad per område, ${year}`,
            )}
          />
        </Card>

        <Card
          index={3}
          wide
          title={l('Year by year', 'År för år')}
          meta={l(
            'Each party’s net difference per budget year, SEK m, one chart per party on the same scale; empty years: no motion or no data',
            'Varje partis nettoskillnad per budgetår, mnkr, ett diagram per parti på samma skala; tomma år: ingen motion eller inga data',
          )}
        >
          <ColumnMultiples
            categories={years.map(String)}
            series={overTime.map((p) => ({
              key: p,
              label: partyName(p),
              party: p,
              values: byYear(p),
            }))}
            format={(v) => signed(v)}
            label={l('Net difference per year', 'Nettoskillnad per år')}
          />
        </Card>
      </Cards>
    </Board>
  )
}
