/**
 * Whether a feed post's subject was ingested within its SLA, from the live run status
 * (status/ingestion.json, the file platform/publish/heartbeat.py checks). Unknown while the
 * status loads, when it cannot be reached and for posts with no ingested subject.
 */
import { useEffect, useState } from 'react'

/**
 * Post domain -> the pipeline subject that feeds it and its `sla.fresh_within` in hours, as in
 * platform/pipeline.yml. Domains without an ingesting subject (ml, platform) are left out.
 */
export const SUBJECTS: Record<string, [subject: string, hours: number]> = {
  politics: ['parliament', 36],
  welfare: ['welfare', 36],
  taxes: ['taxes', 36],
  jobs: ['market', 36],
  sweden: ['sweden', 8 * 24],
  'ai-act': ['ai_act', 8 * 24],
}

export type Entry = {
  outcome?: string
  started_at?: string
  recorded_at?: string
  last_success_at?: string | null
  github_run?: string
}

/** The last run's length and its Actions log, when the status records both ends. */
export function lastRun(e: Entry) {
  const ms = Date.parse(e.recorded_at ?? '') - Date.parse(e.started_at ?? '')
  return ms >= 0
    ? { seconds: Math.round(ms / 1000), url: e.github_run }
    : undefined
}

let status: Promise<Record<string, Entry> | null> | null = null
export function loadStatus() {
  // Imported here so the unit test can load this file without the delivery client.
  status ??= import('../dataSource')
    .then((d) => d.objectStorageUrl('status/ingestion.json'))
    .then((url) => fetch(url, { cache: 'no-cache' }))
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => (s?.subjects as Record<string, Entry>) ?? null)
    .catch(() => null)
  return status
}

/** The last successful ingestion, as heartbeat.py reads it. */
const lastSuccess = (e: Entry) =>
  e.outcome === 'success' ? e.recorded_at : e.last_success_at

/** true fresh, false stale, undefined unknown. */
export function freshness(
  subjects: Record<string, Entry> | null,
  domain: string,
  now = Date.now(),
) {
  const sla = SUBJECTS[domain]
  const entry = sla && subjects?.[sla[0]]
  if (!entry) return undefined
  const since = Date.parse(lastSuccess(entry) ?? '')
  if (Number.isNaN(since)) return false
  return now - since <= sla[1] * 3_600_000
}

/** Freshness, the last successful ingestion and the last run, or undefined while unknown. */
export function useFresh(domain: string) {
  const [fresh, setFresh] = useState<{
    fresh: boolean
    at?: string
    run?: ReturnType<typeof lastRun>
  }>()
  useEffect(() => {
    let live = true
    loadStatus().then((s) => {
      const f = freshness(s, domain)
      const entry = s?.[SUBJECTS[domain]?.[0]]
      if (live && f !== undefined)
        setFresh({
          fresh: f,
          at: (entry && lastSuccess(entry)) ?? undefined,
          run: entry && lastRun(entry),
        })
    })
    return () => {
      live = false
    }
  }, [domain])
  return fresh
}
