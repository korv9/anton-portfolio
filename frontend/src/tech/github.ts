/**
 * The GitHub facts the platform page shows, from status/github.json: a snapshot that
 * platform/publish/github_status.py writes on a schedule with the workflow's own token. The page
 * makes no GitHub API calls of its own, so visitors never hit the unsigned limit of 60 an hour.
 */
import { objectStorageUrl } from '../dataSource'
import type { Run } from './WorkflowRuns'

export type Issue = {
  number: number
  title: string
  html_url: string
  body: string | null
  created_at: string
  closed_at: string | null
}
export type GithubStatus = {
  generated_at: string
  workflows: { id: number; name: string; path: string; runs: Run[] }[]
  scheduled_runs: {
    since: string
    total_count: number
    workflow_runs: (Run & { name: string; created_at: string })[]
  }
  failure_issues: Issue[]
  incidents: { name: string; html_url: string }[]
  fabric_demo: string
}

let pending: Promise<GithubStatus> | null = null

/**
 * One read per page view, shared by every section that needs it. Like status/ingestion.json it
 * lives in object storage outside any release, so it is read uncached from there.
 */
export function githubStatus() {
  return (pending ??= objectStorageUrl('status/github.json')
    .then((url) => fetch(url, { cache: 'no-cache' }))
    .then((r) =>
      r.ok ? (r.json() as Promise<GithubStatus>) : Promise.reject(r.status),
    )
    .catch((error) => {
      pending = null
      throw error
    }))
}
