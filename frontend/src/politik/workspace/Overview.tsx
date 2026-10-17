import type { Route } from '../../router'
import type { Now } from '../../parliament/data'
import { useDataset, workspacePath, type Workspace } from './data'
import { SupportTrend, Composition } from './Elections'
import { FormationMatrix, Similarity } from './Parliament'
import { BudgetComparison } from './Economy'
import { DebateActivity } from './Debates'
import { DataState } from './Workspace'
import { workspaceHref } from './logic'

export default function Overview({ route }: { route: Route }) {
  const { data, error } = useDataset<Workspace>(workspacePath)
  const { data: now } = useDataset<Now>('parliament/now.json')
  return (
    <>
      <div className="po-page-head">
        <h1>Overview</h1>
        <p>
          {now
            ? `Election ${now.election.year} · PSU ${now.poll.survey_month.slice(0, 7)} · ordinary roll calls through ${now.latest_session}`
            : 'Published source snapshots; coverage varies by chart.'}
        </p>
      </div>
      {now && (
        <p className="po-government-note">
          Government registry at {now.generated_at.slice(0, 10)}:{' '}
          <a
            href={workspaceHref('#politik-riksdag', route.params, {
              regering: now.government.government_key,
            })}
          >
            {now.government.prime_minister} ·{' '}
            {now.government.government_parties.join(' + ')}
          </a>
          {now.government.status_note && (
            <>
              {' '}
              ·{' '}
              <a href={now.government.source_url}>caretaker status recorded</a>
            </>
          )}
          .
        </p>
      )}
      <div className="dk-grid po-grid">
        <div className="po-span-8">
          <SupportTrend route={route} compact />
        </div>
        <div className="po-span-4">
          <Composition route={route} compact />
        </div>
        <div className="po-span-6">
          {data ? (
            <FormationMatrix route={route} data={data} compact />
          ) : (
            <DataState error={error} />
          )}
        </div>
        <div className="po-span-6">
          {data ? (
            <Similarity route={route} data={data} compact />
          ) : (
            <DataState error={error} />
          )}
        </div>
        <div className="po-span-6">
          <BudgetComparison route={route} compact />
        </div>
        <div className="po-span-6">
          {data ? (
            <DebateActivity route={route} data={data} compact />
          ) : (
            <DataState error={error} />
          )}
        </div>
      </div>
    </>
  )
}
