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

type Entry = {
  outcome?: string
  recorded_at?: string
  last_success_at?: string | null
}

let status: Promise<Record<string, Entry> | null> | null = null
function load() {
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

/** Freshness and the last successful ingestion, or undefined while unknown. */
export function useFresh(domain: string) {
  const [fresh, setFresh] = useState<{ fresh: boolean; at?: string }>()
  useEffect(() => {
    let live = true
    load().then((s) => {
      const f = freshness(s, domain)
      const entry = s?.[SUBJECTS[domain]?.[0]]
      if (live && f !== undefined)
        setFresh({ fresh: f, at: (entry && lastSuccess(entry)) ?? undefined })
    })
    return () => {
      live = false
    }
  }, [domain])
  return fresh
}
