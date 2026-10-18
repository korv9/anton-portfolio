import { useEffect, useState } from 'react'
import { REPO, ago, day } from './techData'

type Run = {
  id: number
  status: string
  conclusion: string | null
  event: string
  run_started_at: string
  updated_at: string
  html_url: string
  head_sha: string
}
type Workflow = { id: number; name: string; path: string; runs: Run[] }

async function loadWorkflows(): Promise<Workflow[]> {
  // GitHub allows 60 unsigned requests an hour; keep the answer for the session.
  const key = 'tech-workflows'
  try {
    const kept = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (kept && Date.now() - kept.at < 5 * 60e3) return kept.workflows
  } catch {
    // No session storage: ask again.
  }
  const api = async (path: string) => {
    const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`)
    if (!response.ok) throw new Error(`GitHub: HTTP ${response.status}`)
    return response.json()
  }
  const list = (await api('actions/workflows')).workflows as Omit<
    Workflow,
    'runs'
  >[]
  const workflows = await Promise.all(
    list
      .filter((w) => w.path.startsWith('.github/workflows/'))
      .map(async (w) => ({
        id: w.id,
        name: w.name,
        path: w.path,
        runs: (await api(`actions/workflows/${w.id}/runs?per_page=14`))
          .workflow_runs as Run[],
      })),
  )
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), workflows }))
  } catch {
    // Nothing to keep it in.
  }
  return workflows
}

const stateOf = (run: Run) =>
  run.status !== 'completed' ? 'running' : (run.conclusion ?? 'unknown')

export function Runs() {
  const [workflows, setWorkflows] = useState<Workflow[] | 'error' | null>(null)
  useEffect(() => {
    loadWorkflows().then(setWorkflows, () => setWorkflows('error'))
  }, [])
  if (workflows === null) return <p className="tech-note">Reading GitHub…</p>
  if (workflows === 'error')
    return (
      <p className="tech-note" role="status">
        The run history could not be read from GitHub just now (the open API
        allows 60 requests an hour).{' '}
        <a href={`https://github.com/${REPO}/actions`}>Open GitHub Actions</a>
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
