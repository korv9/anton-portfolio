/** SCB party preference survey, 1972 onward. */
import { l } from '../../i18n'
import { useState } from 'react'
import { Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { EndLabels, ticksBetween, XAxis, YAxis } from '../axes'
import { every, line, pc, pct, PARTIES, uniq } from './pol-kit'

type Poll = {
  survey_month: string
  party: string
  share_pct: number
  margin_of_error_pp: number | null
  change_since_last_survey_pp: number | null
}
type Polls = { polls: Poll[] }

const usePolls = () => useData<Polls>('parliament/polls.json')
const months = (d: Polls) => uniq(d.polls.map((p) => p.survey_month)).sort()
const years = (ms: string[]) => uniq(ms.map((m) => m.slice(0, 4)))

/** Every party's line, one drawn heavier; each named at its latest value. */
function Lines() {
  const data = usePolls()
  const [focus, setFocus] = useState<string>('SD')
  return (
    <Frame data={data}>
      {(d) => {
        const ms = months(d)
        if (ms.length < 2) return null
        const x = linearScale([0, ms.length - 1], [34, 530])
        const top = Math.max(60, ...d.polls.map((r) => r.share_pct))
        const y = linearScale([0, top], [178, 8])
        const ticks = every(years(ms), 9).map((yr) => ({
          value: ms.findIndex((m) => m.startsWith(yr)),
          label: yr,
        }))
        const lines = PARTIES.map((p) => {
          const rows = d.polls
            .filter((r) => r.party === p)
            .sort((a, b) => a.survey_month.localeCompare(b.survey_month))
          return {
            p,
            pts: rows.map(
              (r) =>
                [x(ms.indexOf(r.survey_month)), y(r.share_pct)] as [
                  number,
                  number,
                ],
            ),
            last: rows.at(-1),
          }
        }).filter((l) => l.pts.length)
        return (
          <>
            <Slicer
              label={l('Party', 'Parti')}
              options={PARTIES}
              value={focus}
              onChange={setFocus}
            />
            <svg
              viewBox="0 0 600 200"
              role="img"
              aria-label={l(
                `Poll share by party over time, ${focus} highlighted`,
                `Opinionsstöd per parti över tid, ${focus} markerat`,
              )}
            >
              <YAxis
                y={y}
                ticks={ticksBetween(0, top, 3)}
                x0={34}
                x1={530}
                format={(v) => `${v} %`}
              />
              {[...lines]
                .sort((a, b) => Number(a.p === focus) - Number(b.p === focus))
                .map((l) => (
                  <path
                    key={l.p}
                    d={line(l.pts)}
                    fill="none"
                    stroke={pc(l.p)}
                    strokeWidth={l.p === focus ? 2.5 : 1.2}
                    opacity={l.p === focus ? 1 : 0.55}
                    strokeLinejoin="round"
                  >
                    <title>{l.p}</title>
                  </path>
                ))}
              <EndLabels
                x={538}
                top={12}
                bottom={178}
                items={lines
                  .filter((l) => l.last?.survey_month === ms.at(-1))
                  .map((l) => ({
                    y: l.pts.at(-1)![1],
                    label: `${l.p} ${pct(l.last!.share_pct)}`,
                    color: l.p === focus ? undefined : 'var(--mean-muted)',
                  }))}
              />
              <XAxis y={194} x={x} ticks={ticks} />
            </svg>
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-poll-lines',
    domain: 'politics',
    sources: ['parliament/polls.json'],
    size: 'wide',
    title: (d: Polls) => {
      const ms = months(d)
      return ms.length
        ? l(
            `Party support in SCB surveys, ${ms[0].slice(0, 4)}–${ms.at(-1)!.slice(0, 4)}`,
            `Partisympatier i SCB:s undersökningar, ${ms[0].slice(0, 4)}–${ms.at(-1)!.slice(0, 4)}`,
          )
        : l(
            'Party support in SCB surveys',
            'Partisympatier i SCB:s undersökningar',
          )
    },
    note: [
      'Share of voters, %, in the party preference survey, mostly twice a year. Source: SCB.',
      'Andel av väljarna, %, i partisympatiundersökningen, oftast två gånger per år. Källa: SCB.',
    ],
    render: () => <Lines />,
  },
]
