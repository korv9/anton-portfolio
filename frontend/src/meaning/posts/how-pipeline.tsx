/**
 * How it's made: every pipeline subject's last ingest, from the live ingest status
 * (status/ingestion.json, written by platform/publish/ingest_status.py for each subject). A bar
 * is the subject's ingest time, not the whole workflow; a failed ingest says so, and a subject
 * past a freshness SLA the feed knows for it (SUBJECTS in freshness.ts) is the focal colour.
 * When the status cannot be reached the thumbnail leaves the feed, as Frame does for withdrawn
 * and expired data; an opened post stays and says the status is unavailable, so focus is kept.
 */
import { useEffect, useState } from 'react'
import { Frame, PALETTE, type Post } from '../kit'
import { freshness, lastRun, loadStatus, SUBJECTS } from '../freshness'
import { Bars, fmt } from './txt-kit'
import { l } from '../../i18n'

type Status = Record<string, Parameters<typeof lastRun>[0]>

/** Post domains per subject; a subject is late when any domain's SLA for it has lapsed. */
const domainsOf = (subject: string) =>
  Object.keys(SUBJECTS).filter((d) => SUBJECTS[d][0] === subject)

function useStatus() {
  const [s, setS] = useState<Status | null | Error>(null)
  useEffect(() => {
    let live = true
    loadStatus().then(
      (v) => live && setS(v ?? new Error('status/ingestion.json')),
    )
    return () => {
      live = false
    }
  }, [])
  return s
}

function RunStrip() {
  return (
    <Frame data={useStatus()}>
      {(status) => {
        const rows = Object.entries(status)
          .map(([subject, e]) => ({
            subject,
            run: lastRun(e),
            failed: e.outcome === 'failure',
            late: domainsOf(subject).some(
              (d) => freshness(status, d) === false,
            ),
          }))
          .filter((r) => r.run)
          .sort((a, b) => b.run!.seconds - a.run!.seconds)
        const total = rows.reduce((n, r) => n + r.run!.seconds, 0)
        if (!rows.length)
          return (
            <p className="mean-failed">
              {l('No run recorded', 'Ingen körning registrerad')}
            </p>
          )
        return (
          <Bars
            label={l(
              `Ingest time of the last run of each of ${rows.length} pipeline subjects, ${fmt(total / 60)} minutes summed`,
              `Inläsningstid för senaste körningen av vart och ett av ${rows.length} dataflöden, sammanlagt ${fmt(total / 60)} minuter`,
            )}
            format={(v) => `${fmt(v / 60)} min`}
            focus={null}
            rows={rows.map((r) => ({
              key: r.subject,
              label: r.subject.replace(/_/g, ' '),
              value: r.run!.seconds,
              text: `${fmt(r.run!.seconds / 60)} min${r.failed ? l(', failed', ', misslyckad') : ''}${r.late ? l(', overdue', ', försenad') : ''}`,
              color: r.late ? PALETTE[0] : undefined,
            }))}
          />
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'how-pipeline-runs',
    domain: 'platform',
    sources: ['status/ingestion.json'],
    size: 'wide',
    label: [
      'How it is made: ingest time of each pipeline subject',
      'Så görs det: inläsningstid per dataflöde',
    ],
    title: [
      'How long each data source takes to ingest',
      'Hur lång tid varje datakälla tar att läsa in',
    ],
    note: [
      'Minutes of the last ingest per source, from the live run status; an overdue source is in colour',
      'Minuter för senaste inläsningen per källa, från den aktuella körstatusen; en försenad källa är färgad',
    ],
    render: () => <RunStrip />,
  },
]
