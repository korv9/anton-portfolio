/**
 * How it's made: every pipeline subject's last ingest, from the live ingest status
 * (status/ingestion.json, written by platform/publish/ingest_status.py for each subject). A bar
 * is the subject's ingest time, not the whole workflow; a failed ingest says so, and a subject
 * past a freshness SLA the feed knows for it (SUBJECTS in freshness.ts) is the focal colour.
 * When the status cannot be reached the thumbnail leaves the feed, as Frame does for withdrawn
 * and expired data; an opened post stays and says the status is unavailable, so focus is kept.
 */
import { useEffect, useState } from 'react'
import { focal, Frame, type Post } from '../kit'
import { freshness, lastRun, loadStatus, SUBJECTS } from '../freshness'
import { fmt, Svg } from './txt-kit'

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
            failed: e.outcome !== 'success',
            late: domainsOf(subject).some(
              (d) => freshness(status, d) === false,
            ),
          }))
          .filter((r) => r.run)
          .sort((a, b) => b.run!.seconds - a.run!.seconds)
        const max = Math.max(1, ...rows.map((r) => r.run!.seconds))
        const total = rows.reduce((n, r) => n + r.run!.seconds, 0)
        if (!rows.length)
          return (
            <Svg w={600} h={24} label="No run recorded">
              <text className="mean-txt-t" x={0} y={16}>
                No run recorded
              </text>
            </Svg>
          )
        const [W, row, left] = [600, 18, 120]
        const H = rows.length * row + 24
        return (
          <Svg
            w={W}
            h={H}
            label={`Ingest time of the last run of each of ${rows.length} pipeline subjects, ${fmt(total / 60)} minutes summed`}
          >
            {rows.map((r, i) => {
              const w = ((W - left - 110) * r.run!.seconds) / max
              const y = i * row
              return (
                <g key={r.subject}>
                  <text
                    className="mean-txt-t"
                    x={left - 8}
                    y={y + row / 2 + 3}
                    textAnchor="end"
                  >
                    {r.subject.replace(/_/g, ' ')}
                  </text>
                  <rect
                    x={left}
                    y={y + 3}
                    width={Math.max(1, w)}
                    height={row - 6}
                    rx={2}
                    fill={focal(r.late)}
                  />
                  <text
                    className="mean-txt-t"
                    x={left + w + 6}
                    y={y + row / 2 + 3}
                  >
                    {fmt(r.run!.seconds / 60)} min{r.failed ? ', failed' : ''}
                    {r.late ? ', overdue' : ''}
                  </text>
                </g>
              )
            })}
            <text className="mean-txt-t" x={left} y={H - 6}>
              {fmt(total / 60)} min of subject ingest time, summed
            </text>
          </Svg>
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
    label: 'How it is made: ingest time of each pipeline subject',
    render: () => <RunStrip />,
  },
]
