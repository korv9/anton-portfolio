import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { githubStatus } from './github'
import { REPO, ago, day } from './techData'

export type Run = {
  id: number
  status: string
  conclusion: string | null
  event: string
  run_started_at: string
  updated_at: string
  html_url: string
  head_sha: string
  head_branch: string
}
type Workflow = { id: number; name: string; path: string; runs: Run[] }

/** Every workflow with its newest runs, from the scheduled snapshot (github.ts). */
export async function loadWorkflows(): Promise<Workflow[]> {
  return (await githubStatus()).workflows
}

const stateOf = (run: Run) =>
  run.status !== 'completed' ? 'running' : (run.conclusion ?? 'unknown')

export function Runs() {
  const [workflows, setWorkflows] = useState<Workflow[] | 'error' | null>(null)
  useEffect(() => {
    loadWorkflows().then(setWorkflows, () => setWorkflows('error'))
  }, [])
  if (workflows === null) return null
  if (workflows === 'error')
    return (
      <p className="tech-note">
        <a href={`https://github.com/${REPO}/actions`}>
          {l(
            'The run history is on GitHub Actions',
            'Körhistoriken finns på GitHub Actions',
          )}{' '}
          <span aria-hidden="true">↗</span>
        </a>
      </p>
    )
  const sorted = [...workflows].sort((a, b) =>
    (b.runs[0]?.run_started_at ?? '').localeCompare(
      a.runs[0]?.run_started_at ?? '',
    ),
  )
  return (
    <ul className="runs">
      {sorted.map((w) => {
        const last = w.runs[0]
        const took = last
          ? Math.round(
              (new Date(last.updated_at).getTime() -
                new Date(last.run_started_at).getTime()) /
                6e4,
            )
          : 0
        return (
          <li key={w.id} data-state={last ? stateOf(last) : 'never'}>
            <div className="runs-head">
              <b>{w.name}</b>
              <span className="runs-state">
                {last ? stateOf(last) : 'never run'}
              </span>
            </div>
            <p className="tech-meta">
              {w.path.replace('.github/workflows/', '')}
              {last &&
                ` · ${ago(last.run_started_at)} · ${took} min · ${last.event} · ${last.head_sha.slice(0, 7)}`}
            </p>
            <ol className="runs-strip" aria-label={`Latest runs of ${w.name}`}>
              {[...w.runs].reverse().map((run) => (
                <li key={run.id}>
                  <a
                    href={run.html_url}
                    data-state={stateOf(run)}
                    title={`${day(run.run_started_at)}: ${stateOf(run)}`}
                  >
                    <span className="visually-hidden">
                      {day(run.run_started_at)}: {stateOf(run)}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </li>
        )
      })}
    </ul>
  )
}
