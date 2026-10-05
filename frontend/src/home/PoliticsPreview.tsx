import { useEffect, useState } from 'react'
import { identity } from '../parties/identity'
import { l } from '../i18n'
import { jsonData } from '../jobs/clusterData'
import { VisualizationFrame } from '../ui/Editorial'

type Result = { election_year: number; party: string; seats: number }
type Poll = { survey_month: string; party: string; share_pct: number }
const ORDER = ['V', 'S', 'MP', 'C', 'L', 'KD', 'M', 'SD']

function seatPositions(total: number) {
  const radii = Array.from({ length: 8 }, (_, i) => 46 + i * 11)
  const sum = radii.reduce((a, b) => a + b, 0)
  const counts = radii.map((r) => Math.floor((total * r) / sum))
  const extra = total - counts.reduce((a, b) => a + b, 0)
  const order = radii
    .map((r, i) => ({ i, remainder: (total * r) / sum - counts[i] }))
    .sort((a, b) => b.remainder - a.remainder)
  for (const { i } of order.slice(0, extra)) counts[i]++
  return radii
    .flatMap((r, i) =>
      Array.from({ length: counts[i] }, (_, j) => {
        const angle = Math.PI - (Math.PI * (j + 0.5)) / counts[i]
        return {
          x: 130 + Math.cos(angle) * r,
          y: 130 - Math.sin(angle) * r,
          angle,
        }
      }),
    )
    .sort((a, b) => b.angle - a.angle)
}

export default function PoliticsPreview() {
  const [results, setResults] = useState<Result[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  useEffect(() => {
    let active = true
    jsonData<{ results: Result[] }>('parliament/elections.json')
      .then((data) => {
        const complete = data.results.filter(
          (r) => r.seats > 0 && ORDER.includes(r.party),
        )
        const year = Math.max(...complete.map((r) => r.election_year))
        if (active)
          setResults(
            complete
              .filter((r) => r.election_year === year)
              .sort((a, b) => ORDER.indexOf(a.party) - ORDER.indexOf(b.party)),
          )
      })
      .catch(() => {})
    jsonData<{ polls: Poll[] }>('parliament/polls.json')
      .then((data) => {
        const rows = data.polls.filter(
          (p) => ORDER.includes(p.party) && Number.isFinite(p.share_pct),
        )
        const lastYear = Math.max(
          ...rows.map((p) => Number(p.survey_month.slice(0, 4))),
        )
        if (active)
          setPolls(
            rows.filter(
              (p) => Number(p.survey_month.slice(0, 4)) >= lastYear - 10,
            ),
          )
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  if (!results.length) return null
  const seats = results.flatMap((r) =>
    Array.from({ length: r.seats }, () => r.party),
  )
  const dots = seatPositions(seats.length)
  const months = [...new Set(polls.map((p) => p.survey_month))].sort()
  const yMax = Math.max(40, ...polls.map((p) => p.share_pct))
  return (
    <VisualizationFrame
      caption={`${l('Riksdag seats', 'Mandat i riksdagen')} · ${results[0].election_year} · SCB / Valmyndigheten`}
    >
      <div className="home-politics-preview">
        <div className="home-seat-chart">
          <svg
            viewBox="0 0 260 140"
            role="img"
            aria-label={results.map((r) => `${r.party}: ${r.seats}`).join(', ')}
          >
            {dots.map((point, i) => (
              <circle
                key={i}
                cx={point.x}
                cy={point.y}
                r="3.5"
                fill={identity(seats[i]).color}
                opacity=".88"
              />
            ))}
          </svg>
        </div>
        {polls.length > 0 && (
          <div className="home-poll-preview">
            <p className="home-chart-title">
              {l('SCB party support', 'SCB partisympatier')} (
              {months[0].slice(0, 4)}–{months.at(-1)!.slice(0, 4)})
            </p>
            <svg
              viewBox="0 0 260 110"
              role="img"
              aria-label={l(
                'Party support over time, SCB. Open Swedish politics for values and sources.',
                'Partisympatier över tid, SCB. Öppna Svensk politik för värden och källor.',
              )}
            >
              {[0, 25, 50, 75, 100].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="260"
                  y1={y + 5}
                  y2={y + 5}
                  stroke="var(--line)"
                  strokeWidth=".5"
                />
              ))}
              {ORDER.map((party) => {
                const rows = polls
                  .filter((p) => p.party === party)
                  .sort((a, b) => a.survey_month.localeCompare(b.survey_month))
                return (
                  <polyline
                    key={party}
                    points={rows
                      .map(
                        (p) =>
                          `${5 + (months.indexOf(p.survey_month) / Math.max(1, months.length - 1)) * 250},${105 - (p.share_pct / yMax) * 100}`,
                      )
                      .join(' ')}
                    fill="none"
                    stroke={identity(party).color}
                    strokeWidth="1.2"
                  />
                )
              })}
            </svg>
            <div className="home-poll-key" aria-hidden="true">
              {ORDER.map((party) => (
                <span key={party}>
                  <i style={{ background: identity(party).color }} />
                  {party}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </VisualizationFrame>
  )
}
