/** The AI Act diffusion clock: one term's rolling share in Riksdag speeches and in job ads, side by side. */
import { useContext, useState } from 'react'
import {
  Frame,
  OTHER,
  PALETTE,
  PostOpen,
  Slicer,
  useData,
  type Post,
} from '../kit'
import { niceTicks } from '../../charts/scales'
import { xTickY } from '../axes'
import { Svg, heading, line, uniq, usable } from './txt-kit'
import {
  caveat,
  DEFAULT,
  headline,
  view,
  type Data,
} from './txt-act-diffusion-data'

/** The one date named on the chart; the others are unlabelled ticks with a tooltip. */
const ANCHOR: Record<string, string> = { 'entry-into-force': 'in force' }

function Diffusion() {
  const data = usable(
    useData<Data>('ai-act/diffusion.json'),
    'ai-act/diffusion.json',
    (d) => view(d, DEFAULT).panels.length,
  )
  const [pick, setPick] = useState(DEFAULT)
  const open = useContext(PostOpen)
  return (
    <Frame data={data}>
      {(all) => {
        const { milestones, corpora } = all
        const { names, options, term, panels } = view(all, pick)
        const months = uniq(
          corpora.flatMap((c) => c.series[0].rows.map((r) => r[0])),
        ).sort()
        const end = months[months.length - 1]
        const dates = uniq(
          milestones.filter((m) => m.month <= end).map((m) => m.month),
        )
        const [W, H, gap, top, base, m] = [600, 200, 28, 32, 172, 26]
        const years = uniq(months.map((mo) => mo.slice(0, 4)))
        const every = Math.ceil(years.length / 4)
        const pw = (W - gap) / 2
        const x = (mo: string) =>
          m + (months.indexOf(mo) / (months.length - 1)) * (pw - m)
        return (
          <>
            <Slicer
              label="Term"
              cycles={false}
              options={options}
              format={(k) => names.get(k) ?? k}
              value={term}
              onChange={setPick}
            />
            {open && (
              <p className="mean-cap">{`“${names.get(term) ?? term}”. ${caveat(all)}.`}</p>
            )}
            <Svg
              w={W}
              h={H}
              label={`Three-month share of ${names.get(term)}, with the AI Act's dates. ${panels
                .map((p) => `${p.name}: ${p.total} matches. ${p.said}.`)
                .join(' ')}`}
            >
              {panels.map(({ c, s, total, name }, j) => {
                // Per 100,000 documents, each panel on its own scale.
                const ticks = niceTicks(
                  Math.max(...s.rows.map((r) => (r[2] ?? 0) * 1e5), 1e-4),
                  3,
                )
                const y = (v: number) =>
                  base - ((base - top) * v * 1e5) / ticks.at(-1)!
                return (
                  <g
                    key={c.corpus}
                    transform={`translate(${j * (pw + gap)},0)`}
                  >
                    <text className="mean-txt-v" x={0} y={10}>
                      {`${name}, ${total} match${total === 1 ? '' : 'es'}`}
                    </text>
                    <g className="mean-axis">
                      {ticks.map((t) => (
                        <g key={t}>
                          <line
                            x1={m}
                            x2={pw}
                            y1={y(t / 1e5)}
                            y2={y(t / 1e5)}
                          />
                          <text x={m - 3} y={y(t / 1e5) + 3.5} textAnchor="end">
                            {t < 10 ? t.toFixed(t % 1 ? 1 : 0) : t}
                          </text>
                        </g>
                      ))}
                    </g>
                    {dates.map((mo) => (
                      <line
                        key={mo}
                        x1={x(mo)}
                        x2={x(mo)}
                        y1={top}
                        y2={base}
                        stroke={OTHER}
                        strokeWidth={0.6}
                        strokeDasharray="2 2"
                      >
                        <title>
                          {milestones
                            .filter((d) => d.month === mo)
                            .map((d) => `${mo}: ${d.title_en}`)
                            .join('\n')}
                        </title>
                      </line>
                    ))}
                    {milestones
                      .filter(
                        (mi) => ANCHOR[mi.milestone_id] && mi.month <= end,
                      )
                      .map((mi) => (
                        <text
                          key={mi.milestone_id}
                          className="mean-txt-t"
                          x={x(mi.month) - 2}
                          y={top + 9}
                          textAnchor="end"
                        >
                          {ANCHOR[mi.milestone_id]}
                        </text>
                      ))}
                    <path
                      d={line(
                        s.rows
                          .filter((r) => r[2] !== null)
                          .map((r) => [x(r[0]), y(r[2]!)]),
                      )}
                      fill="none"
                      stroke={PALETTE[0]}
                      strokeWidth={1.4}
                    />
                    {years
                      .filter((_, i) => i % every === 0)
                      .map((yr) => (
                        <text
                          key={yr}
                          className="mean-txt-t"
                          x={x(months.find((mo) => mo.startsWith(yr))!)}
                          {...xTickY(base + 12)}
                          textAnchor="middle"
                        >
                          {yr}
                        </text>
                      ))}
                  </g>
                )
              })}
            </Svg>
            {open && (
              <ul className="mean-txt-list">
                {panels.map((p) => (
                  <li key={p.c.corpus}>
                    <span>{`${p.name}: ${p.said}.`}</span>
                    <span>{p.read}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-diffusion',
    sources: ['ai-act/diffusion.json'],
    domain: 'ai-act',
    size: 'wide',
    label: "AI Act: when the Act's terms appear in speeches and job ads",
    title: heading(headline),
    note: 'Share of documents using the term, per 100,000, three-month mean; dashed lines are the Act’s dates',
    render: () => <Diffusion />,
  },
]
