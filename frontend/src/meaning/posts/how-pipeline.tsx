/**
 * How it's made: every pipeline subject's last run, from the live run status
 * (status/ingestion.json, written by platform/pipeline.py on each scheduled run). A bar is the
 * last run's measured length, start to end; a subject past the freshness SLA the feed knows for
 * it (SUBJECTS in freshness.ts) is the focal colour.
 * The post leaves the feed when the status cannot be reached.
 */
import { useEffect, useState } from 'react'
import { focal, Frame, type Post } from '../kit'
import { freshness, lastRun, loadStatus, SUBJECTS } from '../freshness'
import { fmt, Svg } from './txt-kit'

type Status = Record<string, Parameters<typeof lastRun>[0]>

/** Subject -> a post domain with that subject, so freshness() can read its SLA. */
const DOMAIN = Object.fromEntries(
  Object.entries(SUBJECTS).map(([domain, [subject]]) => [subject, domain]),
)

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
            late:
              DOMAIN[subject] !== undefined &&
              freshness(status, DOMAIN[subject]) === false,
          }))
          .filter((r) => r.run)
          .sort((a, b) => b.run!.seconds - a.run!.seconds)
        const max = Math.max(1, ...rows.map((r) => r.run!.seconds))
        const total = rows.reduce((n, r) => n + r.run!.seconds, 0)
        const [W, row, left] = [600, 18, 120]
        const H = rows.length * row + 24
        return (
          <Svg
            w={W}
            h={H}
            label={`How long the last run of each of ${rows.length} pipeline subjects took, ${fmt(total / 60)} minutes summed`}
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
                    {fmt(r.run!.seconds / 60)} min{r.late ? ', overdue' : ''}
                  </text>
                </g>
              )
            })}
            <text className="mean-txt-t" x={left} y={H - 6}>
              {fmt(total / 60)} min summed over the last run of each subject
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
    label: 'How it is made: the last run of each pipeline subject',
    render: () => <RunStrip />,
  },
]
