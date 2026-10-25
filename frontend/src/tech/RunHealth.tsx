/**
 * Run health on the platform page: every scheduled GitHub Actions run of the last 30 days, per
 * workflow, and for each red run the failure issue that .github/actions/failure-issue opened
 * for it (label data-pipeline-failure), with the failed jobs and steps it names. Below, the
 * postmortems in docs/incidents, listed from the repository so a new one shows up on its own.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { github } from './github'
import { REPO, day, reading } from './techData'

type Run = {
  id: number
  name: string
  status: string
  conclusion: string | null
  created_at: string
  updated_at: string
  html_url: string
}
type Issue = {
  number: number
  title: string
  html_url: string
  body: string | null
  created_at: string
  closed_at: string | null
}
type File = { name: string; html_url: string }
type Health = { runs: Run[]; issues: Issue[]; incidents: File[] }

const DAYS = 30
const HOUR = 36e5

async function loadHealth(): Promise<Health> {
  const since = new Date(Date.now() - DAYS * 24 * HOUR)
    .toISOString()
    .slice(0, 10)
  const [runs, issues, incidents] = await Promise.all([
    github<{ workflow_runs: Run[] }>(
      `${REPO}/actions/runs?event=schedule&created=>=${since}&per_page=100`,
    ),
    github<Issue[]>(
      `${REPO}/issues?labels=data-pipeline-failure&state=all&per_page=100`,
    ),
    github<File[]>(`${REPO}/contents/docs/incidents`).catch(() => []),
  ])
  return {
    runs: runs.workflow_runs,
    issues,
    incidents: incidents.filter((f) => f.name.endsWith('.md')),
  }
}

/** Red is a failed run or one cancelled at its timeout, as the failure issue counts them. */
const red = (r: Run) =>
  r.status === 'completed' &&
  (r.conclusion === 'failure' || r.conclusion === 'cancelled')
const stateOf = (r: Run) =>
  r.status !== 'completed' ? 'running' : red(r) ? 'failure' : 'success'

/** The issue open for this workflow when the run failed: one per outage, closed on success. */
function issueOf(run: Run, issues: Issue[]) {
  const ended = Date.parse(run.updated_at)
  return issues.find(
    (i) =>
      i.title === `Data pipeline failed: ${run.name}` &&
      Date.parse(i.created_at) <= ended + 2 * HOUR &&
      (i.closed_at === null || Date.parse(i.closed_at) >= ended),
  )
}

/** The "- job: steps" lines the failure issue lists under "Failed jobs and steps:". */
const failedSteps = (issue: Issue) =>
  (issue.body ?? '').split('Failed jobs and steps:')[1]?.trim() ?? ''

/** "2026-10-22-warehouse-wipe.md" as "2026-10-22: warehouse wipe". */
function title(file: File) {
  const [, date, slug] = file.name.match(/^(\d{4}-\d\d-\d\d)-(.+)\.md$/) ?? []
  return date ? `${date}: ${slug.replace(/-/g, ' ')}` : file.name
}

export function RunHealth() {
  const [health, setHealth] = useState<Health | 'error' | null>(null)
  useEffect(() => {
    loadHealth().then(setHealth, () => setHealth('error'))
  }, [])
  if (health === null) return reading
  if (health === 'error')
    return (
      <p className="tech-note" role="status">
        {l(
          'The run history could not be read from GitHub just now (the open API allows 60 requests an hour).',
          'Körhistoriken kunde inte läsas från GitHub just nu (det öppna API:et tillåter 60 anrop i timmen).',
        )}{' '}
        <a href={`https://github.com/${REPO}/actions`}>
          {l('Open GitHub Actions', 'Öppna GitHub Actions')}
        </a>
      </p>
    )
  const byWorkflow = new Map<string, Run[]>()
  for (const r of [...health.runs].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  ))
    byWorkflow.set(r.name, [...(byWorkflow.get(r.name) ?? []), r])
  const failed = health.runs.filter(red)
  return (
    <>
      <p className="tech-meta" data-testid="run-health-total">
        {l(
          `${health.runs.length} scheduled runs in the last ${DAYS} days, ${failed.length} red.`,
          `${health.runs.length} schemalagda körningar de senaste ${DAYS} dagarna, ${failed.length} röda.`,
        )}
      </p>
      <ul className="runs platform-runs">
        {[...byWorkflow].map(([name, runs]) => (
          <li key={name} data-state={stateOf(runs[runs.length - 1])}>
            <div className="runs-head">
              <b>{name}</b>
              <span className="runs-state">
                {runs.filter(red).length}/{runs.length} {l('red', 'röda')}
              </span>
            </div>
            <ol
              className="runs-strip"
              aria-label={l(`Runs of ${name}`, `Körningar av ${name}`)}
            >
              {runs.map((r) => (
                <li key={r.id}>
                  <a
                    href={r.html_url}
                    data-state={stateOf(r)}
                    title={`${day(r.created_at)}: ${r.conclusion ?? r.status}`}
                  >
                    <span className="visually-hidden">
                      {day(r.created_at)}: {r.conclusion ?? r.status}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
      {failed.length > 0 && (
        <>
          <h3>
            {l('Why the red runs failed', 'Varför de röda körningarna föll')}
          </h3>
          <ul className="platform-causes">
            {failed.map((r) => {
              const issue = issueOf(r, health.issues)
              return (
                <li key={r.id}>
                  <a href={r.html_url}>
                    {day(r.created_at)} · {r.name}
                  </a>{' '}
                  <span className="tech-meta">
                    {r.conclusion === 'cancelled'
                      ? l('timed out', 'tog för lång tid')
                      : l('failed', 'föll')}
                  </span>
                  {issue ? (
                    <>
                      {' · '}
                      <a href={issue.html_url}>#{issue.number}</a>
                      {failedSteps(issue) && (
                        <pre className="platform-steps">
                          {failedSteps(issue)}
                        </pre>
                      )}
                    </>
                  ) : (
                    <span className="tech-meta">
                      {' · '}
                      {l(
                        'no failure issue recorded; the log has the cause',
                        'inget felärende registrerat; loggen har orsaken',
                      )}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      <h3>{l('Incident reports', 'Incidentrapporter')}</h3>
      <p className="tech-note">
        {l(
          'Failures that reached beyond a single run get a written postmortem: what happened, the impact, the timeline and what changed in the code.',
          'Fel som gick utöver en enskild körning får en skriven efteranalys: vad som hände, påverkan, tidslinje och vad som ändrades i koden.',
        )}
      </p>
      <ul className="platform-links">
        {health.incidents.map((f) => (
          <li key={f.name}>
            <a href={f.html_url}>{title(f)}</a>
          </li>
        ))}
        <li>
          <a href={`https://github.com/${REPO}/tree/main/docs/incidents`}>
            {l(
              'All incident reports on GitHub',
              'Alla incidentrapporter på GitHub',
            )}
          </a>
        </li>
      </ul>
    </>
  )
}
