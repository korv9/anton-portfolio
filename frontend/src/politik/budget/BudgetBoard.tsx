/**
 * Budget as a dashboard: what each party's budget motion adds or cuts against the government's
 * budget, in total and per expenditure area, year by year, and what the government's budget
 * itself spends most on. Columns for totals and years, bars for areas.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import { RIKSDAG_PARTIES } from '../../parties/identity'
import type { Route } from '../../router'
import { useParties } from '../partySelection'
import { useViewParams } from '../useViewParams'
import { Select } from '../controls'
import { Board, Empty } from '../board/Board'
import BudgetDifference from '../features/BudgetDifference'
import {
  areaNames,
  budgetBasis,
  loadBudgetReport,
  type BudgetReport,
} from '../themes/BudgetTheme'

const DEFAULTS = { ar: '' }

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
  return (
    <Board
      level={2}
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
        </>
      }
    >
      <BudgetDifference
        rows={rows}
        year={year}
        parties={withBudget}
        names={names}
        preferred={selected.find((p) => withBudget.includes(p))}
      />
    </Board>
  )
}
