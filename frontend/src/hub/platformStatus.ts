/**
 * The run figures in status/ingestion.json (platform/publish/ingest_status.py), read once for the
 * hub's headline and its flow: the newest run, how many subjects passed their latest run, the
 * source feeds with a fetch time, and how many subjects with an update limit are within it.
 */
import { SUBJECTS, type Entry } from '../meaning/freshness'

export type Status = Record<
  string,
  Entry & { sources?: { source_key: string; fetched_at?: string | null }[] }
>

/** Subject -> its fresh_within in hours, as freshness.ts mirrors platform/pipeline.yml. */
const SLA = new Map(Object.values(SUBJECTS))

export function readStatus(status: Status, now = Date.now()) {
  const entries = Object.entries(status).filter(([, e]) => e.recorded_at)
  if (!entries.length) return null
  const [lastName, last] = entries.reduce((a, b) =>
    b[1].recorded_at! > a[1].recorded_at! ? b : a,
  )
  const timed = entries.filter(([name]) => SLA.has(name))
  return {
    lastName,
    last,
    passed: entries.filter(([, e]) => e.outcome === 'success').length,
    total: entries.length,
    failed: entries
      .filter(([, e]) => e.outcome && e.outcome !== 'success')
      .map(([name]) => name.replace(/_/g, ' ')),
    feeds: new Set(
      entries.flatMap(([, e]) =>
        (e.sources ?? []).filter((s) => s.fetched_at).map((s) => s.source_key),
      ),
    ).size,
    fresh: timed.filter(([name, e]) => {
      const at = e.outcome === 'success' ? e.recorded_at : e.last_success_at
      return at && now - Date.parse(at) <= SLA.get(name)! * 36e5
    }).length,
    timed: timed.length,
  }
}
