import { lazy, Suspense } from 'react'
import type { Route } from '../../router'
import { Feature, Pick } from '../../charts/feature/Feature'
import RankBars from '../../charts/RankBars'
import MultiLineChart from '../../charts/MultiLineChart'
import { partyName } from '../../parties/identity'
import { useParties } from '../partySelection'
import { useViewParams } from '../useViewParams'
import { Select, num, signed } from '../controls'
import { areaNames, type BudgetReport } from '../themes/BudgetTheme'
import { DataState } from './Workspace'
import { useDataset, workspacePath, type Workspace } from './data'
import { workspaceHref } from './logic'
import type { Issues } from '../../parliament/data'

const SkatterTheme = lazy(() => import('../themes/SkatterTheme'))
const defaults = {
  ekonomi: 'budget',
  ar: '',
  aktor: '',
  omrade: '',
  budgetomrade: '',
}

export function BudgetComparison({
  route,
  compact = false,
}: {
  route: Route
  compact?: boolean
}) {
  const { data, error } = useDataset<BudgetReport>(
    'gold/marts/budget-report.json',
  )
  const { data: workspace } = useDataset<Workspace>(workspacePath)
  const [view, set] = useViewParams(route, defaults)
  const { selected } = useParties(route)
  const years = [...new Set((data?.budgets ?? []).map((r) => r.budget_year))]
    .filter((y) => y <= new Date().getFullYear() + 1)
    .sort((a, b) => a - b)
  const year = years.includes(Number(view.ar)) ? Number(view.ar) : years.at(-1)
  const current = (data?.budgets ?? []).filter((r) => r.budget_year === year)
  const actors = [
    ...new Set(current.filter((r) => r.actor !== 'GOV').map((r) => r.actor)),
  ]
  const actor = actors.includes(view.aktor)
    ? view.aktor
    : (selected.find((p) => actors.includes(p)) ?? actors[0])
  const issue = workspace?.issues.find((i) => i.issue_key === view.omrade)
  const government = current.filter(
    (r) =>
      r.actor === 'GOV' &&
      (!issue || issue.expenditure_areas.includes(r.expenditure_area)),
  )
  const names = areaNames(data?.budgets ?? [])
  const comparison = government
    .flatMap((g) => {
      const row = current.find(
        (r) => r.actor === actor && r.expenditure_area === g.expenditure_area,
      )
      return row
        ? [
            {
              key: String(g.expenditure_area),
              label: `${g.expenditure_area}. ${names.get(g.expenditure_area) ?? g.expenditure_area_name}`,
              value: row.deviation_msek,
            },
          ]
        : []
    })
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  const document = data?.coverage.documents.find(
    (d) => d.session === current[0]?.session,
  )
  return (
    <Feature
      id="budget-comparison"
      title={
        actor
          ? `Where does ${partyName(actor)} propose a different budget?`
          : 'How do budget proposals differ?'
      }
      lead={`${year ?? '…'} proposed expenditure, difference from the government proposal, SEK billion. ${issue ? issue.issue_name_en + '. ' : ''}Proposals are not spending outcomes.`}
      controls={
        !compact && (
          <>
            <Select
              label="Budget year"
              value={String(year ?? '')}
              options={[...years]
                .reverse()
                .map((y) => ({ value: String(y), label: String(y) }))}
              onChange={(ar) => set({ ar })}
            />
            <Select
              label="Budget proposer"
              value={actor ?? ''}
              options={actors.map((p) => ({ value: p, label: partyName(p) }))}
              onChange={(aktor) => set({ aktor })}
            />
            {workspace && (
              <Select
                label="Budget policy area"
                value={view.omrade}
                options={[
                  { value: '', label: 'All expenditure areas' },
                  ...workspace.issues.map((i) => ({
                    value: i.issue_key,
                    label: i.issue_name_en,
                  })),
                ]}
                onChange={(omrade) => set({ omrade })}
              />
            )}
          </>
        )
      }
      source={
        document ? (
          <a href={document.source_url}>
            Finance Committee {document.session}:FiU1 · exact budget-year tables
          </a>
        ) : (
          'Riksdagen Finance Committee budget reports'
        )
      }
      table={
        <table>
          <caption>SEK million, same budget year and expenditure area</caption>
          <thead>
            <tr>
              <th>Area</th>
              <th>Government proposal</th>
              <th>{actor ?? 'Party'} proposal</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {government.map((g) => {
              const p = current.find(
                (r) =>
                  r.actor === actor &&
                  r.expenditure_area === g.expenditure_area,
              )
              return (
                <tr key={g.expenditure_area}>
                  <th>
                    {g.expenditure_area}. {names.get(g.expenditure_area)}
                  </th>
                  <td>{num(g.amount_msek)}</td>
                  <td>{p ? num(p.amount_msek) : 'Unavailable'}</td>
                  <td>{p ? signed(p.deviation_msek) : 'Unavailable'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      }
    >
      {!data ? (
        <DataState error={error} />
      ) : comparison.length ? (
        <RankBars
          rows={comparison}
          limit={compact ? 5 : 12}
          label="Proposed differences from government expenditure"
          format={(v) => `${signed(v / 1000, 1)} bn`}
        />
      ) : (
        <p>
          No comparable proposal is available for this proposer, year and policy
          area.
        </p>
      )}
      {!compact && (
        <>
          <p className="po-note">
            Only separately tabled party proposals are listed. No party proposal
            is inferred from cabinet membership, a support agreement or a
            missing row.
          </p>
          <details>
            <summary>Adoption and comparison basis</summary>
            <p>
              {document?.frame_decision
                ? `The recorded frame decision selected ${document.frame_decision.winner === 'utskottet' ? 'the committee proposal' : document.frame_decision.winner}. A frame decision does not establish subsequent actual expenditure.`
                : 'No adopted-frame classification is published for this report.'}{' '}
              Comparisons use the government’s proposal for the same year and
              area. Coverage has gaps; historical area definitions can change.
            </p>
            {document?.frame_decision?.vote_url && (
              <a
                href={document.frame_decision.vote_url.replace(
                  'http:',
                  'https:',
                )}
              >
                Official budget frame vote ↗
              </a>
            )}
            <p>{data?.coverage.note}</p>
          </details>
          {issue && (
            <nav className="po-related" aria-label="Budget policy context">
              <a
                href={workspaceHref('#politik-riksdag', route.params, {
                  omrade: issue.issue_key,
                  riksmote: current[0]?.session ?? '',
                })}
              >
                Votes in this policy area →
              </a>
              <a
                href={workspaceHref('#politik-tal', route.params, {
                  omrade: issue.issue_key,
                  riksmote: current[0]?.session ?? '',
                })}
              >
                Debates in this policy area →
              </a>
            </nav>
          )}
        </>
      )}
      {compact && (
        <a
          href={workspaceHref('#politik-budget', route.params, {
            aktor: actor ?? '',
            ar: String(year),
          })}
        >
          Compare proposals and adopted frames →
        </a>
      )}
    </Feature>
  )
}

function SpendingHistory({ route }: { route: Route }) {
  const { data, error } = useDataset<Issues>('parliament/issues.json')
  const [view, set] = useViewParams(route, defaults)
  const issue =
    data?.issues.find((i) => i.issue_key === view.omrade) ??
    data?.issues.find((i) => i.budget_outturn_msek.length)
  return (
    <Feature
      id="actual-spending"
      title="How did spending in a policy area change?"
      lead={`${issue?.issue_name_en ?? 'Policy area'}; actual outturn in nominal SEK billion, not inflation-adjusted.`}
      controls={
        data && (
          <Select
            label="Spending policy area"
            value={issue?.issue_key ?? ''}
            options={data.issues
              .filter((i) => i.budget_outturn_msek.length)
              .map((i) => ({ value: i.issue_key, label: i.issue_name_en }))}
            onChange={(omrade) => set({ omrade })}
          />
        )
      }
      source="Statskontoret budget outturn; issue-to-expenditure-area dimension"
      table={
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Outturn, SEK million</th>
            </tr>
          </thead>
          <tbody>
            {issue?.budget_outturn_msek.map((r) => (
              <tr key={r.year}>
                <th>{r.year}</th>
                <td>{num(r.outturn_msek)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {!data ? (
        <DataState error={error} />
      ) : issue ? (
        <MultiLineChart
          label="Actual spending by year"
          series={[
            {
              key: 'outturn',
              name: issue.issue_name_en,
              points: issue.budget_outturn_msek
                .filter((r) => r.year <= new Date().getFullYear())
                .map((r, i, rows) => ({
                  date: `${r.year}-01-01`,
                  label: String(r.year),
                  value: r.outturn_msek / 1000,
                  breakBefore: i > 0 && r.year - rows[i - 1].year > 1,
                })),
            },
          ]}
          format={(v) => `${num(v, 0)} bn`}
          colorOf={() => 'var(--color-chart-neutral)'}
        />
      ) : (
        <p>No spending series is published for this area.</p>
      )}
      <details>
        <summary>Historical comparability</summary>
        <p>
          Expenditure areas are linked to policy issues through the existing
          dimension. The series describes their recorded nominal outturn.
          Classification changes, prices and population changes can affect
          comparisons. It does not measure a government’s causal impact.
        </p>
      </details>
    </Feature>
  )
}

export default function Economy({ route }: { route: Route }) {
  const [view, set] = useViewParams(route, defaults)
  return (
    <>
      <h1>Economy & Policy</h1>
      <Pick
        label="Economic analysis"
        value={view.ekonomi === 'skatt' ? 'skatt' : 'budget'}
        options={[
          { value: 'budget', label: 'Budgets and spending' },
          { value: 'skatt', label: 'OECD taxation' },
        ]}
        onChange={(ekonomi) => set({ ekonomi })}
      />
      {view.ekonomi === 'skatt' ? (
        <Suspense fallback={<DataState />}>
          <SkatterTheme route={route} />
        </Suspense>
      ) : (
        <div className="dk-grid po-grid">
          <div className="po-span-8">
            <BudgetComparison route={route} />
          </div>
          <div className="po-span-4">
            <SpendingHistory route={route} />
          </div>
        </div>
      )}
      <nav className="po-related" aria-label="Economic research">
        <a href={workspaceHref('#politik-budget-detalj', route.params)}>
          Budget tables and language comparisons
        </a>
        <a href={workspaceHref('#politik-skatter', route.params)}>
          Tax details and household tools
        </a>
      </nav>
    </>
  )
}
